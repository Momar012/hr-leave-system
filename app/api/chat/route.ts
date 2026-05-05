import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
import openai from '@/lib/openai';
import { countWorkingDays, getNonWorkingDays, formatDate, getTodayString } from '@/lib/utils/workingDays';
import { GPTLeaveExtraction, LeaveBalance, LeaveType } from '@/types';

const SYSTEM_PROMPT = `You are VEONie, an AI that helps employees submit leave requests.
Today's date is ${getTodayString()}.

Analyze the user's message (and any prior conversation context) and return ONLY valid JSON with this structure:
{
  "intent": "leave_request" | "balance_check" | "general" | "needs_clarification",
  "leave_type": "casual" | "annual" | "medical" | "sick" | "half_day" | null,
  "start_date": "YYYY-MM-DD" | null,
  "end_date": "YYYY-MM-DD" | null,
  "is_half_day": boolean,
  "reason": "brief reason for the leave in employee's own words" | null,
  "professional_message": "Dear Manager, I would like to request..." | null,
  "response": "natural response text" | null,
  "clarifying_question": "..." | null
}

Rules:
- For "leave_request": fill leave_type, start_date, end_date, is_half_day, professional_message
- For "half_day" leave type, set is_half_day to true and make start_date = end_date
- Never set is_half_day to true unless the user explicitly uses the words "half day" or "half-day"; default to full day
- Never infer today's date as start_date unless the user explicitly says "today"; if no date is mentioned use needs_clarification
- For "balance_check": only fill intent field (response and all others null)
- For "general": fill intent and response with a helpful, friendly reply. Handle greetings, small talk, HR policy questions naturally. Also handle questions about past leave requests (e.g. "what is the status of my last leave?", "why is my balance less?", "did my leave get approved?") — use the provided leave history context to give a specific, accurate answer. Never say "contact HR" if the answer is available in the leave history. When presenting multiple leave requests or any structured data, format as a GFM markdown table with headers e.g. | Leave Type | From | To | Days | Status | Submitted |. Use **bold** for key values and bullet points for short lists. The response field supports full GFM markdown.
- For "needs_clarification": use whenever any required detail is missing or ambiguous — ask only one question at a time:
  (a) If leave_type is not specified → ask "Are you requesting casual, annual, medical, or sick leave?"
  (b) If leave_type is known but no specific dates are mentioned → ask "What dates would you like to take off? Please give me a start and end date."
  (c) If leave_type and dates are known but it is unclear whether it is a full day or half day → ask "Would that be a full day or half day?"
  (d) If leave_type, dates, and duration are all known but no reason has been mentioned → ask "Could you please share the reason for this leave?"
  Never proceed to "leave_request" until leave_type, start_date, end_date, duration, AND reason are all confirmed by the user.
- professional_message should be formal and polite, suitable for a workplace
- Always resolve relative dates like "next Monday", "tomorrow", "from Monday to Wednesday" to actual YYYY-MM-DD dates based on today's date
- If only a start date and duration is given, calculate the end date
- Always incorporate the reason naturally into the professional_message (e.g. "due to a family commitment", "for medical treatment", etc.)
- Only return valid JSON, no other text`;

