import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
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

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

    // Fetch leave requests for the employee in the given year
    const { data: requests, error: requestsError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', params.id)
      .gte('start_date', `${year}-01-01`)
      .lte('start_date', `${year}-12-31`)
      .order('created_at', { ascending: false });

    if (requestsError) {
      console.error('Error fetching requests:', requestsError);
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }

    // Fetch leave balance for the employee and year
    const { data: balance } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', params.id)
      .eq('year', year)
      .single();

    return NextResponse.json({
      requests: requests || [],
      balance: balance || null,
      year,
    });
  } catch (error) {
    console.error('GET /api/employees/[id]/requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
