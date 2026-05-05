import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EmployeeWithBalance } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);

    // Fetch all employees
    const { data: employees, error: empError } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .eq('role', 'employee')
      .order('full_name');

    if (empError) {
      return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
    }

    if (!employees || employees.length === 0) {
      return NextResponse.json({ employees: [], year });
    }

    const employeeIds = employees.map(e => e.id);

    // Fetch leave balances for those employees + year
    const { data: balances } = await supabase
      .from('leave_balances')
      .select('*')
      .in('employee_id', employeeIds)
      .eq('year', year);

    const balanceMap = new Map((balances || []).map(b => [b.employee_id, b]));

    const result: EmployeeWithBalance[] = employees.map(emp => ({
      ...emp,
      balance: balanceMap.get(emp.id) ?? null,
    }));

    return NextResponse.json({ employees: result, year });
  } catch (error) {
    console.error('GET /api/employees error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
