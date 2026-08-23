import type { DashboardFilters } from './case-filters';
import type { NlQueryOutput } from '../schemas/nl-query.schema';

/**
 * Deterministic resolution of the model's NL-query output to dashboard URL
 * params (ai-v2-spec.md §5.1). Pure and tested: names → ids happens HERE by
 * exact/normalized matching, never by the model. An ambiguous or unknown name
 * becomes an `unresolved` entry — surfaced to the user, never guessed.
 */

export type NlLookups = {
  statuses: ReadonlyArray<{ id: string; key: string; name_he: string }>;
  advisors: ReadonlyArray<{ id: string; name: string }>;
  banks: ReadonlyArray<{ id: string; name: string }>;
};

export type NlChip =
  | { kind: 'view'; value: 'archive' }
  | { kind: 'stage' | 'advisor' | 'bank' | 'q'; value: string }
  | { kind: 'targetDate'; value: 'overdue' | 'week' | 'none' };

export type NlResolved = {
  /** Params in the dashboard's own URL vocabulary. */
  params: {
    view: 'active' | 'archive';
    stage: string | null;
    advisor: string | null;
    bank: string | null;
    targetDate: 'overdue' | 'week' | 'none' | null;
    q: string | null;
  };
  chips: NlChip[];
  /** Names that matched zero or several options — shown, never guessed. */
  unresolved: Array<{ kind: 'advisor' | 'bank' | 'stage'; value: string }>;
};

const normalize = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Unique normalized-substring match (either direction), else null. */
function matchOne<T extends { id: string }>(
  options: ReadonlyArray<T>,
  label: (o: T) => string,
  raw: string,
): T | null {
  const needle = normalize(raw);
  if (!needle) return null;
  const hits = options.filter((o) => {
    const hay = normalize(label(o));
    return hay === needle || hay.includes(needle) || needle.includes(hay);
  });
  return hits.length === 1 ? hits[0]! : null;
}

export function resolveNlQuery(out: NlQueryOutput, lookups: NlLookups): NlResolved {
  const chips: NlChip[] = [];
  const unresolved: NlResolved['unresolved'] = [];
  const params: NlResolved['params'] = {
    view: out.view === 'archive' ? 'archive' : 'active',
    stage: null,
    advisor: null,
    bank: null,
    targetDate: out.target_date,
    q: out.client_search?.trim() || null,
  };

  if (params.view === 'archive') chips.push({ kind: 'view', value: 'archive' });

  if (out.status_key && out.status_key !== '__none__') {
    const status = lookups.statuses.find((s) => s.key === out.status_key);
    if (status) {
      params.stage = status.id;
      chips.push({ kind: 'stage', value: status.name_he });
    } else {
      unresolved.push({ kind: 'stage', value: out.status_key });
    }
  }

  if (out.advisor_name?.trim()) {
    const advisor = matchOne(lookups.advisors, (a) => a.name, out.advisor_name);
    if (advisor) {
      params.advisor = advisor.id;
      chips.push({ kind: 'advisor', value: advisor.name });
    } else {
      unresolved.push({ kind: 'advisor', value: out.advisor_name.trim() });
    }
  }

  if (out.bank_name?.trim()) {
    const bank = matchOne(lookups.banks, (b) => b.name, out.bank_name);
    if (bank) {
      params.bank = bank.id;
      chips.push({ kind: 'bank', value: bank.name });
    } else {
      unresolved.push({ kind: 'bank', value: out.bank_name.trim() });
    }
  }

  if (params.targetDate) chips.push({ kind: 'targetDate', value: params.targetDate });
  if (params.q) chips.push({ kind: 'q', value: params.q });

  return { params, chips, unresolved };
}

/**
 * The stage adjacent to the case's CURRENT one, in the office's own order
 * (the statuses array is pre-sorted by sort_order). Powers "advance to the
 * next stage" / "back a stage": the model can't know the current status at
 * translation time, so it emits a direction and this resolves the concrete
 * target. Null at the boundary (already first/last) or when the current
 * status isn't found — the caller turns that into a helpful message.
 */
export function adjacentStatus(
  statuses: NlLookups['statuses'],
  currentId: string | null,
  direction: 'next' | 'prev',
): { id: string; name_he: string } | null {
  if (!currentId) return null;
  const idx = statuses.findIndex((s) => s.id === currentId);
  if (idx < 0) return null;
  const target = statuses[direction === 'next' ? idx + 1 : idx - 1];
  return target ? { id: target.id, name_he: target.name_he } : null;
}

/** The dashboard URL that applies exactly these filters (nuqs-compatible). */
export function buildDashboardUrl(params: NlResolved['params']): string {
  const sp = new URLSearchParams();
  if (params.view === 'archive') sp.set('view', 'archive');
  if (params.stage) sp.set('stage', params.stage);
  if (params.advisor) sp.set('advisor', params.advisor);
  if (params.bank) sp.set('bank', params.bank);
  if (params.targetDate) sp.set('targetDate', params.targetDate);
  if (params.q) sp.set('q', params.q);
  const query = sp.toString();
  return query ? `/cases?${query}` : '/cases';
}

/** The DashboardFilters shape filterCases() consumes (same pipeline as the page). */
export function toDashboardFilters(params: NlResolved['params']): DashboardFilters {
  return {
    advisor: params.advisor,
    stage: params.stage,
    bank: params.bank,
    referrer: null,
    insuranceAgent: null,
    targetDate: params.targetDate,
  };
}
