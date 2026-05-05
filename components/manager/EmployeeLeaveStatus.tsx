'use client';

import { useState, useEffect, useCallback } from 'react';
import { EmployeeWithBalance, LeaveRequest, LeaveBalance } from '@/types';
import { formatDate } from '@/lib/utils/workingDays';

const CURRENT_YEAR = new Date().getFullYear();

type FieldKey = 'casual_remaining' | 'annual_remaining' | 'medical_remaining' | 'sick_remaining' | 'half_day_remaining';

const FIELDS: { key: FieldKey; label: string; color: string; leaveType: string }[] = [
  { key: 'casual_remaining',   label: 'Casual',   color: 'bg-blue-100 text-blue-800 border-blue-200',     leaveType: 'casual' },
  { key: 'annual_remaining',   label: 'Annual',   color: 'bg-green-100 text-green-800 border-green-200',   leaveType: 'annual' },
  { key: 'medical_remaining',  label: 'Medical',  color: 'bg-purple-100 text-purple-800 border-purple-200', leaveType: 'medical' },
  { key: 'sick_remaining',     label: 'Sick',     color: 'bg-red-100 text-red-800 border-red-200',         leaveType: 'sick' },
  { key: 'half_day_remaining', label: 'Half Day', color: 'bg-orange-100 text-orange-800 border-orange-200', leaveType: 'half_day' },
];

const SHORT_LABEL: Record<FieldKey, string> = {
  casual_remaining:   'Cas',
  annual_remaining:   'Ann',
  medical_remaining:  'Med',
  sick_remaining:     'Sick',
  half_day_remaining: 'Half',
};

const LEAVE_TYPE_COLORS: Record<string, string> = {
  casual:   'bg-blue-100 text-blue-700',
  annual:   'bg-purple-100 text-purple-700',
  medical:  'bg-red-100 text-red-700',
  sick:     'bg-yellow-100 text-yellow-700',
  half_day: 'bg-green-100 text-green-700',
};

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  cls: 'bg-orange-100 text-orange-700' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
};

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

interface EmployeeDetails {
  requests: LeaveRequest[];
  balance: LeaveBalance | null;
}

