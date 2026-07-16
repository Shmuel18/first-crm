'use client';

import { Mail, MessageCircle, Phone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { formatPersonName } from '@/lib/utils/person-name';

import { ROLE_IN_CASE_VALUES } from '../schemas/borrower.schema';
import { buildMailLink, buildTelLink, buildWhatsAppLink } from '../domain/contact-links';
import { calculateAge } from '../domain/age';
import { useBorrowerCardState } from '../hooks/use-borrower-card-state';

import { BorrowerCitizenshipQuestions } from './borrower-citizenship-questions';
import { FieldGroup } from './borrower-compact-fields';
import { QuickIconLink } from './borrower-contact-actions';
import { BorrowerMiscRow } from './borrower-misc-row';
import { CaseBorrowerCardHeader } from './case-borrower-card-header';
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

  // localBorrower is the optimistic view: each successful inline save updates
  // it so derived bits (header name, computed age, contact-icon visibility)
  // refresh immediately; the hook rolls back on error, resyncs from props
  // when idle, and schedules the background router-cache refresh.
  const { localBorrower, localRole, saveField, saveRole } = useBorrowerCardState(
    caseId,
    borrower,
    roleInCase,
  );

  const fullName =
    formatPersonName(localBorrower.first_name, localBorrower.last_name) || tc('noName');

  const roleOptions = ROLE_IN_CASE_VALUES.map((r) => ({ value: r, label: t(r) }));

  // Quick-action icons next to phone / email fields — built from the live
  // optimistic value so they appear/disappear as the user types and saves.
  const waLink = buildWhatsAppLink(localBorrower.phone);
  const telLink = buildTelLink(localBorrower.phone);
  const mailLink = buildMailLink(localBorrower.email);

  const ageLabel = calculateAge(localBorrower.birth_date);

  return (
    <div className="border border-neutral-200 rounded-lg p-4 bg-white space-y-3">
      <CaseBorrowerCardHeader
        caseId={caseId}
        borrowerId={borrower.id}
        fullName={fullName}
        roleLabel={t(localRole)}
        relatedToSellers={localBorrower.related_to_sellers === true}
        isPrimary={isPrimary}
        isFirst={isFirst}
        isOnly={isOnly}
      />

      {/* Identity names — row 1: first | last | id | role. The role
          (case_borrowers.role_in_case) is a small label-less dropdown at the
          END of the row; its value is self-describing and the role also shows
          in the card header. */}
      <FieldGroup cols={4}>
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
        <select
          aria-label={tf('role')}
          value={localRole}
          onChange={(e) => {
            void saveRole(e.target.value).then((r) => {
              if (!r.ok) toast.error(r.message || tc('saveFailed'));
            });
          }}
          className="h-9 w-36 self-center rounded-md border border-neutral-200 bg-white px-2.5 text-sm focus:outline-none focus-visible:border-brand-gold-text focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
        >
          {roleOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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

      <BorrowerMiscRow borrower={localBorrower} ageLabel={ageLabel} saveField={saveField} />

      {/* Citizenship + residency: two yes/no questions, each reveals a
          country picker on "כן". Replaces the old single foreign-toggle +
          3-field reveal. */}
      <BorrowerCitizenshipQuestions borrower={localBorrower} saveField={saveField} />
    </div>
  );
}
