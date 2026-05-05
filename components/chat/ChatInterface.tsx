'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ChatMessage as ChatMessageType, ChatThread, DbChatMessage, LeaveBalance, PendingLeaveRequest } from '@/types';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ChatSidebar from './ChatSidebar';

interface ChatInterfaceProps {
  userFullName: string;
  userId: string;
  initialThreads: ChatThread[];
}

export default function ChatInterface({ userFullName, userId, initialThreads }: ChatInterfaceProps) {
  const router = useRouter();
  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [threads, setThreads] = useState<ChatThread[]>(initialThreads);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [pendingRequest, setPendingRequest] = useState<PendingLeaveRequest | null>(null);
  const [confirmingLoading, setConfirmingLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  useEffect(() => {
    fetchBalance();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchBalance = async () => {
    setBalanceLoading(true);
    const res = await fetch('/api/leave/balance');
    const data = await res.json();
    if (data.balance) setBalance(data.balance);
    setBalanceLoading(false);
  };

  const refreshThreads = async () => {
    const res = await fetch('/api/chat/threads');
    const data = await res.json();
    if (data.threads) setThreads(data.threads);
  };

  const handleSelectThread = async (id: string) => {
    if (id === activeThreadId) return;
    setActiveThreadId(id);
    setPendingRequest(null);
    setLoadingMessages(true);
    setMessages([]);

    const res = await fetch(`/api/chat/threads/${id}`);
    const data = await res.json();

    if (data.messages) {
      const mapped: ChatMessageType[] = data.messages.map((m: DbChatMessage) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.created_at),
      }));
      setMessages(mapped);
    }
    setLoadingMessages(false);
  };

  const handleNewChat = () => {
    setActiveThreadId(null);
    setMessages([]);
    setPendingRequest(null);
  };

  const handleDeleteThread = async (id: string) => {
    await fetch(`/api/chat/threads/${id}`, { method: 'DELETE' });
    setThreads(prev => prev.filter(t => t.id !== id));
    if (activeThreadId === id) {
      setActiveThreadId(null);
      setMessages([]);
      setPendingRequest(null);
    }
  };

  const addMessage = useCallback((msg: Omit<ChatMessageType, 'id' | 'timestamp'>) => {
    const newMsg: ChatMessageType = {
      ...msg,
      id: Math.random().toString(36).slice(2),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMsg]);
    return newMsg;
  }, []);

  const streamAssistantMessage = useCallback(
    async (
      baseMsg: Omit<ChatMessageType, 'id' | 'timestamp'>,
      fullText: string,
      onComplete?: (id: string) => void
    ) => {
      const id = Math.random().toString(36).slice(2);
      const newMsg: ChatMessageType = { ...baseMsg, id, content: '', timestamp: new Date() };
      setMessages(prev => [...prev, newMsg]);
      setStreamingMessageId(id);

      const words = fullText.split(' ');
      let built = '';
      for (let i = 0; i < words.length; i++) {
        built += (i === 0 ? '' : ' ') + words[i];
        const snapshot = built;
        await new Promise<void>(resolve => setTimeout(resolve, 40));
        setMessages(prev =>
          prev.map(m => (m.id === id ? { ...m, content: snapshot } : m))
        );
      }

      setStreamingMessageId(null);
      if (onComplete) onComplete(id);
    },
    []
  );

  const handleSend = async (text: string) => {
    if (loading) return;
    setPendingRequest(null);

    addMessage({ role: 'user', content: text });
    setLoading(true);

    try {
      let threadId = activeThreadId;

      // Create thread if none active
      if (!threadId) {
        const res = await fetch('/api/chat/threads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: text.slice(0, 60) }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        threadId = data.thread.id;
        setActiveThreadId(threadId);
        setThreads(prev => [data.thread, ...prev]);
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, thread_id: threadId }),
      });

      const data = await res.json();

      if (data.error) {
        await streamAssistantMessage({ role: 'assistant', content: '' }, `Sorry, something went wrong: ${data.error}`);
        return;
      }

      if (data.intent === 'needs_clarification') {
        await streamAssistantMessage({ role: 'assistant', content: '' }, data.message);
        await refreshThreads();
        return;
      }

      if (data.intent === 'balance_check') {
        await streamAssistantMessage({ role: 'assistant', content: '' }, data.message);
        if (data.balance) setBalance(data.balance);
        await refreshThreads();
        return;
      }

      if (data.intent === 'general') {
        await streamAssistantMessage({ role: 'assistant', content: '' }, data.message);
        await refreshThreads();
        return;
      }

      if (data.intent === 'leave_request') {
        if (data.insufficient_balance) {
          await streamAssistantMessage({ role: 'assistant', content: '' }, data.message);
          await refreshThreads();
          return;
        }

        const pending: PendingLeaveRequest = {
          intent: 'leave_request',
          leave_type: data.extracted.leave_type,
          start_date: data.extracted.start_date,
          end_date: data.extracted.end_date,
          is_half_day: data.extracted.is_half_day,
          working_days: data.working_days,
          professional_message: data.message,
          requires_discussion: data.requires_discussion,
          reason: data.extracted.reason ?? undefined,
        };

        await streamAssistantMessage(
          { role: 'assistant', content: '' },
          data.confirm_message,
          (id) => {
            setMessages(prev =>
              prev.map(m => m.id === id ? { ...m, pendingRequest: pending } : m)
            );
            setPendingRequest(pending);
          }
        );

        await refreshThreads();
      }
    } catch {
      await streamAssistantMessage({ role: 'assistant', content: '' }, 'Sorry, I encountered an error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!pendingRequest) return;
    setConfirmingLoading(true);

    try {
      const res = await fetch('/api/leave/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leave_type: pendingRequest.leave_type,
          start_date: pendingRequest.start_date,
          end_date: pendingRequest.end_date,
          is_half_day: pendingRequest.is_half_day,
          working_days: pendingRequest.working_days,
          ai_generated_message: pendingRequest.professional_message,
          employee_note: pendingRequest.reason || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessages(prev => prev.map(m => m.pendingRequest ? { ...m, pendingRequest: undefined } : m));
        addMessage({ role: 'assistant', content: "Your leave request has been submitted successfully! Your manager will review it and you'll be notified of the decision." });
        setPendingRequest(null);
      } else {
        addMessage({ role: 'assistant', content: `Failed to submit request: ${data.error}` });
      }
    } catch {
      addMessage({ role: 'assistant', content: 'Failed to submit request. Please try again.' });
    } finally {
      setConfirmingLoading(false);
    }
  };

  const handleCancel = () => {
    setMessages(prev => prev.map(m => m.pendingRequest ? { ...m, pendingRequest: undefined } : m));
    setPendingRequest(null);
    addMessage({ role: 'assistant', content: 'Request cancelled. Is there anything else I can help you with?' });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-screen bg-[#212121] overflow-hidden">
      {/* Sidebar */}
      <ChatSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
        onNewChat={handleNewChat}
        onDeleteThread={handleDeleteThread}
        userFullName={userFullName}
        onSignOut={handleSignOut}
        balance={balance}
        balanceLoading={balanceLoading}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {hasMessages || loadingMessages ? (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-6 py-6">
                {loadingMessages ? (
                  <div className="flex justify-center py-12">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-[#8e8ea0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-[#8e8ea0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-[#8e8ea0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <ChatMessage
                        key={msg.id}
                        message={msg}
                        onConfirm={msg.pendingRequest ? handleConfirm : undefined}
                        onCancel={msg.pendingRequest ? handleCancel : undefined}
                        isConfirming={confirmingLoading}
                        isStreaming={msg.id === streamingMessageId}
                      />
                    ))}
                    {loading && streamingMessageId === null && (
                      <div className="flex justify-start mb-6">
                        <div className="flex gap-1 py-2">
                          <div className="w-2 h-2 bg-[#8e8ea0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-[#8e8ea0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-[#8e8ea0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input pinned at bottom */}
            <div className="flex-shrink-0 px-6 pb-6 pt-2">
              <div className="max-w-3xl mx-auto">
                <ChatInput
                  onSend={handleSend}
                  disabled={loading || confirmingLoading || loadingMessages || streamingMessageId !== null}
                  placeholder="Ask anything..."
                />
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-6">
            <div className="w-40 h-40 rounded-3xl overflow-hidden mb-8">
              <Image src="/VEONiee.png" alt="VEONiee mascot" width={160} height={160} className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-semibold text-[#ececec] mb-8">
            Hi, I&apos;m VEONie by VEON 👋
            </h1>
            <p className="text-lg font-normal text-[#ececec]/80 mb-8">
  How can I support you today?
</p>
            <div className="w-full max-w-2xl">
              <ChatInput
                onSend={handleSend}
                disabled={loading || confirmingLoading || streamingMessageId !== null}
                placeholder="Ask anything..."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
