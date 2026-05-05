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

    // Verify manager role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select(`
        *,
        leave_requests (
          *,
          profiles (
            full_name
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }

    const unreadCount = notifications?.filter((n: { is_read: boolean }) => !n.is_read).length || 0;

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Notifications API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
