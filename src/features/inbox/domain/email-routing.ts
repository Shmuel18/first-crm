import type { AiMode } from '@/lib/ai/types';

import type { EmailContentKind } from '../schemas/email-triage.schema';
import type { EmailCategory, EmailStatus } from '../types';

/**
 * The routing table of ai-v2-spec.md §3.3 as a pure, unit-tested function.
 * Facts (sender match, attachments) outrank the model's content guess;
 * ambiguity NEVER auto-routes — it escalates ("לא מבין את ההקשר ⇒ הקפצה").
 */

export type EmailRoutingInput = {
  contentKind: EmailContentKind;
  /** Distinct ACTIVE cases whose borrowers carry the sender's address. */
  senderMatchedCases: number;
  /** Ingestable document attachments (non-inline, allowed type/size). */
  docAttachmentsCount: number;
  confidence: number;
  mode: AiMode;
};

export type EmailRoute = {
  category: EmailCategory;
  status: EmailStatus;
  /** Pull attachments into the case's documents (Epic 1 pipeline). */
  ingestAttachments: boolean;
};

/** Below this, even a "routine" content guess escalates to a human. */
export const TRIAGE_MIN_CONFIDENCE = 0.5;

export function routeEmail(input: EmailRoutingInput): EmailRoute {
  const category = pickCategory(input);
  const status = pickStatus(category);
  return {
    category,
    status,
    ingestAttachments:
      category === 'client_documents' && input.mode !== 'shadow' && input.docAttachmentsCount > 0,
  };
}

function pickCategory(input: EmailRoutingInput): EmailCategory {
  // Exactly one active case → the sender IS a client, whatever the model says.
  if (input.senderMatchedCases === 1) {
    return input.docAttachmentsCount > 0 ? 'client_documents' : 'client_message';
  }
  // Known address on SEVERAL active cases → a human picks the case. No guessing.
  if (input.senderMatchedCases > 1) return 'probable_client';

  // Unknown sender: low confidence collapses everything to the human queue.
  if (input.confidence < TRIAGE_MIN_CONFIDENCE) return 'unclear';

  switch (input.contentKind) {
    case 'client_correspondence':
      return 'probable_client'; // reads like a client but no address match → human
    case 'bank':
      return 'bank';
    case 'vendor_or_marketing':
      return 'vendor_or_marketing';
    case 'internal':
      return 'internal';
    case 'unclear':
      return 'unclear';
  }
}

function pickStatus(category: EmailCategory): EmailStatus {
  switch (category) {
    case 'client_documents':
      return 'auto_processed'; // docs flow into the case; failures re-flag in the service
    case 'client_message':
      return 'new'; // awaiting the advisor's eyes
    case 'probable_client':
    case 'bank':
    case 'unclear':
      return 'needs_review'; // the הקפצה queue
    case 'vendor_or_marketing':
    case 'internal':
      return 'auto_processed'; // logged, zero noise
  }
}
