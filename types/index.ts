export type Role = 'employee' | 'manager';

export type LeaveType = 'casual' | 'annual' | 'medical' | 'sick' | 'half_day';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  created_at: string;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  year: number;
  casual_remaining: number;
  annual_remaining: number;
  medical_remaining: number;
  sick_remaining: number;
  half_day_remaining: number;
}

export interface EmployeeWithBalance {
  id: string;
  full_name: string;
  role: Role;
  created_at: string;
  balance: LeaveBalance | null; // null = not yet configured for the year
}

export interface BalanceUpdatePayload {
  year: number;
  casual_remaining: number;
  annual_remaining: number;
  medical_remaining: number;
  sick_remaining: number;
  half_day_remaining: number;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  is_half_day: boolean;
  working_days: number;
  ai_generated_message: string | null;
  employee_note: string | null;
  status: LeaveStatus;
  created_at: string;
  profiles?: Profile;
}

export interface Notification {
  id: string;
  leave_request_id: string;
  is_read: boolean;
  created_at: string;
  leave_requests?: LeaveRequest;
}

// Chat message types
export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: Date;
  pendingRequest?: PendingLeaveRequest;
}

export interface PendingLeaveRequest {
  intent: 'leave_request' | 'balance_check' | 'general';
  leave_type?: LeaveType;
  start_date?: string;
  end_date?: string;
  is_half_day?: boolean;
  working_days?: number;
  professional_message?: string;
  requires_discussion?: boolean;
  reason?: string;
}

export interface ChatThread {
  id: string;
  employee_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface DbChatMessage {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface GPTLeaveExtraction {
  intent: 'leave_request' | 'balance_check' | 'general' | 'needs_clarification';
  leave_type?: LeaveType;
  start_date?: string;
  end_date?: string;
  is_half_day?: boolean;
  professional_message?: string;
  response?: string;
  clarifying_question?: string;
  reason?: string | null;
}
