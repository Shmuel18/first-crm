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
    <div className="h-dvh overflow-hidden bg-[#FAFAFA]">
      <Topbar />
      <Sidebar tasksBadge={pendingTasks} isAdmin={isAdminRes.data === true} />
      {/* Only this main element scrolls — height is the viewport minus the
          fixed topbar (h-16 = 4rem). The browser-chrome scrollbar stays
          hidden; users see a slim branded scrollbar inside this region. */}
      <main className="md:ms-16 p-6 h-[calc(100dvh-4rem)] overflow-y-auto scrollbar-thin">
        {children}
      </main>
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
