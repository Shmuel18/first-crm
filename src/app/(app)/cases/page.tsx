import { CasesEmptyState } from '@/features/cases/components/cases-empty-state';
import { CasesTable } from '@/features/cases/components/cases-table';
import { DashboardFiltersBar } from '@/features/cases/components/dashboard-filters-bar';
import { DashboardSavedViews } from '@/features/cases/components/dashboard-saved-views';
import { DashboardSummaryBar } from '@/features/cases/components/dashboard-summary-bar';
import { DashboardViewSelector } from '@/features/cases/components/dashboard-view-selector';
import { DashboardWelcomeBanner } from '@/features/cases/components/dashboard-welcome-banner';
import { countNewThisWeek, countStuck } from '@/features/cases/domain/case-state';
import { listCases } from '@/features/cases/services/cases.service';
import { createClient } from '@/lib/supabase/server';

export default async function CasesListPage() {
  const supabase = await createClient();

  const [cases, profile, statusOptions, bankOptions, advisorOptions] = await Promise.all([
    listCases({ isArchived: false }),
    fetchCurrentProfile(supabase),
    fetchStatusOptions(supabase),
    fetchBankOptions(supabase),
    fetchAdvisorOptions(supabase),
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

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function fetchCurrentProfile(supabase: SupabaseClient) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', data.user.id)
    .single();
  return profile;
}

async function fetchStatusOptions(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('case_statuses')
    .select('id, name_he, color')
    .eq('is_active', true)
    .order('sort_order');
  return data ?? [];
}

async function fetchBankOptions(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('banks')
    .select('id, name_he, color, logo_url')
    .eq('is_active', true)
    .order('sort_order');
  return data ?? [];
}

async function fetchAdvisorOptions(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('is_active', true)
    .order('first_name');
  return data ?? [];
}
