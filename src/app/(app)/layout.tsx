import { Suspense } from 'react';

import { Toaster } from 'sonner';
import { getLocale, getTranslations } from 'next-intl/server';

import { BottomNav } from '@/components/layout/bottom-nav';
import { NavProgress } from '@/components/layout/nav-progress';
import { RouteFocus } from '@/components/layout/route-focus';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppBadgeSync } from '@/features/pwa/components/app-badge-sync';
import { InstallBanner } from '@/features/pwa/components/install-banner';
import { getDirection, parseLocale } from '@/lib/i18n/direction';
import { getLayoutBootstrap } from '@/lib/layout/bootstrap';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Single RPC round-trip for is_admin + pending tasks + profile + notifications
  // (migration 066). `cache()` dedupes across AppLayout → Topbar → Sidebar so
  // each child reads the same envelope without re-firing the call.
  const [bootstrap, rawLocale, t] = await Promise.all([
    getLayoutBootstrap(),
    getLocale(),
    getTranslations('nav'),
  ]);
  const dir = getDirection(parseLocale(rawLocale));

  return (
    <TooltipProvider>
      <div className="h-dvh overflow-hidden bg-brand-surface">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[100] focus:rounded-lg focus:bg-brand-black focus:px-4 focus:py-2 focus:text-sm focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-gold"
        >
          {t('skipToContent')}
        </a>
        <RouteFocus />
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <Topbar />
        <Sidebar
          tasksBadge={bootstrap.pendingTasks}
          criticalTasksBadge={bootstrap.criticalTasks}
          isManager={bootstrap.isAdmin}
          canViewCollections={bootstrap.canViewCollections}
        />
        <BottomNav
          tasksBadge={bootstrap.pendingTasks}
          criticalTasksBadge={bootstrap.criticalTasks}
          isManager={bootstrap.isAdmin}
          canViewCollections={bootstrap.canViewCollections}
        />
      {/* The inner viewport owns scrolling. Sticky subheaders compensate for
          viewport padding so they pin flush under the fixed topbar. */}
      <main
        id="main-content"
        tabIndex={-1}
        className="md:ms-16 h-[calc(100dvh-4rem)] overflow-hidden outline-none"
      >
        <div className="app-scrollbar app-scroll-viewport h-full overflow-y-auto p-4 sm:p-6 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-6">
          <div dir={dir} className="min-w-0">
            {children}
          </div>
        </div>
      </main>
      <Toaster
        position="bottom-center"
        mobileOffset={{ bottom: '5rem' }}
        toastOptions={{
          style: { fontFamily: 'var(--font-sans)' },
        }}
        closeButton
        richColors
      />
      <InstallBanner />
      <AppBadgeSync count={bootstrap.pendingTasks} />
      </div>
    </TooltipProvider>
  );
}
