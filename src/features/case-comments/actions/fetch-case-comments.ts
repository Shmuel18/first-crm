'use server';

import { z } from 'zod';

import { getCurrentUser } from '@/lib/auth/permissions';
import { asCaseId } from '@/lib/types/branded';

import { listCaseComments } from '../services/case-comments.service';

import type { CaseCommentView } from '../types';

const CaseIdSchema = z.uuid();

type FetchResult = { ok: true; comments: CaseCommentView[] } | { ok: false };

/**
 * Re-read the case's comment thread for the current viewer. Called by the client
 * thread when a Realtime event signals another user posted/edited/deleted — the
 * event is only the trigger; this returns the fully RLS-scoped list with author
 * names resolved (which the raw Realtime payload doesn't carry). Read-only.
 */
export async function fetchCaseCommentsAction(caseId: string): Promise<FetchResult> {
  const parsed = CaseIdSchema.safeParse(caseId);
  if (!parsed.success) return { ok: false };

  const user = await getCurrentUser();
  if (!user) return { ok: false };

  try {
    const comments = await listCaseComments(asCaseId(parsed.data));
    return { ok: true, comments };
  } catch (err) {
    console.error('[fetchCaseCommentsAction] failed', err instanceof Error ? err.message : err);
    return { ok: false };
  }
}
