'use client';

import { useMemo, useState } from 'react';

import { Mail, MessageCircle, Phone, UserCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Tooltip } from '@/components/ui/tooltip';

import { updateBorrowerFieldAction, type EditableBorrowerField } from '../actions/update-borrower-field';
import { buildMailLink, buildTelLink, buildWhatsAppLink } from '../domain/contact-links';
import { calculateAge } from '../domain/age';

import { EditableField, ReadonlyField } from './editable-field';

import type { BorrowerRow, RoleInCase } from '../types';

type Props = {
  caseId: string;
  borrower: BorrowerRow;
  roleInCase: RoleInCase;
  isPrimary: boolean;
};

export function CaseBorrowerCard({ caseId, borrower, roleInCase, isPrimary }: Props) {
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
              <span>
                {t(roleInCase)}
                {isPrimary && ` · ${t('primarySuffix')}`}
              </span>
              {localBorrower.related_to_sellers === true && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-medium">
                  {t('relatedToSellers')}
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Identity — reading order per user request:
          first name | last name → national_id (full-width emphasis) →
          issue | expiry (dates paired on one row). */}
      <FieldGroup>
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
        <div className="sm:col-span-2">
          <EditableField
            label={tf('nationalId')}
            value={localBorrower.national_id}
            onSave={(v) => saveField('national_id', v)}
            dir="ltr"
          />
        </div>
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
      </FieldGroup>

      {/* Contact */}
      <FieldGroup>
        {/* Phone needs full row — 2 contact icons (WhatsApp + call) plus the
            input crammed in half a column starves the actual number to a few
            visible digits. */}
        <div className="sm:col-span-2">
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
        </div>
        {/* Email gets a full row too — its mailto adornment + RTL display of
            a long left-to-right address fits much better with breathing room.
            preferred_language moved to share the foreign-citizenship row in
            the next FieldGroup. */}
        <div className="sm:col-span-2">
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
        </div>
      </FieldGroup>

      {/* Personal */}
      <FieldGroup>
        <EditableField
          type="date"
          label={tf('birthDate')}
          value={localBorrower.birth_date}
          onSave={(v) => saveField('birth_date', v)}
        />
        {ageLabel && <ReadonlyField label={t('age')} value={ageLabel} mono />}
        <EditableField
          type="number"
          label={tf('childrenCount')}
          value={
            localBorrower.children_count === null || localBorrower.children_count === undefined
              ? null
              : String(localBorrower.children_count)
          }
          onSave={(v) => saveField('children_count', v)}
        />
      </FieldGroup>

      {/* Address — city dropped per user request; advisor writes the city
          inline as part of the address. The city column stays in the DB
          and the schema so we can split it back out later if needed. */}
      <FieldGroup>
        <div className="sm:col-span-2">
          <EditableField
            label={tf('address')}
            value={localBorrower.address}
            onSave={(v) => saveField('address', v)}
          />
        </div>
      </FieldGroup>

      {/* Citizenship — row 1 pairs the foreign-citizenship toggle with the
          preferred-language dropdown (both narrow selects). When toggle = yes,
          the 3 detail fields appear below. Toggle state is UI-local, derived
          from existing data on mount so records aren't stranded. */}
      <FieldGroup>
        <div className="grid grid-cols-[5rem_1fr] items-center gap-2 text-sm">
          <label htmlFor="has-foreign" className="text-neutral-500 truncate">
            {tf('foreignCitizenship')}
          </label>
          <select
            id="has-foreign"
            value={hasForeign ? 'yes' : 'no'}
            onChange={(e) => setHasForeign(e.target.value === 'yes')}
            className="min-w-0 flex-1 h-9 px-2.5 rounded-md border border-neutral-200 bg-white text-sm text-neutral-900 shadow-xs focus:outline-none focus-visible:border-[#A88840] focus-visible:ring-2 focus-visible:ring-[#A88840]/40 transition appearance-none ps-2.5 pe-7 bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23737373'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")",
            }}
          >
            <option value="no">{tc('no')}</option>
            <option value="yes">{tc('yes')}</option>
          </select>
        </div>
        <EditableField
          type="select"
          label={tf('preferredLanguage')}
          value={localBorrower.preferred_language}
          options={languageOptions}
          onSave={(v) => saveField('preferred_language', v)}
        />
        {hasForeign && (
          <>
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
          </>
        )}
      </FieldGroup>
    </div>
  );
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  // 2 columns on sm+ to pack more fields in view at once (the card is in a
  // 2-up case-detail grid, so we still have ~400px per card on desktop).
  // Vertical stack on mobile because half-cards there are too narrow.
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pb-3 border-b border-neutral-100 last:border-0 last:pb-0">
      {children}
    </div>
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
