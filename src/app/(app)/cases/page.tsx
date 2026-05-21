import { getTranslations } from 'next-intl/server';

import { CasesCardList } from '@/features/cases/components/cases-card-list';
import { CasesEmptyState } from '@/features/cases/components/cases-empty-state';
import { CasesTable } from '@/features/cases/components/cases-table';
import { DashboardFiltersBar } from '@/features/cases/components/dashboard-filters-bar';
import { DashboardSavedViews } from '@/features/cases/components/dashboard-saved-views';
import { DashboardViewSelector } from '@/features/cases/components/dashboard-view-selector';
import { DashboardWelcomeBanner } from '@/features/cases/components/dashboard-welcome-banner';
import { listBankOptions } from '@/features/case-banks/services/case-banks.service';
import {
  filterCases,
  parseCaseView,
  parseDashboardFilters,
} from '@/features/cases/domain/case-filters';
import {
  getCurrentProfileName,
  listAdvisorOptions,
  listCaseStatusOptions,
} from '@/features/cases/services/case-lookups.service';
import { getCaseViewCounts, listCases } from '@/features/cases/services/cases.service';
import { userHasPermission } from '@/lib/auth/permissions';
import { LeadsTable } from '@/features/leads/components/leads-table';
import { LeadsToolbar } from '@/features/leads/components/leads-toolbar';
import { countLeads, listLeads } from '@/features/leads/services/leads.service';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function EmptyMessage({ text }: { text: string }) {
  return <p className="px-6 py-12 text-center text-sm text-neutral-500">{text}</p>;
}

// Safety bound on the dashboard fetch until true server-side pagination lands.
// Well above realistic active-case counts — purely a guard against an unbounded
// query at scale. The common advisor/stage filters are pushed to SQL so the
// fetched set shrinks when they're active.
const DASHBOARD_CASE_CAP = 1000;

export default async function CasesListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const view = parseCaseView(sp);
  const filters = parseDashboardFilters(sp);

  const [
    activeCases,
    profile,
    statusOptions,
    bankOptions,
    advisorOptions,
    counts,
    leadsCount,
    canViewAll,
    t,
  ] = await Promise.all([
    listCases({
      isArchived: false,
      advisorId: filters.advisor ?? undefined,
      statusId: filters.stage ?? undefined,
      limit: DASHBOARD_CASE_CAP,
    }),
    getCurrentProfileName(),
    listCaseStatusOptions(),
    listBankOptions(),
    listAdvisorOptions(),
    getCaseViewCounts(),
    countLeads(),
    userHasPermission('view_all_cases'),
    getTranslations('dashboard'),
  ]);

  let chrome: React.ReactNode = null;
  let scrollContent: React.ReactNode;
  if (view === 'leads') {
    const leads = await listLeads();
    chrome = <LeadsToolbar assignees={advisorOptions} />;
    scrollContent =
      leads.length === 0 ? (
        <EmptyMessage text={t('viewTabs.leadsEmpty')} />
      ) : (
        <LeadsTable leads={leads} />
      );
  } else {
    const isArchive = view === 'archive';
    const cases = isArchive
      ? await listCases({
          isArchived: true,
          advisorId: filters.advisor ?? undefined,
          statusId: filters.stage ?? undefined,
          limit: DASHBOARD_CASE_CAP,
        })
      : activeCases;
    // In the archive, "hide closed & frozen" would hide exactly the cases that
    // were archived (completed / on-hold), so don't apply it there.
    const visible = filterCases(
      cases,
      isArchive ? { ...filters, hideClosedFrozen: false } : filters,
    );
    chrome = (
      <>
        <DashboardFiltersBar
          statusOptions={statusOptions}
          bankOptions={bankOptions}
          advisorOptions={advisorOptions}
          canFilterByAdvisor={canViewAll}
          isArchiveView={isArchive}
        />
        <DashboardSavedViews />
      </>
    );
    scrollContent =
      cases.length === 0 ? (
        <CasesEmptyState />
      ) : visible.length === 0 ? (
        <EmptyMessage text={t('filters.noMatches')} />
      ) : (
        <>
          {/* Narrow screens: cards (the table needs ~1100px). md+: full table. */}
          <div className="md:hidden">
            <CasesCardList cases={visible} />
          </div>
          <div className="hidden md:block">
            <CasesTable
              cases={visible}
              statusOptions={statusOptions}
              bankOptions={bankOptions}
              advisorOptions={advisorOptions}
            />
          </div>
        </>
      );
  }

  // The whole dashboard scrolls inside a viewport-height pane (under the fixed
  // 4rem topbar); the greeting/tabs/filters scroll away and only the table
  // header stays (sticky, in CasesTable). -m-6 cancels the layout p-6 so the
  // bars stay full-bleed.
  return (
    <div className="-m-6 h-[calc(100dvh_-_4rem)] overflow-auto scrollbar-thin bg-white">
      <DashboardWelcomeBanner firstName={profile?.first_name ?? ''} />
      <DashboardViewSelector
        activeCount={counts.active}
        archivedCount={counts.archived}
        leadsCount={leadsCount}
      />
      {chrome}
      {scrollContent}
    </div>
  );
}
