import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentYear = new Date().getFullYear();

    const { data: balance, error } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', user.id)
      .eq('year', currentYear)
      .single();

    if (error) {
      // If no balance found, create one with defaults
      if (error.code === 'PGRST116') {
        const { data: newBalance, error: createError } = await supabase
          .from('leave_balances')
          .insert({ employee_id: user.id, year: currentYear })
          .select()
          .single();

        if (createError) {
          return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 });
        }

        return NextResponse.json({ balance: newBalance });
      }

      return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 });
    }

    return NextResponse.json({ balance });
  } catch (error) {
    console.error('Balance API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
