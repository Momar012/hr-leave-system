import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ChatInterface from '@/components/chat/ChatInterface';

export default async function EmployeeChatPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'employee') {
    redirect('/manager/dashboard');
  }

  const { data: threads } = await supabase
    .from('chat_threads')
    .select('*')
    .eq('employee_id', user.id)
    .order('updated_at', { ascending: false });

  return (
    <ChatInterface
      userFullName={profile.full_name}
      userId={user.id}
      initialThreads={threads || []}
    />
  );
}
