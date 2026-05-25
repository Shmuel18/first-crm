import { getTranslations } from 'next-intl/server';

import { CasesCardList } from '@/features/cases/components/cases-card-list';
import { CasesEmptyState } from '@/features/cases/components/cases-empty-state';
import { CasesTable } from '@/features/cases/components/cases-table';
import { DashboardFiltersBar } from '@/features/cases/components/dashboard-filters-bar';
import { DashboardViewSelector } from '@/features/cases/components/dashboard-view-selector';
import { DashboardWelcomeBanner } from '@/features/cases/components/dashboard-welcome-banner';
import { listBankOptions } from '@/features/case-banks/services/case-banks.service';
import {
  filterCases,
  parseCaseView,
  parseDashboardFilters,
} from '@/features/cases/domain/case-filters';
import { applySort, parseCaseSort } from '@/features/cases/domain/case-sort';
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

// Safety bound on the dashboard fetch. Kept at 1000 for the MVP — Kaufman
// runs ~80 active cases, so a full-list-in-one-go UX beats cursor pagination
// at this scale (the user expects to scroll the whole pipeline at a glance).
// Audit-driven SQL pagination is the right move past ~300 cases; document
// the threshold here so the next person doesn't reflexively re-flag it.
// The common advisor/stage filters are pushed to SQL so the fetched set
// shrinks when they're active.
const DASHBOARD_CASE_CAP = 1000;

export default async function CasesListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const view = parseCaseView(sp);
  const filters = parseDashboardFilters(sp);
  const sort = parseCaseSort(sp);

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
        <EmptyMessage text={t('filters.noMatches')} />
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
