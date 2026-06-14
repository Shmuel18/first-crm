'use client';

import { useId, useState, useTransition } from 'react';

import { X } from 'lucide-react';

type CaseTypeOption = { id: string; key: string; name_he: string };

/**
 * Dropdown-first picker for the transaction purpose. Modes:
 *   - DROPDOWN MODE (default): a <select> of the standard case_types + "אחר".
 *     Picking any standard option sets primaryId + clears otherText.
 *   - TEXT MODE: triggered when primaryId === otherId. The cell morphs into a
 *     free-text input bound to otherText; a × button reverts to the dropdown by
 *     clearing both columns.
 * The mode is derived from primaryId (not local state), so an external
 * revalidation that flips primaryId off "other" returns the cell to the dropdown.
 *
 * Shared by the primary property (saves to cases.*) and each additional
 * property (saves to case_properties.*) via the onChange callback.
 */
export function TransactionPurposePicker({
  label,
  placeholderSelect,
  placeholderOther,
  revertLabel,
  primaryId,
  otherText,
  options,
  otherId,
  onChange,
  canEdit = true,
}: {
  label: string;
  placeholderSelect: string;
  placeholderOther: string;
  revertLabel: string;
  primaryId: string | null;
  otherText: string | null;
  options: ReadonlyArray<CaseTypeOption>;
  otherId: string | null;
  onChange: (nextPrimary: string | null, nextOther: string | null) => Promise<void>;
  /** When false, render the purpose read-only (no select/input). */
  canEdit?: boolean;
}) {
  const id = useId();
  const isTextMode = otherId != null && primaryId === otherId;
  const [, startTransition] = useTransition();
  const [localText, setLocalText] = useState(otherText ?? '');
  // Re-sync from props after a revalidation.
  const [propRefText, setPropRefText] = useState(otherText ?? '');
  if ((otherText ?? '') !== propRefText) {
    setPropRefText(otherText ?? '');
    setLocalText(otherText ?? '');
  }

  // Read-only: viewer can't edit — show the selected purpose (or the free-text
  // "other" value) as plain text, no select/input.
  if (!canEdit) {
    const display = isTextMode
      ? otherText || '—'
      : options.find((o) => o.id === primaryId)?.name_he ?? '—';
    return (
      <div className="grid grid-cols-[6rem_1fr] items-center gap-2 text-sm">
        <span className="text-neutral-500 truncate">{label}</span>
        <span className="min-w-0 flex-1 truncate py-1.5 text-neutral-900">{display}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[6rem_1fr] items-center gap-2 text-sm">
      <label htmlFor={id} className="text-neutral-500 truncate">
        {label}
      </label>
      <div className="flex items-center gap-1.5 min-w-0">
        {isTextMode ? (
          <>
            <input
              id={id}
              type="text"
              value={localText}
              placeholder={placeholderOther}
              onChange={(e) => setLocalText(e.target.value)}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next === (otherText ?? '').trim()) return;
                startTransition(() => {
                  void onChange(otherId, next || null);
                });
              }}
              className="min-w-0 flex-1 h-9 px-2.5 rounded-md border border-neutral-200 bg-white text-sm text-neutral-900 shadow-xs focus:outline-none focus-visible:border-brand-gold-text focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 transition"
            />
            <button
              type="button"
              onClick={() => {
                setLocalText('');
                startTransition(() => {
                  void onChange(null, null);
                });
              }}
              aria-label={revertLabel}
              className="shrink-0 size-7 rounded inline-flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 transition"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </>
        ) : (
          <select
            id={id}
            value={primaryId ?? ''}
            onChange={(e) => {
              const next = e.target.value || null;
              startTransition(() => {
                void onChange(next, null);
              });
            }}
            className="min-w-0 flex-1 h-9 px-2.5 pe-7 rounded-md border border-neutral-200 bg-white text-sm text-neutral-900 shadow-xs focus:outline-none focus-visible:border-brand-gold-text focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 transition appearance-none bg-[length:1rem] bg-[left_0.5rem_center] bg-no-repeat"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23737373'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")",
            }}
          >
            <option value="">{placeholderSelect}</option>
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name_he}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
