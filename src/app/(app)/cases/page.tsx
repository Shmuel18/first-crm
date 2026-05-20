import { getTranslations } from 'next-intl/server';

import { CasesEmptyState } from '@/features/cases/components/cases-empty-state';
import { CasesTable } from '@/features/cases/components/cases-table';
import { DashboardFiltersBar } from '@/features/cases/components/dashboard-filters-bar';
import { DashboardSavedViews } from '@/features/cases/components/dashboard-saved-views';
import { DashboardSummaryBar } from '@/features/cases/components/dashboard-summary-bar';
import { DashboardViewSelector } from '@/features/cases/components/dashboard-view-selector';
import { DashboardWelcomeBanner } from '@/features/cases/components/dashboard-welcome-banner';
import { listBankOptions } from '@/features/case-banks/services/case-banks.service';
import { filterCases, parseDashboardFilters } from '@/features/cases/domain/case-filters';
import {
  getCurrentProfileName,
  getCurrentUserId,
  listAdvisorOptions,
  listCaseStatusOptions,
} from '@/features/cases/services/case-lookups.service';
import { countNewThisWeek, countStuck } from '@/features/cases/domain/case-state';
import { listCases } from '@/features/cases/services/cases.service';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CasesListPage({ searchParams }: Props) {
  const filters = parseDashboardFilters(await searchParams);

  const [cases, profile, statusOptions, bankOptions, advisorOptions, currentUserId, t] =
    await Promise.all([
      listCases({ isArchived: false }),
      getCurrentProfileName(),
      listCaseStatusOptions(),
      listBankOptions(),
      listAdvisorOptions(),
      getCurrentUserId(),
      getTranslations('dashboard'),
    ]);

  const visible = filterCases(cases, filters, currentUserId);
  const firstName = profile?.first_name ?? '';
  const stuckCount = countStuck(cases);
  const newThisWeek = countNewThisWeek(cases);

  return (
    <div className="-mx-6 -mt-6" dir="rtl">
      <DashboardWelcomeBanner
        firstName={firstName}
        casesCount={cases.length}
        stuckCount={stuckCount}
      />
      <DashboardViewSelector activeCount={cases.length} />
      <DashboardFiltersBar statusOptions={statusOptions} bankOptions={bankOptions} />
      <DashboardSavedViews />
      <DashboardSummaryBar
        total={cases.length}
        showing={visible.length}
        stuck={stuckCount}
        newThisWeek={newThisWeek}
      />

      <div className="bg-white">
        {cases.length === 0 ? (
          <CasesEmptyState />
        ) : visible.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-neutral-500">{t('filters.noMatches')}</p>
        ) : (
          <CasesTable
            cases={visible}
            statusOptions={statusOptions}
            bankOptions={bankOptions}
            advisorOptions={advisorOptions}
          />
        )}
      </div>
    </div>
  );
}
