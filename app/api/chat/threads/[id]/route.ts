import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate ownership via RLS — this will return empty if not owned
    const { data: thread } = await supabase
      .from('chat_threads')
      .select('id')
      .eq('id', params.id)
      .eq('employee_id', user.id)
      .single();

    if (!thread) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', params.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ messages: messages || [] });
  } catch (error) {
    console.error('Thread GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('chat_threads')
      .delete()
      .eq('id', params.id)
      .eq('employee_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Thread DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