export default function EmployeeLeaveStatus() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [employees, setEmployees] = useState<EmployeeWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [details, setDetails] = useState<Record<string, EmployeeDetails>>({});
  const [loadState, setLoadState] = useState<Record<string, LoadState>>({});

  const fetchEmployees = useCallback(async (y: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/employees?year=${y}`);
      const data = await res.json();
      if (data.employees) {
        setEmployees(data.employees);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Reset details when year changes to force re-fetch
    setDetails({});
    setLoadState({});
    setExpanded({});
    fetchEmployees(year);
  }, [year, fetchEmployees]);

  const toggleExpand = async (empId: string) => {
    const isOpen = !!expanded[empId];

    if (!isOpen && !details[empId] && loadState[empId] !== 'loading') {
      // Lazy-load on first expand
      setExpanded(prev => ({ ...prev, [empId]: true }));
      setLoadState(prev => ({ ...prev, [empId]: 'loading' }));
      try {
        const res = await fetch(`/api/employees/${empId}/requests?year=${year}`);
        const data = await res.json();
        if (res.ok) {
          setDetails(prev => ({ ...prev, [empId]: { requests: data.requests, balance: data.balance } }));
          setLoadState(prev => ({ ...prev, [empId]: 'loaded' }));
        } else {
          setLoadState(prev => ({ ...prev, [empId]: 'error' }));
        }
      } catch {
        setLoadState(prev => ({ ...prev, [empId]: 'error' }));
      }
    } else {
      setExpanded(prev => ({ ...prev, [empId]: !isOpen }));
    }
  };

  function computeConsumed(requests: LeaveRequest[], leaveType: string): number {
    return requests
      .filter(r => r.leave_type === leaveType && r.status === 'approved')
      .reduce((sum, r) => sum + (r.is_half_day ? 0.5 : r.working_days), 0);
  }

  function formatShortDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00Z');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Employee Leave Status</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Year:</label>
          <select
            value={year}
            onChange={e => setYear(parseInt(e.target.value, 10))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={CURRENT_YEAR - 1}>{CURRENT_YEAR - 1}</option>
            <option value={CURRENT_YEAR}>{CURRENT_YEAR}</option>
            <option value={CURRENT_YEAR + 1}>{CURRENT_YEAR + 1}</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-xl" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-40 mb-2" />
                  <div className="flex gap-2">
                    {[...Array(5)].map((_, j) => (
                      <div key={j} className="h-5 bg-gray-100 rounded-full w-14" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium">No employees found</p>
          <p className="text-sm mt-1">Employees will appear here once they register.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {employees.map(emp => {
            const isOpen = !!expanded[emp.id];
            const state = loadState[emp.id] || 'idle';
            const empDetails = details[emp.id];

            return (
              <div key={emp.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Collapsed row */}
                <button
                  onClick={() => toggleExpand(emp.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {initials(emp.full_name)}
                  </div>

                  {/* Name + chips */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 mb-1">{emp.full_name}</p>
                    {emp.balance === null ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                        Not configured
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {FIELDS.map(f => (
                          <span key={f.key} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${f.color}`}>
                            {SHORT_LABEL[f.key]}: {emp.balance![f.key]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Chevron */}
                  <svg
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded panel */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                    {state === 'loading' && (
                      <div className="flex items-center justify-center py-8">
                        <svg className="w-6 h-6 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span className="ml-2 text-sm text-gray-500">Loading…</span>
                      </div>
                    )}

                    {state === 'error' && (
                      <p className="text-sm text-red-500 py-4">Failed to load data. Please try again.</p>
                    )}

                    {state === 'loaded' && empDetails && (
                      <>
                        {/* Section A — Balance Summary */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-5">
                          {FIELDS.map(f => {
                            const remaining = empDetails.balance ? empDetails.balance[f.key] : null;
                            const consumed = computeConsumed(empDetails.requests, f.leaveType);
                            return (
                              <div key={f.key} className={`rounded-lg p-3 border ${f.color}`}>
                                <p className="text-xs font-semibold mb-1">{f.label}</p>
                                {remaining === null ? (
                                  <p className="text-xs text-gray-400">Not configured</p>
                                ) : (
                                  <>
                                    <p className="text-sm font-bold">{remaining} remaining</p>
                                    <p className="text-xs opacity-75 mt-0.5">{consumed} consumed</p>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Section B — Leave Request History */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <p className="text-sm font-semibold text-gray-700">Leave History</p>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              {empDetails.requests.length} request{empDetails.requests.length !== 1 ? 's' : ''}
                            </span>
                          </div>

                          {empDetails.requests.length === 0 ? (
                            <p className="text-sm text-gray-400 py-4 text-center">No leave requests this year</p>
                          ) : (
                            <div className="space-y-2">
                              {empDetails.requests.map(req => {
                                const leaveColor = LEAVE_TYPE_COLORS[req.leave_type] || 'bg-gray-100 text-gray-700';
                                const statusCfg = STATUS_CONFIG[req.status] || { label: req.status, cls: 'bg-gray-100 text-gray-700' };
                                const reason = req.ai_generated_message
                                  ? req.ai_generated_message.slice(0, 120) + (req.ai_generated_message.length > 120 ? '…' : '')
                                  : req.employee_note
                                  ? req.employee_note.slice(0, 120) + (req.employee_note.length > 120 ? '…' : '')
                                  : null;

                                return (
                                  <div key={req.id} className="flex flex-wrap items-start gap-3 bg-gray-50 rounded-lg px-3 py-2.5 text-sm">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${leaveColor}`}>
                                      {req.leave_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.cls}`}>
                                      {statusCfg.label}
                                    </span>
                                    <span className="text-gray-700 text-xs">
                                      {req.is_half_day
                                        ? formatShortDate(req.start_date)
                                        : `${formatShortDate(req.start_date)} – ${formatShortDate(req.end_date)}`}
                                    </span>
                                    <span className="text-gray-500 text-xs">
                                      {req.is_half_day ? 'Half day' : `${req.working_days} day${req.working_days !== 1 ? 's' : ''}`}
                                    </span>
                                    {reason ? (
                                      <span className="text-gray-500 text-xs italic flex-1">{reason}</span>
                                    ) : (
                                      <span className="text-gray-400 text-xs italic flex-1">No reason provided</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
