'use client';

import { useState, useEffect, useCallback } from 'react';
import { EmployeeWithBalance, BalanceUpdatePayload } from '@/types';

const CURRENT_YEAR = new Date().getFullYear();

const DEFAULTS: Omit<BalanceUpdatePayload, 'year'> = {
  casual_remaining: 12,
  annual_remaining: 14,
  medical_remaining: 10,
  sick_remaining: 10,
  half_day_remaining: 6,
};

type FieldKey = keyof Omit<BalanceUpdatePayload, 'year'>;

const FIELDS: { key: FieldKey; label: string; color: string }[] = [
  { key: 'casual_remaining',    label: 'Casual',   color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { key: 'annual_remaining',    label: 'Annual',   color: 'bg-green-100 text-green-800 border-green-200' },
  { key: 'medical_remaining',   label: 'Medical',  color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { key: 'sick_remaining',      label: 'Sick',     color: 'bg-red-100 text-red-800 border-red-200' },
  { key: 'half_day_remaining',  label: 'Half Day', color: 'bg-orange-100 text-orange-800 border-orange-200' },
];

const SHORT_LABEL: Record<FieldKey, string> = {
  casual_remaining:   'Cas',
  annual_remaining:   'Ann',
  medical_remaining:  'Med',
  sick_remaining:     'Sick',
  half_day_remaining: 'Half',
};

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function EmployeeBalanceConfig() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [employees, setEmployees] = useState<EmployeeWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, Record<FieldKey, number>>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  const [errors, setErrors] = useState<Record<string, Record<FieldKey, string>>>({});

  const fetchEmployees = useCallback(async (y: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/employees?year=${y}`);
      const data = await res.json();
      if (data.employees) {
        setEmployees(data.employees);
        // Seed drafts from fetched balances (don't overwrite existing edits)
        setDrafts(prev => {
          const next = { ...prev };
          for (const emp of data.employees as EmployeeWithBalance[]) {
            if (!next[emp.id]) {
              next[emp.id] = emp.balance
                ? {
                    casual_remaining:   emp.balance.casual_remaining,
                    annual_remaining:   emp.balance.annual_remaining,
                    medical_remaining:  emp.balance.medical_remaining,
                    sick_remaining:     emp.balance.sick_remaining,
                    half_day_remaining: emp.balance.half_day_remaining,
                  }
                : { ...DEFAULTS };
            }
          }
          return next;
        });
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Reset drafts when year changes so inputs re-seed from new data
    setDrafts({});
    fetchEmployees(year);
  }, [year, fetchEmployees]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const setDraftField = (empId: string, field: FieldKey, raw: string) => {
    const num = parseInt(raw, 10);
    setDrafts(prev => ({
      ...prev,
      [empId]: { ...prev[empId], [field]: isNaN(num) ? 0 : num },
    }));
    // Clear error for field on change
    setErrors(prev => {
      const empErrors = { ...(prev[empId] || {}) };
      delete empErrors[field];
      return { ...prev, [empId]: empErrors };
    });
  };

  const validate = (empId: string): boolean => {
    const draft = drafts[empId] || {};
    const fieldErrors: Record<string, string> = {};
    for (const { key } of FIELDS) {
      const v = draft[key];
      if (!Number.isInteger(v) || v < 0 || v > 365) {
        fieldErrors[key] = 'Must be 0–365';
      }
    }
    setErrors(prev => ({ ...prev, [empId]: fieldErrors as Record<FieldKey, string> }));
    return Object.keys(fieldErrors).length === 0;
  };

  const handleSave = async (empId: string) => {
    if (!validate(empId)) return;

    setSaveStatus(prev => ({ ...prev, [empId]: 'saving' }));
    try {
      const draft = drafts[empId];
      const payload: BalanceUpdatePayload = { year, ...draft };
      const res = await fetch(`/api/employees/${empId}/balance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus(prev => ({ ...prev, [empId]: 'saved' }));
        // Update local employee balance so chips reflect saved values
        setEmployees(prev =>
          prev.map(e => e.id === empId ? { ...e, balance: data.balance } : e)
        );
        setTimeout(() => setSaveStatus(prev => ({ ...prev, [empId]: 'idle' })), 2000);
      } else {
        setSaveStatus(prev => ({ ...prev, [empId]: 'error' }));
      }
    } catch {
      setSaveStatus(prev => ({ ...prev, [empId]: 'error' }));
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Configure Leave Balances</h2>
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
            const draft = drafts[emp.id] || (emp.balance ? {
              casual_remaining:   emp.balance.casual_remaining,
              annual_remaining:   emp.balance.annual_remaining,
              medical_remaining:  emp.balance.medical_remaining,
              sick_remaining:     emp.balance.sick_remaining,
              half_day_remaining: emp.balance.half_day_remaining,
            } : { ...DEFAULTS });
            const status = saveStatus[emp.id] || 'idle';
            const empErrors = errors[emp.id] || {};

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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
                      {FIELDS.map(f => (
                        <div key={f.key}>
                          <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                          <input
                            type="number"
                            min={0}
                            max={365}
                            value={draft[f.key] ?? ''}
                            onChange={e => setDraftField(emp.id, f.key, e.target.value)}
                            className={`w-full text-sm text-gray-900 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              empErrors[f.key] ? 'border-red-400 bg-red-50' : 'border-gray-200'
                            }`}
                          />
                          {empErrors[f.key] && (
                            <p className="text-xs text-red-500 mt-0.5">{empErrors[f.key]}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Save button + status */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleSave(emp.id)}
                        disabled={status === 'saving'}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
                      >
                        {status === 'saving' ? 'Saving…' : 'Save Balance'}
                      </button>

                      {status === 'saving' && (
                        <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      )}

                      {status === 'saved' && (
                        <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Saved
                        </span>
                      )}

                      {status === 'error' && (
                        <span className="text-sm text-red-600 font-medium">Failed to save. Try again.</span>
                      )}
                    </div>
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
