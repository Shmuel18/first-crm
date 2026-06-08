import { useTranslations } from 'next-intl';

import { formatPersonName } from '@/lib/utils/person-name';

import type { LeadRow } from '../types';

import { ConvertLeadButton } from './convert-lead-button';
import { DeleteLeadButton } from './delete-lead-button';
import { LeadSourceBadge } from './lead-source-badge';

type Props = { leads: ReadonlyArray<LeadRow> };

/**
 * Mobile/narrow alternative to LeadsTable. The 7-column table needs ~900px
 * of comfort width; below that the horizontal scroll used to clip the
 * status + convert columns out of sight. One card per lead with the same
 * fields as the table, plus the Convert button inline when not converted.
 */
export function LeadsCardList({ leads }: Props) {
  const t = useTranslations('leads');

  return (
    <ul className="divide-y divide-neutral-200">
      {leads.map((lead, i) => {
        const name = formatPersonName(lead.first_name, lead.last_name);
        return (
          <li key={lead.id} className="px-4 py-3 bg-white">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-xs text-neutral-400 tabular-nums">{i + 1}</span>
                <span className="truncate text-sm font-medium text-neutral-900">
                  {name || '—'}
                </span>
                <LeadSourceBadge metadata={lead.metadata} />
              </div>
              <span
                className={[
                  'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0',
                  lead.status === 'converted'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-brand-gold/15 text-brand-gold-text',
                ].join(' ')}
              >
                {t(`status.${lead.status === 'converted' ? 'converted' : 'active'}`)}
              </span>
            </div>

            <dl className="mt-2 grid grid-cols-1 gap-y-1 text-xs">
              <Field label={t('columns.nationalId')} value={lead.national_id} dir="ltr" />
              <Field label={t('columns.phone')} value={lead.phone} dir="ltr" />
              <Field label={t('columns.email')} value={lead.email} dir="ltr" />
            </dl>

            <div className="mt-3 flex justify-end gap-3">
              {lead.status !== 'converted' && <ConvertLeadButton leadId={lead.id} />}
              <DeleteLeadButton
                leadId={lead.id}
                leadName={name || lead.phone || lead.email || '—'}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Field({
  label,
  value,
  dir,
}: {
  label: string;
  value: string | null | undefined;
  dir?: 'ltr';
}) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-neutral-400 shrink-0">{label}:</dt>
      <dd className="truncate text-neutral-700" dir={dir}>
        {value ?? '—'}
      </dd>
    </div>
  );
}
