'use client';

import Link from 'next/link';

import { Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { NlQueryResponse } from '@/app/api/ai/nl-query/route';

/**
 * Renders ONE assistant response — the single source of truth for the four
 * answer shapes (proposed action / free-text case answer / portfolio
 * count+chips / refusal). Shared by the dashboard NL bar and the global
 * assistant bubble so the branch logic and markup can't drift (CLAUDE.md:
 * no duplicated logic). Container styling is the caller's; this renders the
 * inner content and honors the handlers it's given.
 */
export function AiResponseView({
  response,
  onConfirm,
  confirming = false,
  onDismiss,
  onNavigate,
}: {
  response: NlQueryResponse;
  onConfirm?: () => void;
  confirming?: boolean;
  onDismiss?: () => void;
  /** Called when the user follows a link (bubble uses it to close the panel). */
  onNavigate?: () => void;
}) {
  const t = useTranslations('dashboard.nlQuery');

  const dismissButton = onDismiss ? (
    <button
      type="button"
      aria-label={t('clear')}
      onClick={onDismiss}
      className="flex size-6 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-white hover:text-neutral-700"
    >
      <X className="size-3.5" />
    </button>
  ) : null;

  // 1 — Proposed action awaiting confirm: the AI framed it, the human commits.
  if (response.answerable && response.proposedAction) {
    return (
      <>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium leading-relaxed text-neutral-900">
            {response.proposedAction.summary}
          </p>
          {dismissButton}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-gold px-3 py-1 text-xs font-semibold text-brand-black hover:bg-brand-gold-hover disabled:opacity-60"
          >
            {confirming ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            {t('confirmAction')}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={confirming}
            className="rounded-md border border-neutral-300 px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            {t('cancelAction')}
          </button>
        </div>
      </>
    );
  }

  // 2 — Free-text case answer ("what's missing", "the wife's email", ...).
  if (response.answerable && response.answer) {
    return (
      <>
        <div className="flex items-start justify-between gap-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-900">
            {response.answer}
          </p>
          {dismissButton}
        </div>
        {response.caseId && (
          <Link
            href={`/cases/${response.caseId}`}
            onClick={onNavigate}
            className="mt-2 inline-block text-xs font-medium text-brand-gold-text hover:underline"
          >
            {t('openCase', { label: response.caseLabel ?? '' })}
          </Link>
        )}
      </>
    );
  }

  // 3 — Portfolio filter/count result.
  if (response.answerable) {
    return (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-2xl font-bold tabular-nums text-neutral-950">
            {response.count}
          </span>
          <span className="text-sm text-neutral-600">{t('matches')}</span>
          {response.chips.map((chip, i) => (
            <span
              key={i}
              className="rounded-full border border-brand-gold/40 bg-white px-2 py-0.5 text-[11px] text-neutral-700"
            >
              {t(`chips.${chip.kind}`)}
              {': '}
              {chip.kind === 'targetDate'
                ? t(`targetDateValues.${chip.value}`)
                : chip.kind === 'view'
                  ? t('archiveValue')
                  : chip.value}
            </span>
          ))}
          <span className="ms-auto flex items-center gap-1.5">
            <Link
              href={response.url}
              onClick={onNavigate}
              className="rounded-md bg-brand-gold px-2.5 py-1 text-xs font-semibold text-brand-black hover:bg-brand-gold-hover"
            >
              {t('showInTable')}
            </Link>
            {dismissButton}
          </span>
        </div>
        {response.unresolved.length > 0 && (
          <p className="mt-1 text-[11px] text-amber-700">
            {t('unresolved', { names: response.unresolved.map((u) => u.value).join(', ') })}
          </p>
        )}
        {response.intent === 'list' && response.rows.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {response.rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/cases/${row.id}`}
                  onClick={onNavigate}
                  className="text-xs text-neutral-700 hover:text-brand-gold-text hover:underline"
                >
                  {/* Names only — the case number appears solely for a case
                      with no named client yet (user's call). */}
                  {row.label || `#${row.caseNumber}`}
                  {row.statusName ? ` · ${row.statusName}` : ''}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  // 4 — Not answerable (couldn't map to a filter/action).
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm text-neutral-700">
        {response.reason}
        <span className="block text-[11px] text-neutral-500">{t('tryExamples')}</span>
      </p>
      {dismissButton}
    </div>
  );
}
