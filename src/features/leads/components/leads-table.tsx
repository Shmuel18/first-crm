import { useTranslations } from 'next-intl';

import { formatPersonName } from '@/lib/utils/person-name';

import type { LeadRow } from '../types';

import { ConvertLeadButton } from './convert-lead-button';
import { DeleteLeadButton } from './delete-lead-button';
import { LeadSourceBadge } from './lead-source-badge';

type Props = { leads: ReadonlyArray<LeadRow> };

export function LeadsTable({ leads }: Props) {
  const t = useTranslations('leads');

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full table-fixed min-w-[900px]">
        <colgroup>
          <col className="w-12" />
          <col className="w-48" />
          <col className="w-36" />
          <col className="w-56" />
          <col className="w-32" />
          <col className="w-28" />
          <col className="w-44" />
        </colgroup>
        <thead>
          <tr className="bg-neutral-100 border-b-2 border-neutral-300">
            <Th>{t('columns.row')}</Th>
            <Th>{t('columns.name')}</Th>
            <Th>{t('columns.phone')}</Th>
            <Th>{t('columns.email')}</Th>
            <Th>{t('columns.nationalId')}</Th>
            <Th>{t('columns.status')}</Th>
            <Th>{t('columns.actions')}</Th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, i) => {
            const name = formatPersonName(lead.first_name, lead.last_name);
            return (
              <tr key={lead.id} className="border-b border-neutral-100 hover:bg-neutral-50/60">
                <Td className="text-neutral-400 tabular-nums">{i + 1}</Td>
                <Td className="font-medium text-neutral-800">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{name || '—'}</span>
                    <LeadSourceBadge metadata={lead.metadata} />
                  </div>
                </Td>
                <Td className="tabular-nums" dir="ltr">{lead.phone ?? '—'}</Td>
                <Td className="text-neutral-600 truncate" dir="ltr">{lead.email ?? '—'}</Td>
                <Td className="tabular-nums" dir="ltr">{lead.national_id ?? '—'}</Td>
                <Td>
                  <span
                    className={[
                      'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium',
                      lead.status === 'converted'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-brand-gold/15 text-brand-gold-text',
                    ].join(' ')}
                  >
                    {t(`status.${lead.status === 'converted' ? 'converted' : 'active'}`)}
                  </span>
                </Td>
                <Td>
                  <div className="flex items-center gap-3">
                    {lead.status !== 'converted' && <ConvertLeadButton leadId={lead.id} />}
                    <DeleteLeadButton
                      leadId={lead.id}
                      leadName={name || lead.phone || lead.email || '—'}
                    />
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-start px-4 py-2.5 text-xs font-semibold text-neutral-500 uppercase tracking-wide">
      {children}
    </th>
  );
}

function Td({ children, className, dir }: { children: React.ReactNode; className?: string; dir?: 'ltr' }) {
  return (
    <td dir={dir} className={`px-4 py-3 text-sm ${className ?? ''}`}>
      {children}
    </td>
  );
}
