'use client';

import { useMemo, useState, useTransition } from 'react';

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

import { removeBorrowerFromCaseAction } from '../actions/remove-borrower-from-case';
import { updateBorrowerFieldAction, type EditableBorrowerField } from '../actions/update-borrower-field';
import { buildMailLink, buildTelLink, buildWhatsAppLink } from '../domain/contact-links';
import { calculateAge } from '../domain/age';

import { BorrowerCitizenshipFields } from './borrower-citizenship-fields';
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
  const tForm = useTranslations('borrowerForm');
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

  // Citizenship section is conditional: most Kaufman clients are Israeli, so
  // we ask "אזרחות זרה?" (foreign citizenship) and only reveal the 3 detail
  // fields when the answer is yes. Auto-reveal on mount if existing data
  // implies foreign citizenship — don't strand records behind a closed accordion.
  const hasCitizenshipData = Boolean(
    localBorrower.citizenship?.trim() ||
      localBorrower.additional_citizenships?.trim() ||
      (localBorrower.residency_type && localBorrower.residency_type !== 'resident'),
  );
  const [hasForeign, setHasForeign] = useState(hasCitizenshipData);

  const fullName =
    [localBorrower.first_name, localBorrower.last_name].filter(Boolean).join(' ') || tc('noName');

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

  const residencyOptions = useMemo(
    () =>
      (['resident', 'foreign_resident', 'returning_resident'] as const).map((v) => ({
        value: v,
        label: tForm(`residencyTypes.${v}`),
      })),
    [tForm],
  );

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
              <span>{t(roleInCase)}</span>
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

      {/* Identity — packed into 2 rows of 3 cells:
            row 1: first | last | id
            row 2: issue | expiry | birth (with inline age sub-line) */}
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

      {/* Contact */}
      <FieldGroup>
        {/* Phone | Email pair. Both have icon adornments — with the wider
            stacked-card layout each half-column fits the label + input + 1-2
            icons comfortably. */}
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

      <BorrowerMiscRow
        borrower={localBorrower}
        ageLabel={ageLabel}
        hasForeign={hasForeign}
        onHasForeignChange={setHasForeign}
        saveField={saveField}
      />

      {/* Conditional citizenship details — only when foreign=yes. Section
          owns its layout (3-col FieldGroup matching the rest of the card). */}
      {hasForeign && (
        <BorrowerCitizenshipFields
          borrower={localBorrower}
          saveField={saveField}
          residencyOptions={residencyOptions}
        />
      )}
    </div>
  );
}

