import { getTranslations } from 'next-intl/server';

import { CasesCardList } from '@/features/cases/components/cases-card-list';
import { CasesEmptyState } from '@/features/cases/components/cases-empty-state';
import { CasesTable } from '@/features/cases/components/cases-table';
import { DashboardFiltersBar } from '@/features/cases/components/dashboard-filters-bar';
import { DashboardPagination } from '@/features/cases/components/dashboard-pagination';
import { DashboardViewSelector } from '@/features/cases/components/dashboard-view-selector';
import { DashboardWelcomeBanner } from '@/features/cases/components/dashboard-welcome-banner';
import {
  filterCases,
  parseCasePage,
  parseCaseView,
  parseDashboardFilters,
} from '@/features/cases/domain/case-filters';
import { applySort, parseCaseSort } from '@/features/cases/domain/case-sort';
import { getCasesDashboardBootstrap } from '@/features/cases/services/cases-dashboard-bootstrap.service';
import { listCasesPaged } from '@/features/cases/services/cases.service';
import { LeadsCardList } from '@/features/leads/components/leads-card-list';
import { LeadsTable } from '@/features/leads/components/leads-table';
import { LeadsToolbar } from '@/features/leads/components/leads-toolbar';
import { listLeads } from '@/features/leads/services/leads.service';
import { timeAsync } from '@/lib/perf/timing';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function EmptyMessage({ text }: { text: string }) {
  return <p className="px-6 py-12 text-center text-sm text-neutral-500">{text}</p>;
}

// Page size for SQL pagination. 50 picks up the next round of the pipeline
// without a noticeable hop on scroll — Kaufman runs ~80 active cases, so
// most days the second page is empty and the pager doesn't render at all.
// Tune up if the dashboard ever holds substantially more cases per advisor.
const DASHBOARD_PAGE_SIZE = 50;

export default async function CasesListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const view = parseCaseView(sp);
  const filters = parseDashboardFilters(sp);
  const sort = parseCaseSort(sp);
  const page = parseCasePage(sp);

  const isArchive = view === 'archive';
  const pagePromise =
    view === 'leads'
      ? null
      : timeAsync(
          'cases.page.listCasesPaged',
          () =>
            listCasesPaged({
              isArchived: isArchive,
              advisorId: filters.advisor ?? undefined,
              statusId: filters.stage ?? undefined,
              page,
              pageSize: DASHBOARD_PAGE_SIZE,
            }),
          { view, page },
        );
  const leadsPromise =
    view === 'leads' ? timeAsync('cases.page.listLeads', () => listLeads(), { view }) : null;

  const [bootstrap, t, leads] = await Promise.all([
    timeAsync('cases.page.bootstrap', () => getCasesDashboardBootstrap(), { view }),
    getTranslations('dashboard'),
    leadsPromise,
  ]);

  const {
    profile,
    statusOptions,
    bankOptions,
    advisorOptions,
    counts,
    leadsCount,
    canViewAll,
  } = bootstrap;

  let chrome: React.ReactNode = null;
  let scrollContent: React.ReactNode;
  if (view === 'leads') {
    const leadRows = leads ?? [];
    chrome = <LeadsToolbar assignees={advisorOptions} />;
    scrollContent =
      leadRows.length === 0 ? (
        <EmptyMessage text={t('viewTabs.leadsEmpty')} />
      ) : (
        <>
          {/* Same breakpoint as the cases dashboard: the table needs ~900px
              of comfort width, so switch to cards below xl. */}
          <div className="xl:hidden">
            <LeadsCardList leads={leadRows} />
          </div>
          <div className="hidden xl:block">
            <LeadsTable leads={leadRows} />
          </div>
        </>
      );
  } else {
    if (!pagePromise) throw new Error('cases page data was not requested');
    const pageRes = await pagePromise;
    const cases = pageRes.rows;
    const totalCount = pageRes.totalCount;
    const totalPages = Math.max(1, Math.ceil(totalCount / DASHBOARD_PAGE_SIZE));
    // In the archive, "hide closed & frozen" would hide exactly the cases that
    // were archived (completed / on-hold), so don't apply it there.
    //
    // Derived filters (stuck, hideClosedFrozen) and sort run on the current
    // page only — at 50 rows/page the user can scan a page and move on.
    // Pagination tracks the SQL count, not the derived-visible count, so
    // "page 2 of 3" stays stable across re-filters.
    const visible = applySort(
      filterCases(cases, isArchive ? { ...filters, hideClosedFrozen: false } : filters),
      sort,
      statusOptions,
    );
    chrome = (
      <DashboardFiltersBar
        statusOptions={statusOptions}
        bankOptions={bankOptions}
        advisorOptions={advisorOptions}
        canFilterByAdvisor={canViewAll}
        isArchiveView={isArchive}
      />
    );
    const pager = (
      <DashboardPagination
        currentPage={page}
        totalPages={totalPages}
        pageSize={DASHBOARD_PAGE_SIZE}
        totalCount={totalCount}
      />
    );
    scrollContent =
      cases.length === 0 ? (
        <CasesEmptyState />
      ) : visible.length === 0 ? (
        <>
          <EmptyMessage text={t('filters.noMatches')} />
          {pager}
        </>
      ) : (
        <>
          {/* Cards up to ~iPad landscape; the table needs ~1100px of comfort
              width, so we only switch at xl (1280px). Between md (768) and
              xl the table used to horizontally-scroll without indication,
              clipping the bank + advisor columns out of sight. */}
          <div className="xl:hidden">
            <CasesCardList cases={visible} />
          </div>
          <div className="hidden xl:block">
            <CasesTable
              cases={visible}
              statusOptions={statusOptions}
              bankOptions={bankOptions}
              advisorOptions={advisorOptions}
            />
          </div>
          {pager}
        </>
      );
  }

  // The (app) layout's <main> is the scroll viewport now, so the dashboard
  // just goes full-bleed by cancelling the layout's p-6 with -m-6. Sticky
  // bits (the table header) anchor to the layout's scroll container.
  return (
    <div className="-m-6 bg-white">
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
