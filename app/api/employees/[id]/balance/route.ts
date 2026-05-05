import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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

    // Verify target employee exists and is an employee (not manager)
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', params.id)
      .single();

    if (!targetProfile) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (targetProfile.role !== 'employee') {
      return NextResponse.json({ error: 'Cannot edit balance for non-employee accounts' }, { status: 400 });
    }

    const body = await request.json();
    const { year, casual_remaining, annual_remaining, medical_remaining, sick_remaining, half_day_remaining } = body;

    // Validate year
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

    // Validate balance fields
    const fields = { casual_remaining, annual_remaining, medical_remaining, sick_remaining, half_day_remaining };
    for (const [key, val] of Object.entries(fields)) {
      if (!Number.isInteger(val) || val < 0 || val > 365) {
        return NextResponse.json({ error: `Invalid value for ${key}` }, { status: 400 });
      }
    }

    // Upsert the balance row using service role to bypass RLS
    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: upserted, error: upsertError } = await adminClient
      .from('leave_balances')
      .upsert(
        {
          employee_id: params.id,
          year,
          casual_remaining,
          annual_remaining,
          medical_remaining,
          sick_remaining,
          half_day_remaining,
        },
        { onConflict: 'employee_id,year' }
      )
      .select()
      .single();

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      return NextResponse.json({ error: 'Failed to save balance' }, { status: 500 });
    }

    return NextResponse.json({ success: true, balance: upserted });
  } catch (error) {
    console.error('PUT /api/employees/[id]/balance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
