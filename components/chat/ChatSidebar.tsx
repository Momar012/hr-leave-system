'use client';

import { useState } from 'react';
import { ChatThread, LeaveBalance } from '@/types';

interface ChatSidebarProps {
  threads: ChatThread[];
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewChat: () => void;
  onDeleteThread: (id: string) => void;
  userFullName: string;
  onSignOut: () => void;
  balance: LeaveBalance | null;
  balanceLoading: boolean;
}

const leaveTypes = [
  { key: 'casual_remaining' as const, label: 'C', total: 12 },
  { key: 'annual_remaining' as const, label: 'A', total: 14 },
  { key: 'medical_remaining' as const, label: 'M', total: 10 },
  { key: 'sick_remaining' as const, label: 'S', total: 10 },
] as const;

function groupThreads(threads: ChatThread[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);

  const today: ChatThread[] = [];
  const yesterday: ChatThread[] = [];
  const older: ChatThread[] = [];

  for (const t of threads) {
    const d = new Date(t.updated_at);
    if (d >= todayStart) today.push(t);
    else if (d >= yesterdayStart) yesterday.push(t);
    else older.push(t);
  }

  return { today, yesterday, older };
}

export default function ChatSidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  userFullName,
  onSignOut,
  balance,
  balanceLoading,
}: ChatSidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { today, yesterday, older } = groupThreads(threads);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    setDeletingId(id);
    await onDeleteThread(id);
    setDeletingId(null);
  };

  const ThreadItem = ({ thread }: { thread: ChatThread }) => {
    const isActive = thread.id === activeThreadId;
    const isHovered = hoveredId === thread.id;
    const isDeleting = deletingId === thread.id;

    return (
      <button
        onClick={() => onSelectThread(thread.id)}
        onMouseEnter={() => setHoveredId(thread.id)}
        onMouseLeave={() => setHoveredId(null)}
        disabled={isDeleting}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-colors group ${
          isActive ? 'bg-[#2f2f2f]' : 'hover:bg-[#2f2f2f]'
        }`}
      >
        <span className="text-sm text-[#ececec] truncate flex-1 min-w-0">
          {thread.title}
        </span>
        {(isHovered || isActive) && (
          <span
            onClick={(e) => handleDelete(e, thread.id)}
            className="flex-shrink-0 p-1 rounded hover:bg-[#3f3f3f] transition-colors text-[#8e8ea0] hover:text-[#ececec]"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </span>
        )}
      </button>
    );
  };

  const SectionLabel = ({ label }: { label: string }) => (
    <div className="px-3 py-1 text-xs font-medium text-[#8e8ea0] mt-3 mb-1">{label}</div>
  );

  return (
    <div className="flex flex-col h-full w-[260px] bg-[#171717] flex-shrink-0">
      {/* Brand */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-[#ececec]">VEONie</span>
        </div>
      </div>

      {/* New Chat */}
      <div className="px-3 pb-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#ececec] hover:bg-[#2f2f2f] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New chat
        </button>
      </div>

      <div className="border-t border-[#3f3f3f]" />

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
        {threads.length === 0 ? (
          <div className="px-3 py-4 text-xs text-[#8e8ea0] text-center">No conversations yet</div>
        ) : (
          <>
            {today.length > 0 && (
              <>
                <SectionLabel label="Today" />
                {today.map((t) => <ThreadItem key={t.id} thread={t} />)}
              </>
            )}
            {yesterday.length > 0 && (
              <>
                <SectionLabel label="Yesterday" />
                {yesterday.map((t) => <ThreadItem key={t.id} thread={t} />)}
              </>
            )}
            {older.length > 0 && (
              <>
                <SectionLabel label="Older" />
                {older.map((t) => <ThreadItem key={t.id} thread={t} />)}
              </>
            )}
          </>
        )}
      </div>

      <div className="border-t border-[#3f3f3f]" />

      {/* Balance pills */}
      <div className="px-4 py-3">
        <div className="text-xs text-[#8e8ea0] mb-2">Leave balance</div>
        {balanceLoading ? (
          <div className="flex gap-1.5 flex-wrap">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-6 w-14 bg-[#2f2f2f] rounded-full animate-pulse" />
            ))}
          </div>
        ) : balance ? (
          <div className="flex gap-1.5 flex-wrap">
            {leaveTypes.map(({ key, label }) => {
              const remaining = balance[key];
              const isLow = remaining <= 2;
              return (
                <div
                  key={key}
                  className="flex items-center gap-1 bg-[#2f2f2f] border border-[#3f3f3f] rounded-full px-2.5 py-0.5 text-xs"
                >
                  <span className="text-[#8e8ea0]">{label}</span>
                  <span className={`font-semibold ${isLow ? 'text-red-400' : 'text-[#ececec]'}`}>
                    {remaining}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-[#8e8ea0]">Not available</div>
        )}
      </div>

      <div className="border-t border-[#3f3f3f]" />

      {/* User footer */}
      <div className="px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-[#2f2f2f] border border-[#3f3f3f] flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-[#ececec]">
              {userFullName.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-sm text-[#ececec] truncate">{userFullName}</span>
        </div>
        <button
          onClick={onSignOut}
          className="text-xs text-[#8e8ea0] hover:text-[#ececec] transition-colors flex-shrink-0 ml-2"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
