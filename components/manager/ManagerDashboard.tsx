'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LeaveRequest, Notification } from '@/types';
import LeaveRequestCard from './LeaveRequestCard';
import NotificationBadge from './NotificationBadge';
import EmployeeBalanceConfig from './EmployeeBalanceConfig';
import EmployeeLeaveStatus from './EmployeeLeaveStatus';

interface ManagerDashboardProps {
  managerName: string;
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';
type ActiveView = 'requests' | 'configure' | 'status';

export default function ManagerDashboard({ managerName }: ManagerDashboardProps) {
  const router = useRouter();
  const supabase = createClient();

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [activeView, setActiveView] = useState<ActiveView>('requests');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/notifications');
    const data = await res.json();

    if (data.notifications) {
      const leaveRequests: LeaveRequest[] = data.notifications
        .filter((n: Notification) => n.leave_requests)
        .map((n: Notification) => n.leave_requests as LeaveRequest);

      // Deduplicate by ID (multiple notifications can reference same request)
      const seen = new Set<string>();
      const unique = leaveRequests.filter(r => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });

      setRequests(unique);
      setUnreadCount(data.unreadCount || 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    const res = await fetch(`/api/leave/${id}/approve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });

    const data = await res.json();

    if (data.success) {
      setRequests(prev =>
        prev.map(r =>
          r.id === id ? { ...r, status: data.status } : r
        )
      );
      // Unread count might decrease
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const filteredRequests = requests.filter(r => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Leave Requests</h1>
              <p className="text-xs text-gray-500">Manager Dashboard</p>
            </div>
            {unreadCount > 0 && (
              <div className="ml-2">
                <NotificationBadge count={unreadCount} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchData}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <span className="text-sm text-gray-600">{managerName}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-6">
        {/* View tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
          <button
            onClick={() => setActiveView('requests')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeView === 'requests' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Leave Requests
          </button>
          <button
            onClick={() => setActiveView('configure')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeView === 'configure' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Configure Balances
          </button>
          <button
            onClick={() => setActiveView('status')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeView === 'status' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Employee Status
          </button>
        </div>

        {activeView === 'status' ? (
          <EmployeeLeaveStatus />
        ) : activeView === 'configure' ? (
          <EmployeeBalanceConfig />
        ) : (
        <>
        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {(['all', 'pending', 'approved', 'rejected'] as FilterStatus[]).map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`bg-white rounded-xl p-4 border transition-all text-left ${
                filter === status
                  ? 'border-blue-500 ring-2 ring-blue-100'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`text-2xl font-bold mb-1 ${
                status === 'pending' ? 'text-orange-600' :
                status === 'approved' ? 'text-green-600' :
                status === 'rejected' ? 'text-red-600' :
                'text-blue-600'
              }`}>
                {counts[status]}
              </div>
              <div className="text-xs text-gray-500 capitalize">{status === 'all' ? 'Total' : status}</div>
            </button>
          ))}
        </div>

        {/* Requests Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="flex gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-xl" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded mb-2 w-32" />
                    <div className="h-3 bg-gray-100 rounded w-20" />
                  </div>
                </div>
                <div className="h-16 bg-gray-100 rounded-lg mb-4" />
                <div className="h-12 bg-gray-100 rounded-lg" />
              </div>
            ))}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-lg font-medium mb-1">No {filter !== 'all' ? filter : ''} requests</p>
            <p className="text-sm">Leave requests will appear here when employees submit them.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRequests.map(request => (
              <LeaveRequestCard
                key={request.id}
                request={request}
                onAction={handleAction}
              />
            ))}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