const BALANCE_KEY_MAP: Record<LeaveType, keyof LeaveBalance> = {
  casual: 'casual_remaining',
  annual: 'annual_remaining',
  medical: 'medical_remaining',
  sick: 'sick_remaining',
  half_day: 'half_day_remaining',
};

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, thread_id } = await request.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!thread_id) {
      return NextResponse.json({ error: 'thread_id is required' }, { status: 400 });
    }

    // Validate ownership
    const { data: thread } = await supabase
      .from('chat_threads')
      .select('id')
      .eq('id', thread_id)
      .eq('employee_id', user.id)
      .single();

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Fetch recent leave history to inject into system prompt as context
    const { data: recentLeaves } = await supabase
      .from('leave_requests')
      .select('leave_type, start_date, end_date, working_days, status, is_half_day, created_at')
      .eq('employee_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    const leaveHistoryContext = recentLeaves && recentLeaves.length > 0
      ? `\n\nEmployee's recent leave requests (most recent first):\n` +
        recentLeaves.map((r, i) => {
          const dateRange = r.start_date === r.end_date
            ? r.start_date
            : `${r.start_date} to ${r.end_date}`;
          const days = r.is_half_day ? '0.5' : r.working_days;
          const submitted = r.created_at.slice(0, 10);
          return `${i + 1}. ${r.leave_type} leave — ${dateRange} — ${days} working day(s) — Status: ${r.status} — Submitted: ${submitted}`;
        }).join('\n')
      : `\n\nEmployee has no leave requests on record.`;

    // Load last 20 messages from DB for context
    const { data: dbMessages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('thread_id', thread_id)
      .order('created_at', { ascending: true })
      .limit(20);

    const historyMessages = (dbMessages || []).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Insert user message into DB
    await supabase.from('chat_messages').insert({
      thread_id,
      role: 'user',
      content: message,
    });

    // Single GPT call with conversation history from DB
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + leaveHistoryContext },
        ...historyMessages,
        { role: 'user', content: message },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const extracted: GPTLeaveExtraction = JSON.parse(
      completion.choices[0].message.content || '{}'
    );

    // Helper to save assistant reply and bump thread updated_at
    const saveAssistantReply = async (content: string) => {
      await supabase.from('chat_messages').insert({
        thread_id,
        role: 'assistant',
        content,
      });
      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', thread_id);
    };

    // Handle needs_clarification
    if (extracted.intent === 'needs_clarification') {
      const replyContent = extracted.clarifying_question || 'Could you clarify what type of leave you need — casual, annual, medical, or sick?';
      await saveAssistantReply(replyContent);
      return NextResponse.json({
        intent: 'needs_clarification',
        message: replyContent,
        thread_id,
      });
    }

    // Handle balance check
    if (extracted.intent === 'balance_check') {
      const currentYear = new Date().getFullYear();
      const { data: balance } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', user.id)
        .eq('year', currentYear)
        .single();

      if (!balance) {
        const replyContent = "I couldn't find your leave balance. Please contact HR.";
        await saveAssistantReply(replyContent);
        return NextResponse.json({ intent: 'balance_check', message: replyContent, thread_id });
      }

      const replyContent = `Here are your remaining leave balances for ${currentYear}:\n\n- Casual Leave: **${balance.casual_remaining}** days\n- Annual Leave: **${balance.annual_remaining}** days\n- Medical Leave: **${balance.medical_remaining}** days\n- Sick Leave: **${balance.sick_remaining}** days\n- Half Days: **${balance.half_day_remaining}** remaining`;
      await saveAssistantReply(replyContent);
      return NextResponse.json({
        intent: 'balance_check',
        message: replyContent,
        balance,
        thread_id,
      });
    }

    // Handle general conversation
    if (extracted.intent === 'general') {
      const replyContent = extracted.response || "Hi, I'm VEONie by VEON 👋 How can I support you today?";
      await saveAssistantReply(replyContent);
      return NextResponse.json({ intent: 'general', message: replyContent, thread_id });
    }

    // Handle leave request
    if (extracted.intent === 'leave_request') {
      if (!extracted.leave_type || !extracted.start_date || !extracted.end_date) {
        const replyContent = "I need a few more details to process your leave request. Could you please specify the leave type (casual, annual, medical, sick, or half-day) and the dates?";
        await saveAssistantReply(replyContent);
        return NextResponse.json({ intent: 'needs_clarification', message: replyContent, thread_id });
      }

      if (!extracted.reason) {
        const replyContent = 'Could you please share the reason for this leave?';
        await saveAssistantReply(replyContent);
        return NextResponse.json({ intent: 'needs_clarification', message: replyContent, thread_id });
      }

      const workingDays = extracted.is_half_day
        ? 0.5
        : countWorkingDays(extracted.start_date, extracted.end_date);

      const nonWorkingDays = extracted.is_half_day
        ? []
        : getNonWorkingDays(extracted.start_date, extracted.end_date);

      let weekendNote = '';
      if (nonWorkingDays.length > 0) {
        const listed = nonWorkingDays
          .map(d => `**${d.dayName}, ${formatDate(d.date)}**`)
          .join(', ');
        weekendNote = `\n\n📅 Weekend days are not counted: ${listed} — no leave will be deducted for ${nonWorkingDays.length === 1 ? 'this day' : 'these days'}.`;
      }

      const currentYear = new Date().getFullYear();
      const { data: balance } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', user.id)
        .eq('year', currentYear)
        .single();

      if (!balance) {
        const replyContent = "I couldn't find your leave balance. Please contact HR.";
        await saveAssistantReply(replyContent);
        return NextResponse.json({ intent: 'leave_request', message: replyContent, thread_id });
      }

      const balanceKey = BALANCE_KEY_MAP[extracted.leave_type];
      const remaining = balance[balanceKey] as number;

      if (workingDays > remaining) {
        const replyContent = `Sorry, you don't have enough ${extracted.leave_type} leave days. You requested **${workingDays} working day(s)** but only have **${remaining} day(s)** remaining.`;
        await saveAssistantReply(replyContent);
        return NextResponse.json({
          intent: 'leave_request',
          message: replyContent,
          insufficient_balance: true,
          thread_id,
        });
      }

      const requiresDiscussion = ['annual', 'medical'].includes(extracted.leave_type);
      const professionalMessage = extracted.professional_message || `Dear Manager, I would like to request ${extracted.leave_type} leave from ${extracted.start_date} to ${extracted.end_date}${extracted.reason ? ` due to ${extracted.reason}` : ''}. Please let me know if you require any additional information.`;
      const confirmMessage =
        `I'll send this message to your manager:\n\n*"${professionalMessage}"*${requiresDiscussion ? '\n\n⚠️ **Note:** Annual/Medical leave typically requires prior discussion with your manager.' : ''}\n\nYou have **${remaining}** day(s) remaining. This request uses **${workingDays}** working day(s).${weekendNote}`;

      await saveAssistantReply(confirmMessage);

      return NextResponse.json({
        intent: 'leave_request',
        extracted,
        working_days: workingDays,
        remaining_balance: remaining,
        requires_discussion: requiresDiscussion,
        message: professionalMessage,
        confirm_message: confirmMessage,
        thread_id,
      });
    }

    const fallback = "Hi, I'm VEONie by VEON 👋 How can I support you today?";
    await saveAssistantReply(fallback);
    return NextResponse.json({ intent: 'general', message: fallback, thread_id });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
