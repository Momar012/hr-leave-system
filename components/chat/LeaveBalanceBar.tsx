'use client';

import { LeaveBalance } from '@/types';

interface LeaveBalanceBarProps {
  balance: LeaveBalance | null;
  loading?: boolean;
}

const leaveTypes = [
  { key: 'casual_remaining', label: 'Casual', total: 12, color: 'bg-blue-500' },
  { key: 'annual_remaining', label: 'Annual', total: 14, color: 'bg-purple-500' },
  { key: 'medical_remaining', label: 'Medical', total: 10, color: 'bg-red-500' },
  { key: 'sick_remaining', label: 'Sick', total: 10, color: 'bg-yellow-500' },
  { key: 'half_day_remaining', label: 'Half Days', total: 6, color: 'bg-green-500' },
] as const;

export default function LeaveBalanceBar({ balance, loading }: LeaveBalanceBarProps) {
  return (
    <div className="bg-white border-l border-gray-200 w-64 p-5 flex flex-col h-full">
      <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Leave Balance</h2>
      <div className="text-xs text-gray-500 mb-4">{new Date().getFullYear()}</div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-3 bg-gray-200 rounded mb-2"></div>
              <div className="h-2 bg-gray-100 rounded"></div>
            </div>
          ))}
        </div>
      ) : balance ? (
        <div className="space-y-4">
          {leaveTypes.map(({ key, label, total, color }) => {
            const remaining = balance[key];
            const pct = Math.round((remaining / total) * 100);
            return (
              <div key={key}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-gray-600">{label}</span>
                  <span className="text-xs text-gray-800 font-semibold">
                    {key === 'half_day_remaining' ? remaining : remaining}
                    <span className="text-gray-400 font-normal">/{total}</span>
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className={`${color} h-1.5 rounded-full transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-xs text-gray-400 text-center mt-8">
          Balance not available
        </div>
      )}

      <div className="mt-auto pt-6 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">Balances update upon manager approval</p>
      </div>
    </div>
  );
}
