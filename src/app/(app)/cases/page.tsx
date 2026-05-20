import { CasesEmptyState } from '@/features/cases/components/cases-empty-state';
import { CasesTable } from '@/features/cases/components/cases-table';
import { DashboardFiltersBar } from '@/features/cases/components/dashboard-filters-bar';
import { DashboardSavedViews } from '@/features/cases/components/dashboard-saved-views';
import { DashboardSummaryBar } from '@/features/cases/components/dashboard-summary-bar';
import { DashboardViewSelector } from '@/features/cases/components/dashboard-view-selector';
import { DashboardWelcomeBanner } from '@/features/cases/components/dashboard-welcome-banner';
import { listBankOptions } from '@/features/case-banks/services/case-banks.service';
import {
  getCurrentProfileName,
  listAdvisorOptions,
  listCaseStatusOptions,
} from '@/features/cases/services/case-lookups.service';
import { countNewThisWeek, countStuck } from '@/features/cases/domain/case-state';
import { listCases } from '@/features/cases/services/cases.service';

export default async function CasesListPage() {
  const [cases, profile, statusOptions, bankOptions, advisorOptions] = await Promise.all([
    listCases({ isArchived: false }),
    getCurrentProfileName(),
    listCaseStatusOptions(),
    listBankOptions(),
    listAdvisorOptions(),
  ]);

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
      <DashboardFiltersBar />
      <DashboardSavedViews />
      <DashboardSummaryBar total={cases.length} stuck={stuckCount} newThisWeek={newThisWeek} />

      <div className="bg-white">
        {cases.length === 0 ? (
          <CasesEmptyState />
        ) : (
          <CasesTable
            cases={cases}
            statusOptions={statusOptions}
            bankOptions={bankOptions}
            advisorOptions={advisorOptions}
          />
        )}
      </div>
    </div>
  );
}
