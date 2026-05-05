'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage as ChatMessageType } from '@/types';
import { formatDate } from '@/lib/utils/workingDays';

interface ChatMessageProps {
  message: ChatMessageType;
  onConfirm?: () => void;
  onCancel?: () => void;
  isConfirming?: boolean;
  isStreaming?: boolean;
}

const mdComponents = {
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-2">
      <table className="text-sm border-collapse w-full">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="border-b border-[#3f3f3f]">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="text-left px-3 py-2 text-[#8e8ea0] font-medium text-xs uppercase tracking-wide">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-3 py-2 border-b border-[#2f2f2f] text-[#ececec]">{children}</td>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="hover:bg-[#2f2f2f]/50">{children}</tr>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-1 last:mb-0">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-[#ececec]">{children}</strong>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc list-inside space-y-0.5 ml-2">{children}</ul>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="ml-1">{children}</li>
  ),
};

export default function ChatMessage({ message, onConfirm, onCancel, isConfirming, isStreaming }: ChatMessageProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[75%]">
          <div className="bg-[#2f2f2f] text-[#ececec] rounded-2xl rounded-br-sm px-4 py-3">
            <div className="text-sm leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-6">
      <div className="max-w-[80%]">
        <div className="text-[#ececec]">
          <div className="text-sm leading-relaxed space-y-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {message.content}
            </ReactMarkdown>
          </div>
          {isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-[#ececec] ml-0.5 animate-pulse" />
          )}
        </div>

        {/* Pending request confirmation card */}
        {message.pendingRequest && message.pendingRequest.intent === 'leave_request' && onConfirm && (
          <div className="mt-3 bg-[#2f2f2f] border border-[#3f3f3f] rounded-xl p-4">
            <div className="text-xs font-semibold text-[#8e8ea0] mb-3 uppercase tracking-wide">Request Summary</div>
            <div className="space-y-1.5 text-sm text-[#ececec] mb-4">
              <div className="flex justify-between">
                <span className="text-[#8e8ea0]">Leave Type</span>
                <span className="font-medium capitalize">{message.pendingRequest.leave_type?.replace('_', ' ')}</span>
              </div>
              {message.pendingRequest.start_date && (
                <div className="flex justify-between">
                  <span className="text-[#8e8ea0]">From</span>
                  <span className="font-medium">{formatDate(message.pendingRequest.start_date)}</span>
                </div>
              )}
              {message.pendingRequest.end_date && !message.pendingRequest.is_half_day && (
                <div className="flex justify-between">
                  <span className="text-[#8e8ea0]">To</span>
                  <span className="font-medium">{formatDate(message.pendingRequest.end_date)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#8e8ea0]">Working Days</span>
                <span className="font-semibold text-[#ececec]">
                  {message.pendingRequest.is_half_day ? '0.5' : message.pendingRequest.working_days} day(s)
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onConfirm}
                disabled={isConfirming}
                className="flex-1 py-2 bg-white text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                {isConfirming ? 'Sending...' : 'Confirm & Send'}
              </button>
              <button
                onClick={onCancel}
                disabled={isConfirming}
                className="flex-1 py-2 bg-[#3f3f3f] text-[#ececec] rounded-lg text-sm font-medium hover:bg-[#4f4f4f] disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
