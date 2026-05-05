import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: threads, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('employee_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ threads: threads || [] });
  } catch (error) {
    console.error('Threads GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title } = await request.json();

    const { data: thread, error } = await supabase
      .from('chat_threads')
      .insert({ employee_id: user.id, title: title || 'New conversation' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ thread });
  } catch (error) {
    console.error('Threads POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
