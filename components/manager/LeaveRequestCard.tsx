'use client';

import { useState } from 'react';
import { LeaveRequest } from '@/types';
import { formatDate } from '@/lib/utils/workingDays';

interface LeaveRequestCardProps {
  request: LeaveRequest;
  onAction: (id: string, action: 'approve' | 'reject') => Promise<void>;
}

const LEAVE_TYPE_COLORS: Record<string, string> = {
  casual: 'bg-blue-100 text-blue-700',
  annual: 'bg-purple-100 text-purple-700',
  medical: 'bg-red-100 text-red-700',
  sick: 'bg-yellow-100 text-yellow-700',
  half_day: 'bg-green-100 text-green-700',
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', class: 'bg-orange-100 text-orange-700' },
  approved: { label: 'Approved', class: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', class: 'bg-red-100 text-red-700' },
};

export default function LeaveRequestCard({ request, onAction }: LeaveRequestCardProps) {
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null);

  const handleAction = async (action: 'approve' | 'reject') => {
    setActionLoading(action);
    await onAction(request.id, action);
    setActionLoading(null);
  };

  const statusConfig = STATUS_CONFIG[request.status];
  const leaveTypeColor = LEAVE_TYPE_COLORS[request.leave_type] || 'bg-gray-100 text-gray-700';
  const employeeName = request.profiles?.full_name || 'Unknown Employee';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 font-semibold text-sm">
            {employeeName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-gray-900">{employeeName}</div>
            <div className="text-xs text-gray-500">
              {new Date(request.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${leaveTypeColor}`}>
            {request.leave_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.class}`}>
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Dates */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="text-xs text-gray-500 mb-0.5">From</div>
            <div className="font-medium text-gray-800 text-xs">{formatDate(request.start_date)}</div>
          </div>
          {!request.is_half_day && (
            <div>
              <div className="text-xs text-gray-500 mb-0.5">To</div>
              <div className="font-medium text-gray-800 text-xs">{formatDate(request.end_date)}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-gray-500 mb-0.5">Duration</div>
            <div className="font-semibold text-blue-700">
              {request.is_half_day ? '0.5' : request.working_days} day(s)
            </div>
          </div>
        </div>
      </div>

      {/* AI Message */}
      {request.ai_generated_message && (
        <div className="mb-4">
          <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Employee Message</div>
          <p className="text-sm text-gray-700 italic bg-blue-50 rounded-lg p-3 border-l-2 border-blue-300">
            &ldquo;{request.ai_generated_message}&rdquo;
          </p>
        </div>
      )}

      {/* Actions */}
      {request.status === 'pending' && (
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => handleAction('approve')}
            disabled={actionLoading !== null}
            className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {actionLoading === 'approve' ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            Approve
          </button>
          <button
            onClick={() => handleAction('reject')}
            disabled={actionLoading !== null}
            className="flex-1 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {actionLoading === 'reject' ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            Reject
          </button>
        </div>
      )}

      {request.status === 'approved' && (
        <div className="flex items-center gap-2 text-green-600 text-sm font-medium pt-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Approved — Balance deducted
        </div>
      )}

      {request.status === 'rejected' && (
        <div className="flex items-center gap-2 text-red-600 text-sm font-medium pt-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Rejected
        </div>
      )}
    </div>
  );
}
