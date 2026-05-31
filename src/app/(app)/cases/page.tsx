import { getTranslations } from 'next-intl/server';

import { CasesCardList } from '@/features/cases/components/cases-card-list';
import { CasesEmptyState } from '@/features/cases/components/cases-empty-state';
import { CasesTable } from '@/features/cases/components/cases-table';
import { ClearFiltersButton } from '@/features/cases/components/clear-filters-button';
import { DashboardFiltersBar } from '@/features/cases/components/dashboard-filters-bar';
import { DashboardViewSelector } from '@/features/cases/components/dashboard-view-selector';
import { DashboardWelcomeBanner } from '@/features/cases/components/dashboard-welcome-banner';
import {
  filterCases,
  parseCaseView,
  parseDashboardFilters,
} from '@/features/cases/domain/case-filters';
import { applySort, parseCaseSort } from '@/features/cases/domain/case-sort';
import { getCasesDashboardBootstrap } from '@/features/cases/services/cases-dashboard-bootstrap.service';
import { listCases } from '@/features/cases/services/cases.service';
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

export default async function CasesListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const view = parseCaseView(sp);
  const filters = parseDashboardFilters(sp);
  const sort = parseCaseSort(sp);

  const isArchive = view === 'archive';
  // Fetch the full active/archive set (no SQL pagination). At Kaufman scale
  // (~80 cases) this is one cheap query, and it lets the instant client-side
  // search (name / national-id / case-number), the column sort, and the
  // derived filters operate over EVERY case rather than only the first
  // loaded page. Revisit (move search server-side) only if the book ever
  // grows into the many hundreds.
  const casesPromise =
    view === 'leads'
      ? null
      : timeAsync(
          'cases.page.listCases',
          () =>
            listCases({
              isArchived: isArchive,
              advisorId: filters.advisor ?? undefined,
              statusId: filters.stage ?? undefined,
            }),
          { view },
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
    if (!casesPromise) throw new Error('cases page data was not requested');
    const cases = await casesPromise;
    // In the archive, "hide closed & frozen" would hide exactly the cases that
    // were archived (completed / on-hold), so don't apply it there.
    //
    // Derived filters (stuck, hideClosedFrozen), the column sort, and the
    // header search box all operate over the full set fetched above.
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
    scrollContent =
      cases.length === 0 ? (
        <CasesEmptyState />
      ) : visible.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-neutral-500">{t('filters.noMatches')}</p>
          <div className="mt-4 flex justify-center">
            <ClearFiltersButton label={t('filters.clearFilters')} />
          </div>
        </div>
      ) : (
        <>
          {/* Cards up to ~iPad landscape; the table needs ~1100px of comfort
              width, so we only switch at xl (1280px). Between md (768) and
              xl the table used to horizontally-scroll without indication,
              clipping the bank + advisor columns out of sight. */}
          <div className="xl:hidden">
            <CasesCardList cases={visible} canViewAll={canViewAll} />
          </div>
          <div className="hidden xl:block">
            <CasesTable
              cases={visible}
              statusOptions={statusOptions}
              bankOptions={bankOptions}
              advisorOptions={advisorOptions}
              canViewAll={canViewAll}
            />
          </div>
        </>
      );
  }

  // The (app) layout's <main> is the scroll viewport now, so the dashboard
  // just goes full-bleed by cancelling the layout's p-6 with -m-6. Sticky
  // bits (the table header) anchor to the layout's scroll container.
  return (
    <div className="-m-4 sm:-m-6 bg-white">
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
