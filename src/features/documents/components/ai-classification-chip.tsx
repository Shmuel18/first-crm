'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Check, Loader2, Sparkles, TriangleAlert, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { resolveDocumentClassificationAction } from '../actions/resolve-document-classification';
import type {
  DocumentAiClassification,
  DocumentCategoryRow,
  DocumentWithRelations,
} from '../types';

/**
 * The two visible faces of a classification run (ai-v2-spec.md §2.6):
 *  - AiSuggestionChip — amber "AI suggests: X" with accept/reject, shown on
 *    uncategorized documents awaiting a verdict.
 *  - AiFlagsBadge — a quiet warning triangle when the AI flagged an issue
 *    (stale / name mismatch / ...), shown on any document row.
 * Both read the LATEST run only (the service select limits to 1).
 */

export function latestClassification(
  doc: DocumentWithRelations,
): DocumentAiClassification | null {
  return doc.ai_classifications?.[0] ?? null;
}

function flagList(cls: DocumentAiClassification): string[] {
  return Array.isArray(cls.flags) ? cls.flags.filter((f): f is string => typeof f === 'string') : [];
}

export function AiSuggestionChip({
  doc,
  categories,
  canEdit,
  onResolved,
}: {
  doc: DocumentWithRelations;
  categories: DocumentCategoryRow[];
  canEdit: boolean;
  onResolved?: (verdict: 'accepted' | 'rejected') => void;
}) {
  const t = useTranslations('documents.ai');
  const router = useRouter();
  const [busy, setBusy] = useState<'accepted' | 'rejected' | null>(null);
  const [done, setDone] = useState(false);

  const cls = latestClassification(doc);
  if (done || !cls || cls.decision !== 'suggested' || cls.resolution !== null) return null;

  const category = categories.find((c) => c.id === cls.suggested_category_id);
  if (!category) return null;

  const resolve = async (verdict: 'accepted' | 'rejected') => {
    if (busy) return;
    setBusy(verdict);
    const res = await resolveDocumentClassificationAction(cls.id, verdict);
    setBusy(null);
    if (!res.ok) {
      toast.error(t('resolveFailed'));
      return;
    }
    setDone(true);
    onResolved?.(verdict);
    router.refresh();
  };

  return (
    <div
      className="flex items-center gap-1.5 rounded-md border border-brand-gold-dark/40 bg-brand-gold-soft px-2 py-1"
      title={cls.reason ?? undefined}
    >
      <Sparkles className="size-3.5 text-brand-gold-text shrink-0" />
      <span className="text-xs text-neutral-800 truncate">
        {t('suggests', { category: category.name_he, confidence: Math.round(cls.confidence * 100) })}
      </span>
      {canEdit && (
        <span className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            aria-label={t('accept')}
            disabled={busy !== null}
            onClick={() => resolve('accepted')}
            className="flex size-6 items-center justify-center rounded hover:bg-brand-gold/25 text-brand-gold-text disabled:opacity-50"
          >
            {busy === 'accepted' ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          </button>
          <button
            type="button"
            aria-label={t('reject')}
            disabled={busy !== null}
            onClick={() => resolve('rejected')}
            className="flex size-6 items-center justify-center rounded hover:bg-neutral-200 text-neutral-500 disabled:opacity-50"
          >
            {busy === 'rejected' ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
          </button>
        </span>
      )}
    </div>
  );
}

export function AiFlagsBadge({ doc }: { doc: DocumentWithRelations }) {
  const t = useTranslations('documents.ai');
  const cls = latestClassification(doc);
  if (!cls) return null;
  const flags = flagList(cls);
  if (flags.length === 0) return null;

  const label = flags
    .map((f) => {
      // Unknown/legacy flag keys degrade to the raw key instead of crashing i18n.
      try {
        return t(`flags.${f}`);
      } catch {
        return f;
      }
    })
    .join(' · ');

  return (
    <span
      className="inline-flex items-center gap-1 text-amber-700"
      title={cls.reason ? `${label} — ${cls.reason}` : label}
    >
      <TriangleAlert className="size-3.5 shrink-0" />
    </span>
  );
}
