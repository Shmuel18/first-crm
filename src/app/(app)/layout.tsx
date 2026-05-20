import { Toaster } from 'sonner';

import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { countPendingTasksForUser } from '@/features/tasks/services/tasks.service';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const pendingTasks = await countPendingTasksForUser();

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Topbar />
      <Sidebar tasksBadge={pendingTasks} />
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
