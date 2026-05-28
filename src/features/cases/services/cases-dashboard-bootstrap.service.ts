import { createClient } from '@/lib/supabase/server';

import type { BankOption } from '@/features/case-banks/services/case-banks.service';
import type {
  AdvisorOption,
  ProfileName,
  StatusOption,
} from '@/features/cases/services/case-lookups.service';
import type { CaseViewCounts } from '@/features/cases/services/cases.service';

type BootstrapEnvelope = {
  authenticated?: boolean;
  profile?: ProfileName | null;
  status_options?: StatusOption[];
  bank_options?: BankOption[];
  advisor_options?: AdvisorOption[];
  counts?: Partial<CaseViewCounts> | null;
  leads_count?: number | null;
  can_view_all?: boolean | null;
};

export type CasesDashboardBootstrap = {
  profile: ProfileName | null;
  statusOptions: StatusOption[];
  bankOptions: BankOption[];
  advisorOptions: AdvisorOption[];
  counts: CaseViewCounts;
  leadsCount: number;
  canViewAll: boolean;
};

const EMPTY_BOOTSTRAP: CasesDashboardBootstrap = {
  profile: null,
  statusOptions: [],
  bankOptions: [],
  advisorOptions: [],
  counts: { active: 0, archived: 0 },
  leadsCount: 0,
  canViewAll: false,
};

export async function getCasesDashboardBootstrap(): Promise<CasesDashboardBootstrap> {
  const supabase = await createClient();
  const callBootstrap = supabase.rpc as unknown as (
    fn: 'cases_dashboard_bootstrap',
  ) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;
  const { data, error } = await callBootstrap('cases_dashboard_bootstrap');

  if (error || !data) {
    if (error) {
      console.error('[cases-dashboard-bootstrap] rpc failed', {
        code: error.code,
        message: error.message,
      });
    }
    return EMPTY_BOOTSTRAP;
  }

  const envelope = data as BootstrapEnvelope;
  const counts = envelope.counts ?? {};

  return {
    profile: envelope.profile ?? null,
    statusOptions: Array.isArray(envelope.status_options) ? envelope.status_options : [],
    bankOptions: Array.isArray(envelope.bank_options) ? envelope.bank_options : [],
    advisorOptions: Array.isArray(envelope.advisor_options) ? envelope.advisor_options : [],
    counts: {
      active: Number(counts.active ?? 0),
      archived: Number(counts.archived ?? 0),
    },
    leadsCount: Number(envelope.leads_count ?? 0),
    canViewAll: envelope.can_view_all === true,
  };
}
