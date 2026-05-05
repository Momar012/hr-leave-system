import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      leave_type,
      start_date,
      end_date,
      is_half_day,
      working_days,
      ai_generated_message,
      employee_note,
    } = body;

    // Validate required fields
    if (!leave_type || !start_date || !end_date || working_days === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Insert leave request
    const { data: leaveRequest, error: leaveError } = await supabase
      .from('leave_requests')
      .insert({
        employee_id: user.id,
        leave_type,
        start_date,
        end_date,
        is_half_day: is_half_day || false,
        working_days,
        ai_generated_message,
        employee_note,
        status: 'pending',
      })
      .select()
      .single();

    if (leaveError || !leaveRequest) {
      console.error('Leave request insert error:', leaveError);
      return NextResponse.json({ error: 'Failed to create leave request' }, { status: 500 });
    }

    // Create notification for manager
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        leave_request_id: leaveRequest.id,
        is_read: false,
      });

    if (notifError) {
      console.error('Notification insert error:', notifError);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      leave_request: leaveRequest,
    });
  } catch (error) {
    console.error('Leave request API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
