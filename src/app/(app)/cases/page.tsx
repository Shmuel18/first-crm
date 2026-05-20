import { getTranslations } from 'next-intl/server';

import { CasesEmptyState } from '@/features/cases/components/cases-empty-state';
import { CasesTable } from '@/features/cases/components/cases-table';
import { DashboardFiltersBar } from '@/features/cases/components/dashboard-filters-bar';
import { DashboardSavedViews } from '@/features/cases/components/dashboard-saved-views';
import { DashboardSummaryBar } from '@/features/cases/components/dashboard-summary-bar';
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
  getCurrentUserId,
  listAdvisorOptions,
  listCaseStatusOptions,
} from '@/features/cases/services/case-lookups.service';
import { countNewThisWeek, countStuck } from '@/features/cases/domain/case-state';
import { getCaseViewCounts, listCases } from '@/features/cases/services/cases.service';
import { LeadsTable } from '@/features/leads/components/leads-table';
import { LeadsToolbar } from '@/features/leads/components/leads-toolbar';
import { countLeads, listLeads } from '@/features/leads/services/leads.service';

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

  const [
    activeCases,
    profile,
    statusOptions,
    bankOptions,
    advisorOptions,
    currentUserId,
    counts,
    leadsCount,
    t,
  ] = await Promise.all([
    listCases({ isArchived: false }),
    getCurrentProfileName(),
    listCaseStatusOptions(),
    listBankOptions(),
    listAdvisorOptions(),
    getCurrentUserId(),
    getCaseViewCounts(),
    countLeads(),
    getTranslations('dashboard'),
  ]);

  let body: React.ReactNode;
  if (view === 'leads') {
    const leads = await listLeads();
    body = (
      <div className="bg-white">
        <LeadsToolbar assignees={advisorOptions} />
        {leads.length === 0 ? (
          <EmptyMessage text={t('viewTabs.leadsEmpty')} />
        ) : (
          <LeadsTable leads={leads} />
        )}
      </div>
    );
  } else {
    const cases = view === 'archive' ? await listCases({ isArchived: true }) : activeCases;
    const visible = filterCases(cases, filters, currentUserId);
    body = (
      <>
        <DashboardFiltersBar statusOptions={statusOptions} bankOptions={bankOptions} />
        <DashboardSavedViews />
        <DashboardSummaryBar
          total={cases.length}
          showing={visible.length}
          stuck={countStuck(cases)}
          newThisWeek={countNewThisWeek(cases)}
        />
        <div className="bg-white">
          {cases.length === 0 ? (
            <CasesEmptyState />
          ) : visible.length === 0 ? (
            <EmptyMessage text={t('filters.noMatches')} />
          ) : (
            <CasesTable
              cases={visible}
              statusOptions={statusOptions}
              bankOptions={bankOptions}
              advisorOptions={advisorOptions}
            />
          )}
        </div>
      </>
    );
  }

  return (
    <div className="-mx-6 -mt-6" dir="rtl">
      <DashboardWelcomeBanner
        firstName={profile?.first_name ?? ''}
        casesCount={counts.active}
        stuckCount={countStuck(activeCases)}
      />
      <DashboardViewSelector
        activeCount={counts.active}
        archivedCount={counts.archived}
        leadsCount={leadsCount}
      />
      {body}
    </div>
  );
}
