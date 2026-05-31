'use client';

import { useState } from 'react';

import { Mail, MessageCircle, Phone, Trash2, UserCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { formatPersonName } from '@/lib/utils/person-name';

import { BorrowerCitizenshipQuestions } from '@/features/borrowers/components/borrower-citizenship-questions';
import { FieldGroup } from '@/features/borrowers/components/borrower-compact-fields';
import { QuickIconLink } from '@/features/borrowers/components/borrower-contact-actions';
import { BorrowerMiscRow } from '@/features/borrowers/components/borrower-misc-row';
import { EditableField } from '@/features/borrowers/components/editable-field';
import { ReturningClientAutofill } from '@/features/borrowers/components/returning-client-autofill';
import { calculateAge } from '@/features/borrowers/domain/age';
import { buildMailLink, buildTelLink, buildWhatsAppLink } from '@/features/borrowers/domain/contact-links';
import { applyMatchFields } from '@/features/borrowers/domain/returning-autofill-fields';
import { useDraftReturningAutofill } from '@/features/borrowers/hooks/use-draft-returning-autofill';
import type { EditableBorrowerField } from '@/features/borrowers/actions/update-borrower-field';
import type { BorrowerRow, ReturningBorrowerMatch } from '@/features/borrowers/types';

import type { DraftBorrower } from '../hooks/use-case-draft-state';

/**
 * Inline-editable borrower card for /cases/new draft mode. Layout is
 * one-for-one with the live CaseBorrowerCard (same FieldGroup / EditableField
 * primitives, same misc-row + conditional citizenship section). The only
 * differences:
 *
 *   - saveField dispatches to client state (the parent's `onChange`) instead
 *     of calling updateBorrowerFieldAction. The save is synchronous; the
 *     EditableField API still expects a Promise, so we resolve immediately.
 *   - A small delete button sits in the header so the user can drop the
 *     whole card. The live card doesn't have one (delete-borrower lives in
 *     a confirm flow elsewhere).
 *   - There's no borrower.id / case_id yet — both come into existence when
 *     the user clicks "save" on the action bar.
 *
 * Field coverage matches the live card: identity, dates, contact, misc, and
 * conditional foreign-citizenship. Less-common fields (notes, employment,
 * credit_rating, marital_status) stay for the inline-edit experience after
 * the case is saved.
 */

type Props = {
  borrower: DraftBorrower;
  onChange: (next: DraftBorrower) => void;
  onRemove: () => void;
  /**
   * When false the trash button hides — used for the first borrower in
   * the draft, who becomes the primary on save and must therefore exist.
   * A draft with zero borrowers can't be saved either way (the save
   * action validates `needBorrower`), so the lock is consistent with the
   * save constraint and prevents the user from emptying the block.
   */
  canRemove: boolean;
};

export function DraftBorrowerCard({ borrower, onChange, onRemove, canRemove }: Props) {
  const t = useTranslations('case.borrower');
  const tf = useTranslations('borrowerForm.fields');
  const tc = useTranslations('common');

  // Local optimistic view — same pattern as the live card. Saves push up to
  // the parent reducer, and the next prop snapshot folds back in via React's
  // "adjust on prop change" idiom in EditableField itself.
  const [localBorrower, setLocalBorrower] = useState(borrower);

  // Returning-client autofill: probe derives from the live values; onFill
  // merges an accepted match into draft state and amber-flags overwritten
  // fields (markClass), cleared per-field when the user re-edits (clearMark).
  const { probe, onFill, markClass, clearMark } = useDraftReturningAutofill(
    localBorrower,
    (match: ReturningBorrowerMatch) => {
      const next = applyMatchFields(localBorrower, match);
      setLocalBorrower(next);
      onChange(next);
    },
  );

  const fullName =
    formatPersonName(localBorrower.first_name, localBorrower.last_name) ||
    tc('noName');

  // Single saveField bridge — accepts EditableBorrowerField names (the same
  // whitelist the server-side action uses) and pushes the change into both
  // local state and the parent's draft state. Always returns ok=true since
  // there's no network call to fail (validation happens at "save case" time).
  const saveField = async (
    field: EditableBorrowerField,
    value: string | null,
  ): Promise<{ ok: true }> => {
    clearMark(field);
    // children_count is the one non-string field a saveField call sends — the
    // BorrowerMiscRow stringifies it for us. Convert back to number for the
    // typed state shape; '' / null both clear the field.
    const coerced: unknown =
      field === 'children_count'
        ? value === null || value === ''
          ? null
          : Number(value)
        : value;

    const next = { ...localBorrower, [field]: coerced } as DraftBorrower;
    setLocalBorrower(next);
    onChange(next);
    return { ok: true };
  };

  // Quick-action contact links — built from the live optimistic value so
  // they appear/disappear as the user types and blurs (matches live card).
  const waLink = buildWhatsAppLink(localBorrower.phone);
  const telLink = buildTelLink(localBorrower.phone);
  const mailLink = buildMailLink(localBorrower.email);

  const ageLabel = calculateAge(localBorrower.birth_date);

  // BorrowerMiscRow + BorrowerCitizenshipQuestions expect a slice of BorrowerRow
  // (DB row type). DraftBorrower mirrors the same field names but uses the
  // Zod input type (e.g. children_count is number). Cast — both sub-components
  // treat the fields as nullable strings / numbers at runtime.
  const borrowerForMisc = localBorrower as unknown as BorrowerRow;

  return (
    <div className="border border-neutral-200 rounded-lg p-4 bg-white space-y-3">
      {/* Header — avatar + name + role badge + delete button */}
      <div className="flex items-start justify-between pb-3 border-b border-neutral-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-9 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
            <UserCircle2 className="size-5 text-neutral-500" />
          </span>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-neutral-900 text-sm truncate">{fullName}</span>
            <span className="text-xs text-neutral-500">
              {t(localBorrower.role_in_case ?? 'borrower')}
            </span>
          </div>
        </div>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            aria-label={tc('delete')}
            className="size-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      {/* Identity — 2 rows of 3 cells, same shape as the live card. */}
      <FieldGroup cols={3}>
        <EditableField
          label={tf('firstName')}
          value={localBorrower.first_name}
          onSave={(v) => saveField('first_name', v)}
          inputClassName={markClass('first_name')}
        />
        <EditableField
          label={tf('lastName')}
          value={localBorrower.last_name}
          onSave={(v) => saveField('last_name', v)}
          inputClassName={markClass('last_name')}
        />
        <EditableField
          label={tf('nationalId')}
          value={localBorrower.national_id}
          onSave={(v) => saveField('national_id', v)}
          dir="ltr"
          inputClassName={['text-end', markClass('national_id')].filter(Boolean).join(' ')}
        />
        <EditableField
          type="date"
          label={tf('idIssueDate')}
          value={localBorrower.id_issue_date}
          onSave={(v) => saveField('id_issue_date', v)}
          inputClassName={markClass('id_issue_date')}
        />
        <EditableField
          type="date"
          label={tf('idExpiryDate')}
          value={localBorrower.id_expiry_date}
          onSave={(v) => saveField('id_expiry_date', v)}
        />
        <EditableField
          type="date"
          label={tf('birthDate')}
          value={localBorrower.birth_date}
          onSave={(v) => saveField('birth_date', v)}
          inputClassName={markClass('birth_date')}
        />
      </FieldGroup>

      <ReturningClientAutofill probe={probe} onFill={onFill} />

      {/* Contact — phone w/ WhatsApp+call adornments, email w/ mailto. */}
      <FieldGroup>
        <EditableField
          type="tel"
          label={tf('phone')}
          value={localBorrower.phone}
          onSave={(v) => saveField('phone', v)}
          inputClassName={markClass('phone')}
          adornment={
            waLink && telLink ? (
              <span className="inline-flex items-center gap-0.5">
                <QuickIconLink
                  href={waLink}
                  label={t('whatsapp')}
                  icon={MessageCircle}
                  accent="emerald"
                  external
                />
                <QuickIconLink href={telLink} label={t('call')} icon={Phone} accent="neutral" />
              </span>
            ) : null
          }
        />
        <EditableField
          type="email"
          label={tf('email')}
          value={localBorrower.email}
          onSave={(v) => saveField('email', v)}
          inputClassName={markClass('email')}
          adornment={
            mailLink ? (
              <QuickIconLink href={mailLink} label={t('sendEmail')} icon={Mail} accent="neutral" />
            ) : null
          }
        />
      </FieldGroup>

      <BorrowerMiscRow
        borrower={borrowerForMisc}
        ageLabel={ageLabel}
        saveField={saveField}
      />

      <BorrowerCitizenshipQuestions
        borrower={borrowerForMisc}
        saveField={saveField}
      />
    </div>
  );
}
