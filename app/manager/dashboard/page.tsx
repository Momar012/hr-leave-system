import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ManagerDashboard from '@/components/manager/ManagerDashboard';

export default async function ManagerDashboardPage() {
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

  if (!profile || profile.role !== 'manager') {
    redirect('/employee/chat');
  }

  return (
    <ManagerDashboard managerName={profile.full_name} />
  );
}
