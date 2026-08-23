import type { ProposedAction } from '@/app/api/ai/nl-query/route';

/**
 * The exact body /api/ai/confirm-action expects for a proposed action —
 * one place, so the dashboard bar and the assistant bubble can't drift.
 * Pure: no I/O, just the discriminated mapping. The server re-validates
 * every field and re-checks permissions; this only shapes the request.
 */
export type ConfirmPayload =
  | { kind: 'change_status'; caseId: string; statusId: string }
  | { kind: 'create_task'; caseId: string; title: string }
  | { kind: 'set_target_date'; caseId: string; targetDate: string }
  | { kind: 'assign_advisor'; caseId: string; advisorId: string }
  | { kind: 'schedule_digest'; hour: number; cancel: boolean };

export function buildConfirmPayload(a: ProposedAction): ConfirmPayload {
  switch (a.kind) {
    case 'change_status':
      return { kind: a.kind, caseId: a.caseId, statusId: a.statusId };
    case 'create_task':
      return { kind: a.kind, caseId: a.caseId, title: a.title };
    case 'set_target_date':
      return { kind: a.kind, caseId: a.caseId, targetDate: a.targetDate };
    case 'assign_advisor':
      return { kind: a.kind, caseId: a.caseId, advisorId: a.advisorId };
    case 'schedule_digest':
      return { kind: a.kind, hour: a.hour, cancel: a.cancel };
  }
}
