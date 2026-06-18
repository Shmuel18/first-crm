'use client';

import { useState } from 'react';

import Link from 'next/link';

import { ExternalLink, Folder, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { NativeSelect } from '@/components/shared/form-fields';
import { Input } from '@/components/ui/input';

import type { TaskCaseOption, TaskWithRelations } from '../types';

type Props = {
  cases: ReadonlyArray<TaskCaseOption>;
  presetCaseId?: string | null;
  task?: TaskWithRelations | null;
  selectedCaseId: string;
  onSelectedCaseChange: (id: string) => void;
  error?: string;
};

/**
 * The "linked case" field. When a case is already chosen it collapses to a
 * single compact row (client name shown once + "open" + "change") instead of
 * the search + select + repeated link — clicking "change" reveals the picker.
 * When the case is preset (locked) it's read-only. The selected id lives in the
 * parent because the upload step needs it; the search/change UI is local.
 */
export function TaskLinkedCaseField({
  cases,
  presetCaseId,
  task,
  selectedCaseId,
  onSelectedCaseChange,
  error,
}: Props) {
  const t = useTranslations('tasks.form.fields');
  const [caseSearch, setCaseSearch] = useState('');
  const [changing, setChanging] = useState(false);

  const currentCase = task?.case ?? null;
  const effectiveCases =
    currentCase && !cases.some((c) => c.id === currentCase.id)
      ? [
          { id: currentCase.id, case_number: currentCase.case_number, label: `#${currentCase.case_number}` },
          ...cases,
        ]
      : cases;

  const selectedCase = effectiveCases.find((c) => c.id === selectedCaseId);
  const clientLabel =
    task?.case && task.case.id === selectedCaseId
      ? (task.case.clientName ?? `#${task.case.case_number}`)
      : (selectedCase?.label ?? null);

  const normalized = caseSearch.trim().toLowerCase();
  const matching = normalized
    ? effectiveCases.filter((c) => `${c.case_number} ${c.label}`.toLowerCase().includes(normalized))
    : effectiveCases;
  const filtered =
    selectedCase && !matching.some((c) => c.id === selectedCase.id)
      ? [selectedCase, ...matching]
      : matching;

  const locked = Boolean(presetCaseId);
  const showCompact = locked || (!changing && Boolean(selectedCaseId));

  return (
    <div>
      {showCompact ? (
        <div className="flex items-center gap-2.5 rounded-md border border-neutral-200 px-3 py-2">
          <input type="hidden" name="case_id" value={presetCaseId ?? selectedCaseId} />
          <Folder className="size-4 shrink-0 text-brand-gold-text" aria-hidden="true" />
          <span className="flex-1 truncate text-sm text-neutral-800">
            {clientLabel}
            {selectedCase?.case_number && (
              <span className="text-neutral-400"> · #{selectedCase.case_number}</span>
            )}
          </span>
          <Link
            href={`/cases/${presetCaseId ?? selectedCaseId}`}
            aria-label={`${t('openCase')}: ${clientLabel ?? ''}`}
            className="inline-flex items-center gap-1 rounded text-xs text-neutral-600 transition hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
          >
            <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
            {t('caseOpen')}
          </Link>
          {!locked && (
            <>
              <span className="text-neutral-200" aria-hidden="true">
                |
              </span>
              <button
                type="button"
                onClick={() => setChanging(true)}
                className="rounded text-xs text-neutral-500 transition hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
              >
                {t('caseChange')}
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="relative mb-2">
            <Search
              className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={caseSearch}
              onChange={(e) => setCaseSearch(e.target.value)}
              placeholder={t('caseSearchPlaceholder')}
              aria-label={t('caseSearch')}
              className="ps-9"
            />
          </div>
          <NativeSelect
            aria-label={t('case')}
            name="case_id"
            value={selectedCaseId}
            onChange={(e) => {
              onSelectedCaseChange(e.target.value);
              if (e.target.value) setChanging(false);
            }}
          >
            <option value="">{t('caseNone')}</option>
            {filtered.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
          <div className="mt-1 flex items-center justify-between">
            {filtered.length === 0 ? (
              <p className="text-xs text-neutral-500">{t('caseNoMatches')}</p>
            ) : (
              <span />
            )}
            {selectedCaseId && (
              <button
                type="button"
                onClick={() => setChanging(false)}
                className="rounded text-xs text-neutral-500 transition hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
              >
                {t('caseCancelChange')}
              </button>
            )}
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
