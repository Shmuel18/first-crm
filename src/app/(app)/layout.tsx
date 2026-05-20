import { Toaster } from 'sonner';

import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { countPendingTasksForUser } from '@/features/tasks/services/tasks.service';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const [pendingTasks, isAdminRes] = await Promise.all([
    countPendingTasksForUser(),
    supabase.rpc('is_admin'),
  ]);

  return (
    <div className="min-h-dvh bg-[#FAFAFA]">
      <Topbar />
      <Sidebar tasksBadge={pendingTasks} isAdmin={isAdminRes.data === true} />
      <main className="md:ms-16 p-6">{children}</main>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: { fontFamily: 'var(--font-sans)' },
        }}
        closeButton
        richColors
      />
    </div>
  );
}
