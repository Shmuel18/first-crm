'use client';

import { useMemo, useState } from 'react';

import { Mail, MessageCircle, Phone, UserCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Tooltip } from '@/components/ui/tooltip';

import { updateBorrowerFieldAction, type EditableBorrowerField } from '../actions/update-borrower-field';
import { buildMailLink, buildTelLink, buildWhatsAppLink } from '../domain/contact-links';
import { calculateAge } from '../domain/age';

import { EditableField } from './editable-field';

import type { BorrowerRow, RoleInCase } from '../types';

type Props = {
  caseId: string;
  borrower: BorrowerRow;
  roleInCase: RoleInCase;
  isPrimary: boolean;
};

export function CaseBorrowerCard({
  caseId,
  borrower,
  roleInCase,
  // isPrimary intentionally unused for now — the primary-borrower
  // indicator was removed per user request. Prop stays on the interface
  // so the page contract doesn't change.
}: Props) {
  const t = useTranslations('case.borrower');
  const tf = useTranslations('borrowerForm.fields');
  const tForm = useTranslations('borrowerForm');
  const tc = useTranslations('common');

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

  const residencyOptions = useMemo(
    () =>
      (['resident', 'foreign_resident', 'returning_resident'] as const).map((v) => ({
        value: v,
        label: tForm(`residencyTypes.${v}`),
      })),
    [tForm],
  );
  const languageOptions = useMemo(
    () =>
      (['he', 'en'] as const).map((v) => ({
        value: v,
        label: tForm(`preferredLanguages.${v}`),
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
      </div>

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

      {/* Single dense row: tiny inline-label fields (children / age /
          foreign / language) plus the address taking the rest of the row.
          Wraps to a new line on narrow screens. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pb-3 border-b border-neutral-100 text-sm">
        <CompactNumber
          label={tf('childrenCount')}
          value={localBorrower.children_count}
          onSave={(v) => saveField('children_count', v === null ? null : String(v))}
        />
        <CompactReadonly label={t('age')} value={ageLabel} />
        <CompactSelect
          label={tf('foreignCitizenship')}
          value={hasForeign ? 'yes' : 'no'}
          onChange={(v) => setHasForeign(v === 'yes')}
          options={[
            { value: 'no', label: tc('no') },
            { value: 'yes', label: tc('yes') },
          ]}
        />
        <CompactSelect
          label={tf('preferredLanguage')}
          value={localBorrower.preferred_language ?? ''}
          onChange={(v) => {
            void saveField('preferred_language', v || null);
          }}
          options={[{ value: '', label: tc('select') }, ...languageOptions]}
        />
        <div className="flex-1 min-w-[16rem]">
          <EditableField
            label={tf('address')}
            value={localBorrower.address}
            onSave={(v) => saveField('address', v)}
          />
        </div>
      </div>

      {/* Conditional citizenship details — only when foreign=yes. Stays in
          a regular 3-col FieldGroup so the labels match the rest of the card. */}
      {hasForeign && (
        <FieldGroup cols={3}>
          <EditableField
            label={tf('citizenship')}
            value={localBorrower.citizenship}
            onSave={(v) => saveField('citizenship', v)}
            placeholder={tf('citizenshipPlaceholder')}
          />
          <EditableField
            label={tf('additionalCitizenships')}
            value={localBorrower.additional_citizenships}
            onSave={(v) => saveField('additional_citizenships', v)}
            placeholder={tf('additionalCitizenshipsPlaceholder')}
          />
          <EditableField
            type="select"
            label={tf('residency')}
            value={localBorrower.residency_type}
            options={residencyOptions}
            onSave={(v) => saveField('residency_type', v)}
          />
        </FieldGroup>
      )}
    </div>
  );
}

function FieldGroup({
  children,
  cols = 2,
}: {
  children: React.ReactNode;
  cols?: 2 | 3 | 4;
}) {
  // Borrower cards are stacked full-width now, so denser column counts are
  // viable. 3-col for identity (name | last | id), 4-col for the misc row
  // (children | age | foreign | language), 2-col stays default.
  const colsClass =
    cols === 4 ? 'sm:grid-cols-4' : cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
  return (
    <div
      className={`grid grid-cols-1 ${colsClass} gap-x-6 gap-y-2 pb-3 border-b border-neutral-100 last:border-0 last:pb-0`}
    >
      {children}
    </div>
  );
}

// -- Compact inline-label helpers for the dense merged row ----------------
// Each renders as "label: [tiny input]" instead of EditableField's
// label-column + input-column. Used only in the single-row merged section
// where 4 fields plus an address need to share one line.

function CompactNumber({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number | null;
  onSave: (next: number | null) => unknown;
}) {
  const [local, setLocal] = useState(value === null || value === undefined ? '' : String(value));
  const [propRef, setPropRef] = useState(value);
  if (value !== propRef) {
    setPropRef(value);
    setLocal(value === null || value === undefined ? '' : String(value));
  }
  return (
    <label className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-neutral-500">{label}:</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step="1"
        dir="ltr"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => {
          const v = e.target.value.trim();
          const next = v === '' ? null : Number(v);
          if (next !== value) onSave(next);
        }}
        className="w-12 h-8 px-1.5 text-center rounded-md border border-neutral-200 bg-white text-sm focus:outline-none focus-visible:border-[#A88840] focus-visible:ring-2 focus-visible:ring-[#A88840]/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
      />
    </label>
  );
}

function CompactReadonly({ label, value }: { label: string; value: string | null }) {
  // Disabled input so the age slot matches the visual shape of the editable
  // boxes around it — same border/radius/height, just non-interactive.
  return (
    <label className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-neutral-500">{label}:</span>
      <input
        type="text"
        value={value ?? '—'}
        disabled
        readOnly
        className="w-14 h-8 px-2 text-center rounded-md border border-neutral-200 bg-neutral-50 text-sm font-mono text-neutral-700 cursor-default"
      />
    </label>
  );
}

function CompactSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  // Arrow positioned on the LEFT (the "end" side in RTL): text now starts
  // from the right edge with breathing room, no collision with the chevron.
  return (
    <label className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-neutral-500">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 ps-3 pe-7 rounded-md border border-neutral-200 bg-white text-sm appearance-none bg-[length:1rem] bg-[left_0.5rem_center] bg-no-repeat focus:outline-none focus-visible:border-[#A88840] focus-visible:ring-2 focus-visible:ring-[#A88840]/40"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23737373'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function QuickIconLink({
  href,
  label,
  icon: Icon,
  accent,
  external = false,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: 'true' }>;
  accent: 'emerald' | 'neutral';
  external?: boolean;
}) {
  const accentClass =
    accent === 'emerald'
      ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
      : 'text-neutral-500 hover:text-[#A88840] hover:bg-neutral-100';
  return (
    <Tooltip content={label}>
      <a
        href={href}
        aria-label={label}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className={`size-7 rounded inline-flex items-center justify-center transition ${accentClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/40`}
      >
        <Icon className="size-3.5" aria-hidden="true" />
      </a>
    </Tooltip>
  );
}
