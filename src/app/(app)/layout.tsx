import { Suspense } from 'react';

import { Toaster } from 'sonner';
import { getLocale, getTranslations } from 'next-intl/server';

import { BottomNav } from '@/components/layout/bottom-nav';
import { NavProgress } from '@/components/layout/nav-progress';
import { RouteFocus } from '@/components/layout/route-focus';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AiAssistantGate } from '@/features/ai-assistant';
import { InstallBanner } from '@/features/pwa/components/install-banner';
import { TaskBadgeAppSync } from '@/features/tasks/components/task-badge-app-sync';
import { TaskBadgeProvider } from '@/features/tasks/components/task-badge-provider';
import { TaskNudge } from '@/features/tasks/components/task-nudge';
import { isCurrentUserTimeTracked } from '@/features/time-clock/services/time-clock.service';
import { isCurrentUserOwner } from '@/lib/auth/permissions';
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

  // The tithe ledger (mig 240) and the time clock (241) are the OWNER's, not
  // every manager's. Only an admin can be the owner, so non-admins never pay
  // for the extra round-trip.
  const isOwner = bootstrap.isAdmin && (await isCurrentUserOwner());
  const canViewMaaser = isOwner;

  // Time-clock nav: the owner always (he runs the board); tracked hourly staff
  // via a cheap own-profile read, which the owner short-circuits past.
  const canUseTimeClock =
    isOwner || (bootstrap.authenticated && (await isCurrentUserTimeTracked()));

  return (
    <TooltipProvider>
      {/* The bootstrap counts SEED the badge; the provider keeps them honest
          between server renders (a soft navigation reuses this layout, so a
          task assigned by a colleague would otherwise never reach the rail). */}
      <TaskBadgeProvider
        seed={{ pending: bootstrap.pendingTasks, critical: bootstrap.criticalTasks }}
      >
      <div className="h-full overflow-hidden bg-brand-surface">
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
          isManager={bootstrap.isAdmin}
          canViewCollections={bootstrap.canViewCollections}
          canUseTimeClock={canUseTimeClock}
          canViewInbox={bootstrap.canViewInbox}
          canViewMaaser={canViewMaaser}
        />
        <BottomNav
          isManager={bootstrap.isAdmin}
          canViewCollections={bootstrap.canViewCollections}
          canUseTimeClock={canUseTimeClock}
          canViewInbox={bootstrap.canViewInbox}
          canViewMaaser={canViewMaaser}
        />
      {/* The inner viewport owns scrolling. Sticky subheaders compensate for
          viewport padding so they pin flush under the fixed topbar. */}
      <main
        id="main-content"
        tabIndex={-1}
        className="md:ms-16 h-[calc(100%-4rem)] overflow-hidden outline-none"
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
      <TaskBadgeAppSync />
      {/* "Moishy" nudge for stale tasks — streams its own query, never
          blocks the shell. Shows at most once a day (capped client-side). */}
      <Suspense fallback={null}>
        <TaskNudge />
      </Suspense>
      {/* Global AI assistant — self-gates on permission + AI flags, streams
          its own checks under Suspense so it never delays the shell. */}
      <Suspense fallback={null}>
        <AiAssistantGate />
      </Suspense>
      </div>
      </TaskBadgeProvider>
    </TooltipProvider>
  );
}
