'use client';

import { useState, useTransition } from 'react';

import { Mail, MessageCircle, Phone, Trash2, UserCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { formatPersonName } from '@/lib/utils/person-name';

import { removeBorrowerFromCaseAction } from '../actions/remove-borrower-from-case';
import { updateBorrowerFieldAction, type EditableBorrowerField } from '../actions/update-borrower-field';
import { updateBorrowerRoleAction } from '../actions/update-borrower-role';
import { ROLE_IN_CASE_VALUES } from '../schemas/borrower.schema';
import { buildMailLink, buildTelLink, buildWhatsAppLink } from '../domain/contact-links';
import { calculateAge } from '../domain/age';

import { BorrowerCitizenshipQuestions } from './borrower-citizenship-questions';
import { FieldGroup } from './borrower-compact-fields';
import { QuickIconLink } from './borrower-contact-actions';
import { BorrowerMiscRow } from './borrower-misc-row';
import { EditableField } from './editable-field';

import type { BorrowerRow, RoleInCase } from '../types';

type Props = {
  caseId: string;
  borrower: BorrowerRow;
  roleInCase: RoleInCase;
  /** Data flag from case_borrowers.is_primary. */
  isPrimary: boolean;
  /** First card in the rendered list (list is is_primary DESC). */
  isFirst: boolean;
  /** Only borrower on the case — locks removal regardless of position. */
  isOnly: boolean;
};

export function CaseBorrowerCard({
  caseId,
  borrower,
  roleInCase,
  isPrimary,
  isFirst,
  isOnly,
}: Props) {
  const t = useTranslations('case.borrower');
  const tf = useTranslations('borrowerForm.fields');
  const tc = useTranslations('common');
  const tRemove = useTranslations('case.borrower.remove');
  const router = useRouter();
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [isRemoving, startRemove] = useTransition();

  // localBorrower is the optimistic view: each successful inline save updates
  // it so derived bits (header name, computed age, contact-icon visibility)
  // refresh immediately. On error we restore the previous value here AND the
  // EditableField rolls back its own input via its `value` prop effect.
  const [localBorrower, setLocalBorrower] = useState(borrower);
  const [localRole, setLocalRole] = useState<RoleInCase>(roleInCase);

  const fullName =
    formatPersonName(localBorrower.first_name, localBorrower.last_name) || tc('noName');

  // Generic save bridge: each EditableField calls this with its field name,
  // we run the optimistic update + the server action and roll back on error.
  const saveField = async (
    field: EditableBorrowerField,
    value: string | null,
  ): Promise<{ ok: true } | { ok: false; message?: string }> => {
    const prev = localBorrower[field];
    setLocalBorrower((b) => ({ ...b, [field]: value }));
    const result = await updateBorrowerFieldAction(borrower.id, caseId, field, value);
    if (!result.ok) {
      setLocalBorrower((b) => ({ ...b, [field]: prev }));
      return { ok: false, message: result.message };
    }
    return { ok: true };
  };

  // Role lives on case_borrowers (junction), so it routes through its own
  // action rather than the borrower-table saveField bridge above.
  const saveRole = async (
    value: string | null,
  ): Promise<{ ok: true } | { ok: false; message?: string }> => {
    const next = ROLE_IN_CASE_VALUES.find((r) => r === value);
    if (!next) return { ok: false };
    const prev = localRole;
    setLocalRole(next);
    const result = await updateBorrowerRoleAction(caseId, borrower.id, next);
    if (!result.ok) {
      setLocalRole(prev);
      return { ok: false, message: result.message };
    }
    return { ok: true };
  };

  const roleOptions = ROLE_IN_CASE_VALUES.map((r) => ({ value: r, label: t(r) }));

  // Quick-action icons next to phone / email fields — built from the live
  // optimistic value so they appear/disappear as the user types and saves.
  const waLink = buildWhatsAppLink(localBorrower.phone);
  const telLink = buildTelLink(localBorrower.phone);
  const mailLink = buildMailLink(localBorrower.email);

  const ageLabel = calculateAge(localBorrower.birth_date);

  const handleRemove = () => {
    startRemove(async () => {
      const result = await removeBorrowerFromCaseAction(caseId, borrower.id);
      if (result.ok) {
        toast.success(tRemove('success', { name: fullName }));
        setConfirmRemoveOpen(false);
        router.refresh();
      } else {
        toast.error(tRemove(`errors.${result.error}`));
      }
    });
  };

  return (
    <div className="border border-neutral-200 rounded-lg p-4 bg-white space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-neutral-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-9 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
            <UserCircle2 className="size-5 text-neutral-500" />
          </span>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-neutral-900 text-sm truncate">{fullName}</span>
            <span className="text-xs text-neutral-500 flex items-center gap-1.5 flex-wrap">
              <span>{t(localRole)}</span>
              {localBorrower.related_to_sellers === true && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-medium">
                  {t('relatedToSellers')}
                </span>
              )}
            </span>
          </div>
        </div>
        {/* Hide trash for (a) the data-flagged primary, (b) whoever's first
            in the list (handles data that has no primary at all), and (c)
            the sole borrower on the case (a case needs ≥1 borrower).
            Server action enforces the same guards as defense-in-depth. */}
        {!isPrimary && !isFirst && !isOnly && (
          <Tooltip content={tRemove('action')}>
            <button
              type="button"
              aria-label={tRemove('action')}
              onClick={() => setConfirmRemoveOpen(true)}
              disabled={isRemoving}
              className="shrink-0 inline-flex items-center justify-center size-8 rounded-md text-neutral-500 hover:text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      </div>

      <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>{tRemove('dialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {tRemove('dialog.description', { name: fullName })}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <Button variant="destructive" onClick={handleRemove} disabled={isRemoving}>
              {tRemove('dialog.confirm')}
            </Button>
            <AlertDialogCancel
              render={<Button variant="outline">{tc('cancel')}</Button>}
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role on the case (case_borrowers.role_in_case) — inline editable. */}
      <div className="sm:max-w-xs">
        <EditableField
          type="select"
          label={tf('role')}
          value={localRole}
          options={roleOptions}
          onSave={saveRole}
        />
      </div>

      {/* Identity names — row 1: first | last | id */}
      <FieldGroup cols={3}>
        <EditableField
          label={tf('firstName')}
          value={localBorrower.first_name}
          onSave={(v) => saveField('first_name', v)}
        />
        <EditableField
          label={tf('lastName')}
          value={localBorrower.last_name}
          onSave={(v) => saveField('last_name', v)}
        />
        <EditableField
          label={tf('nationalId')}
          value={localBorrower.national_id}
          onSave={(v) => saveField('national_id', v)}
          dir="ltr"
          inputClassName="text-end"
        />
      </FieldGroup>

      {/* Contact — row 2: phone | email. Moved above the date row so the
          "how do I reach this borrower" answer sits next to their name,
          which is what the advisor scans for first. */}
      <FieldGroup>
        <EditableField
          type="tel"
          label={tf('phone')}
          value={localBorrower.phone}
          onSave={(v) => saveField('phone', v)}
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
          adornment={
            mailLink ? (
              <QuickIconLink href={mailLink} label={t('sendEmail')} icon={Mail} accent="neutral" />
            ) : null
          }
        />
      </FieldGroup>

      {/* Dates — row 3: issue | expiry | birth. */}
      <FieldGroup cols={3}>
        <EditableField
          type="date"
          label={tf('idIssueDate')}
          value={localBorrower.id_issue_date}
          onSave={(v) => saveField('id_issue_date', v)}
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
        />
      </FieldGroup>

      <BorrowerMiscRow
        borrower={localBorrower}
        ageLabel={ageLabel}
        saveField={saveField}
      />

      {/* Citizenship + residency: two yes/no questions, each reveals a
          country picker on "כן". Replaces the old single foreign-toggle +
          3-field reveal. */}
      <BorrowerCitizenshipQuestions
        borrower={localBorrower}
        saveField={saveField}
      />
    </div>
  );
}

