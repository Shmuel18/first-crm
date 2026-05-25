import { Toaster } from 'sonner';
import { getLocale } from 'next-intl/server';

import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { countPendingTasksForUser } from '@/features/tasks/services/tasks.service';
import { getDirection, parseLocale } from '@/lib/i18n/direction';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const [pendingTasks, isAdminRes, rawLocale] = await Promise.all([
    countPendingTasksForUser(),
    supabase.rpc('is_admin'),
    getLocale(),
  ]);
  const dir = getDirection(parseLocale(rawLocale));

  return (
    <TooltipProvider>
      <div className="h-dvh overflow-hidden bg-[#FAFAFA]">
        <Topbar />
      <Sidebar tasksBadge={pendingTasks} isAdmin={isAdminRes.data === true} />
      {/* The inner viewport owns scrolling. Sticky subheaders compensate for
          viewport padding so they pin flush under the fixed topbar. */}
      <main className="md:ms-16 h-[calc(100dvh-4rem)] overflow-hidden">
        <div className="app-scrollbar app-scroll-viewport h-full overflow-y-auto p-4 sm:p-6">
          <div dir={dir} className="min-w-0">
            {children}
          </div>
        </div>
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
    </TooltipProvider>
  );
}
