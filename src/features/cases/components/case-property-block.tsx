'use client';

import { useId, useMemo, useState, useTransition } from 'react';

import { Home, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CurrencySign } from '@/components/ui/currency-sign';

import { FieldGroup } from '@/features/borrowers/components/borrower-compact-fields';
import { EditableField } from '@/features/borrowers/components/editable-field';

import { updateCaseFieldAction } from '../actions/update-case-field';
import {
  isEditableCaseField,
  type EditableCaseField,
} from '../domain/editable-case-fields';

import { CaseBlock } from './case-block';

import type { CaseRow } from '../types';

/**
 * Inline-editable property/transaction block on the case detail page.
 * Renders as a fullWidth row in the case page grid.
 *
 * Fields:
 *   1. Transaction purpose — dropdown of 6 standard case_types + "אחר".
 *      Picking "אחר" morphs the cell into a free-text input for
 *      case_type_other_text. A small × button reverts to the dropdown,
 *      clearing both columns. See TransactionPurposePicker below.
 *   2. City — free text (cases.city, migration 080).
 *   3. Property value — currency (cases.property_value).
 *   4. Loan amount — currency (cases.requested_mortgage_amount).
 *
 * Equity + LTV are not part of the new spec; the columns stay in the DB
 * as nullable so old data isn't dropped.
 */

type CaseTypeOption = { id: string; key: string; name_he: string };

type LocalCase = Pick<
  CaseRow,
  | 'case_type_primary_id'
  | 'case_type_other_text'
  | 'city'
  | 'property_value'
  | 'requested_mortgage_amount'
>;

type Props = {
  caseId: string;
  initial: LocalCase;
  caseTypes: ReadonlyArray<CaseTypeOption>;
};

export function CasePropertyBlock({ caseId, initial, caseTypes }: Props) {
  const t = useTranslations('case');
  const tf = useTranslations('case.fields');

  const [localCase, setLocalCase] = useState<LocalCase>(initial);

  const otherCaseTypeId = useMemo(
    () => caseTypes.find((ct) => ct.key === 'other')?.id ?? null,
    [caseTypes],
  );

  // Generic save bridge for the non-purpose fields. saveField is only
  // called with property-block fields below, all of which exist on
  // LocalCase — the wider EditableCaseField type lets us share the
  // action contract with the admin block's CaseDetailsSection.
  const saveField = async (
    field: EditableCaseField,
    value: string | null,
  ): Promise<{ ok: true } | { ok: false; message?: string }> => {
    if (!isEditableCaseField(field)) return { ok: false }; // defensive
    const key = field as keyof LocalCase;
    const prev = localCase[key];

    const coerced: unknown =
      field === 'property_value' || field === 'requested_mortgage_amount'
        ? value === null || value === ''
          ? null
          : Number(value)
        : value;

    setLocalCase((c) => ({ ...c, [key]: coerced as never }));
    const result = await updateCaseFieldAction(caseId, field, value);
    if (!result.ok) {
      setLocalCase((c) => ({ ...c, [key]: prev as never }));
      return { ok: false, message: result.message };
    }
    return { ok: true };
  };

  // Dual-write for the purpose field. Picker hands us (primaryId, otherText)
  // — either a standard case_type ID with null other, or the "other" UUID
  // with the typed text. Two sequential updateCaseFieldAction calls; rollback
  // restores both on failure.
  const savePurpose = async (
    nextPrimary: string | null,
    nextOther: string | null,
  ): Promise<void> => {
    const prevPrimary = localCase.case_type_primary_id;
    const prevOther = localCase.case_type_other_text;
    if (nextPrimary === prevPrimary && nextOther === prevOther) return;

    setLocalCase((c) => ({
      ...c,
      case_type_primary_id: nextPrimary,
      case_type_other_text: nextOther,
    }));
    const r1 = await updateCaseFieldAction(
      caseId,
      'case_type_primary_id',
      nextPrimary,
    );
    if (!r1.ok) {
      setLocalCase((c) => ({
        ...c,
        case_type_primary_id: prevPrimary,
        case_type_other_text: prevOther,
      }));
      return;
    }
    const r2 = await updateCaseFieldAction(
      caseId,
      'case_type_other_text',
      nextOther,
    );
    if (!r2.ok) {
      setLocalCase((c) => ({
        ...c,
        case_type_primary_id: prevPrimary,
        case_type_other_text: prevOther,
      }));
    }
  };

  return (
    <CaseBlock title={t('blocks.property')} icon={<Home />} fullWidth>
      <FieldGroup cols={4}>
        <TransactionPurposePicker
          label={tf('transactionPurpose')}
          placeholderSelect={tf('transactionPurposeSelect')}
          placeholderOther={tf('transactionPurposeOtherPlaceholder')}
          revertLabel={tf('transactionPurposeRevert')}
          primaryId={localCase.case_type_primary_id}
          otherText={localCase.case_type_other_text}
          options={caseTypes}
          otherId={otherCaseTypeId}
          onChange={savePurpose}
        />
        <EditableField
          label={tf('city')}
          value={localCase.city}
          onSave={(v) => saveField('city', v)}
        />
        <EditableField
          type="number"
          label={tf('propertyValue')}
          value={localCase.property_value == null ? null : String(localCase.property_value)}
          onSave={(v) => saveField('property_value', v)}
          dir="ltr"
          adornment={<CurrencySign />}
        />
        <EditableField
          type="number"
          label={tf('requestedMortgageAmount')}
          value={
            localCase.requested_mortgage_amount == null
              ? null
              : String(localCase.requested_mortgage_amount)
          }
          onSave={(v) => saveField('requested_mortgage_amount', v)}
          dir="ltr"
          adornment={<CurrencySign />}
        />
      </FieldGroup>
    </CaseBlock>
  );
}

/**
 * Dropdown-first picker for the transaction purpose. Modes:
 *
 *   - DROPDOWN MODE (default): regular <select> showing the 6 standard
 *     case_types + an "אחר" entry. Picking any standard option sets
 *     primaryId to that row and clears otherText.
 *   - TEXT MODE: triggered when primaryId === otherId. The cell morphs
 *     into a free-text input bound to otherText. A small × button to the
 *     side reverts to dropdown mode by clearing both columns.
 *
 * The mode is derived from primaryId, not stored as local state — so an
 * external revalidation that flips primaryId off "other" automatically
 * brings the cell back to the dropdown.
 */
function TransactionPurposePicker({
  label,
  placeholderSelect,
  placeholderOther,
  revertLabel,
  primaryId,
  otherText,
  options,
  otherId,
  onChange,
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

  // Shared chrome — same label + input layout as EditableField so the cell
  // lines up with its neighbours in the FieldGroup row.
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
                // Revert to dropdown mode by clearing both columns. The
                // picker is now empty, user picks fresh.
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
                // Picking "אחר" flips into text mode (primary=other, text
                // initially null). Picking anything else stores that ID +
                // clears any leftover other_text.
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
