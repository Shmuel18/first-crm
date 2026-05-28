import { Toaster } from 'sonner';
import { getLocale } from 'next-intl/server';

import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getDirection, parseLocale } from '@/lib/i18n/direction';
import { getLayoutBootstrap } from '@/lib/layout/bootstrap';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Single RPC round-trip for is_admin + pending tasks + profile + notifications
  // (migration 066). `cache()` dedupes across AppLayout → Topbar → Sidebar so
  // each child reads the same envelope without re-firing the call.
  const [bootstrap, rawLocale] = await Promise.all([getLayoutBootstrap(), getLocale()]);
  const dir = getDirection(parseLocale(rawLocale));

  return (
    <TooltipProvider>
      <div className="h-dvh overflow-hidden bg-brand-surface">
        <Topbar tasksBadge={bootstrap.pendingTasks} criticalTasksBadge={bootstrap.criticalTasks} />
        <Sidebar tasksBadge={bootstrap.pendingTasks} criticalTasksBadge={bootstrap.criticalTasks} />
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
