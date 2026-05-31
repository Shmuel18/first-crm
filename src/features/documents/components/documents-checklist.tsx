'use client';

import { useMemo, useState } from 'react';

import { CheckCircle2, ClipboardList, Clock, FileWarning, Pencil, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { Locale } from '@/lib/i18n/direction';

import type {
  ChecklistStatus,
  DocumentChecklistItem,
} from '../services/document-checklist.service';
import type { DriveFolder } from '../types';

type Props = {
  items: ReadonlyArray<DocumentChecklistItem>;
  locale: Locale;
  /** Opens the upload modal pre-targeted at this folder. Passed from the page. */
  onUploadToFolder: (folder: DriveFolder) => void;
  /** Opens the editable checklist manager modal. */
  onManage: () => void;
};

/**
 * Per-case document-requirements checklist surfaced at the top of the
 * /cases/[id]/documents page. Reads from getCaseDocumentChecklist (which
 * joins case_type_documents → document_categories → case_statuses) and
 * groups items by status:
 *
 *   - "missing" — required docs not yet uploaded; the actionable bucket
 *   - "in progress" — uploaded but unverified; folded into a counter
 *   - "verified" — done; folded into a counter
 *
 * Default view shows only the missing-required block so the user's eye
 * lands on the next thing to chase. A toggle reveals every item (incl.
 * optional / recommended) for full visibility.
 */
export function DocumentsChecklist({ items, locale, onUploadToFolder, onManage }: Props) {
  const t = useTranslations('documents.checklist');
  const [showAll, setShowAll] = useState(false);

  const { missing, summary } = useMemo(() => groupItems(items), [items]);

  const visible = showAll ? items : missing;

  return (
    <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-sm">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-100 bg-neutral-50/70">
        <div className="flex items-center gap-2.5 min-w-0">
          <ClipboardList aria-hidden="true" className="size-5 text-brand-gold-text shrink-0" />
          <h2 className="font-display text-sm font-semibold text-neutral-950">
            {t('title')}
          </h2>
          <SummaryChips
            missing={summary.missingRequired}
            pending={summary.pending}
            verified={summary.verified}
            t={t}
          />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {summary.total > summary.missingRequired && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-xs text-brand-gold-text hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
            >
              {showAll ? t('showMissingOnly') : t('showAll', { total: summary.total })}
            </button>
          )}
          <button
            type="button"
            onClick={onManage}
            aria-label={t('manage.open')}
            className="inline-flex items-center gap-1 text-xs text-brand-gold-text hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            {t('manage.open')}
          </button>
        </div>
      </header>

      <div className="p-2.5">
        {items.length === 0 ? (
          <p className="text-center py-6 text-sm text-neutral-500">{t('manage.empty')}</p>
        ) : visible.length === 0 ? (
          <p className="text-center py-6 text-sm text-emerald-700 inline-flex items-center justify-center gap-2 w-full">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {t('allDone')}
          </p>
        ) : (
          <ul className="space-y-1">
            {visible.map((item) => (
              <ChecklistRow
                key={item.categoryId}
                item={item}
                locale={locale}
                onUpload={onUploadToFolder}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type TFn = ReturnType<typeof useTranslations>;

function SummaryChips({
  missing,
  pending,
  verified,
  t,
}: {
  missing: number;
  pending: number;
  verified: number;
  t: TFn;
}) {
  return (
    <span className="hidden sm:inline-flex items-center gap-1.5 text-xs">
      {missing > 0 && (
        <Chip color="rose" label={t('chip.missing', { count: missing })} />
      )}
      {pending > 0 && (
        <Chip color="amber" label={t('chip.pending', { count: pending })} />
      )}
      {verified > 0 && (
        <Chip color="emerald" label={t('chip.verified', { count: verified })} />
      )}
    </span>
  );
}

const CHIP_COLORS: Record<'rose' | 'amber' | 'emerald', string> = {
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function Chip({ color, label }: { color: 'rose' | 'amber' | 'emerald'; label: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${CHIP_COLORS[color]}`}
    >
      {label}
    </span>
  );
}

function ChecklistRow({
  item,
  locale,
  onUpload,
}: {
  item: DocumentChecklistItem;
  locale: Locale;
  onUpload: (folder: DriveFolder) => void;
}) {
  const t = useTranslations('documents.checklist');
  const name = locale === 'he' ? item.nameHe : item.nameEn;
  const stageName =
    item.requiredAtStage &&
    (locale === 'he' ? item.requiredAtStage.name_he : item.requiredAtStage.name_en);

  return (
    <li className="flex items-center gap-3 rounded-md border border-neutral-100 bg-white px-3 py-2.5">
      <StatusIcon status={item.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm text-neutral-900 truncate">{name}</span>
          {!item.isRequired && (
            <span className="text-[10px] text-neutral-500 uppercase tracking-wide shrink-0">
              {t('optional')}
            </span>
          )}
          {stageName && item.status === 'missing' && (
            <span className="text-[11px] text-neutral-500 shrink-0">
              · {t('dueAtStage', { stage: stageName })}
            </span>
          )}
          {item.uploadedCount > 0 && item.status !== 'verified' && (
            <span className="text-[11px] text-neutral-500 shrink-0">
              · {t('uploadedCount', { count: item.uploadedCount })}
            </span>
          )}
        </div>
      </div>
      {item.status === 'missing' && item.driveFolder && (
        <button
          type="button"
          onClick={() => onUpload(item.driveFolder!)}
          className="shrink-0 text-xs text-brand-gold-text hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
        >
          {t('uploadCta')}
        </button>
      )}
    </li>
  );
}

const STATUS_ICON: Record<ChecklistStatus, { Icon: typeof CheckCircle2; cls: string }> = {
  missing: { Icon: FileWarning, cls: 'text-rose-500' },
  pending: { Icon: Clock, cls: 'text-amber-500' },
  rejected: { Icon: XCircle, cls: 'text-rose-600' },
  verified: { Icon: CheckCircle2, cls: 'text-emerald-600' },
};

function StatusIcon({ status }: { status: ChecklistStatus }) {
  const { Icon, cls } = STATUS_ICON[status];
  return <Icon aria-hidden="true" className={`size-4 shrink-0 ${cls}`} />;
}

function groupItems(items: ReadonlyArray<DocumentChecklistItem>) {
  // "Outstanding" = anything still missing (not yet uploaded), INCLUDING
  // manually-added requirements (which aren't flagged `isRequired`). Without
  // dropping the isRequired filter, an added requirement fell out of the
  // default view entirely and the block falsely showed "all collected ✓".
  const missing = items.filter((i) => i.status === 'missing');
  const pending = items.filter((i) => i.status === 'pending').length;
  const verified = items.filter((i) => i.status === 'verified').length;
  return {
    missing,
    summary: {
      total: items.length,
      missingRequired: missing.length,
      pending,
      verified,
    },
  };
}
