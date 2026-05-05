import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
import { LeaveType } from '@/types';

const BALANCE_KEY_MAP: Record<LeaveType, string> = {
  casual: 'casual_remaining',
  annual: 'annual_remaining',
  medical: 'medical_remaining',
  sick: 'sick_remaining',
  half_day: 'half_day_remaining',
};

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify manager role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { action } = await request.json(); // 'approve' or 'reject'
    const leaveId = params.id;

    // Fetch the leave request
    const { data: leaveRequest, error: fetchError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', leaveId)
      .single();

    if (fetchError || !leaveRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    if (leaveRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Leave request is no longer pending' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Update leave request status
    const { error: updateError } = await supabase
      .from('leave_requests')
      .update({ status: newStatus })
      .eq('id', leaveId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }

    // If approving, deduct balance
    if (action === 'approve') {
      const currentYear = new Date(leaveRequest.start_date).getFullYear();
      const balanceKey = BALANCE_KEY_MAP[leaveRequest.leave_type as LeaveType];

      // Fetch current balance
      const { data: balance } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', leaveRequest.employee_id)
        .eq('year', currentYear)
        .single();

      if (balance) {
        const currentValue = balance[balanceKey] as number;
        const deduction = leaveRequest.is_half_day ? 0.5 : leaveRequest.working_days;
        const newValue = Math.max(0, currentValue - deduction);

        await supabase
          .from('leave_balances')
          .update({ [balanceKey]: newValue })
          .eq('employee_id', leaveRequest.employee_id)
          .eq('year', currentYear);
      }
    }

    // Mark related notification as read
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('leave_request_id', leaveId);

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error('Approve API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
