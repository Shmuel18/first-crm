'use client';

import { useMemo, useState } from 'react';

import { CalendarClock, Eye, Home, Sparkles, User } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatPersonName } from '@/lib/utils/person-name';

import { parseLeadDetails } from '../domain/lead-details';
import { parseStoredLeadTriage, type LeadHeat } from '../schemas/lead-triage.schema';
import type { LeadRow } from '../types';

export function LeadDetailsButton({ lead }: { lead: LeadRow }) {
  const t = useTranslations('leads.details');
  const [open, setOpen] = useState(false);
  const details = useMemo(() => parseLeadDetails(lead.metadata), [lead.metadata]);
  const triage = useMemo(() => {
    const meta = lead.metadata as { payload?: { ai_triage?: unknown } } | null;
    return parseStoredLeadTriage(meta?.payload?.ai_triage);
  }, [lead.metadata]);

  const intlLocale = useLocale() === 'he' ? 'he-IL' : 'en-GB';
  const money = (n: number) =>
    new Intl.NumberFormat(intlLocale, { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
  const date = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' }).format(d);
  };

  const leadName = formatPersonName(lead.first_name, lead.last_name) || lead.phone || lead.email || '—';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('view')}
        title={t('view')}
        className="tap-target inline-flex size-8 items-center justify-center rounded-md text-neutral-500 transition hover:bg-neutral-100 hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
      >
        <Eye className="size-4" aria-hidden="true" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{leadName}</DialogTitle>
          </DialogHeader>

          <div className="max-h-[70vh] space-y-4 overflow-y-auto pe-1 text-sm">
            {/* AI triage (ai-v2-spec.md §4.3) — appears once the background
                run finished; older/malformed data simply renders nothing. */}
            {triage && (
              <Section
                icon={<Sparkles className="size-4" aria-hidden="true" />}
                title={t('aiTriage.title')}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <HeatChip heat={triage.heat} label={t(`aiTriage.heat.${triage.heat}`)} />
                  <span className="text-neutral-700">{triage.summary_he}</span>
                </div>
                {triage.first_call_script.length > 0 && (
                  <ol className="ms-4 list-decimal space-y-0.5 text-neutral-700">
                    {triage.first_call_script.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ol>
                )}
                {triage.reasons.length > 0 && (
                  <p className="mt-1.5 text-xs text-neutral-500">{triage.reasons.join(' · ')}</p>
                )}
              </Section>
            )}

            {/* Basic contact — always present */}
            <Section icon={<User className="size-4" aria-hidden="true" />} title={t('contact')}>
              <Row label={t('phone')} value={lead.phone} dir="ltr" />
              <Row label={t('email')} value={lead.email} dir="ltr" />
              <Row label={t('nationalId')} value={lead.national_id} dir="ltr" />
            </Section>

            {details.followUpDate && (
              <Section icon={<CalendarClock className="size-4" aria-hidden="true" />} title={t('followUp')}>
                <Row label={t('followUpDate')} value={date(details.followUpDate)} />
              </Section>
            )}

            {details.property && (
              <Section icon={<Home className="size-4" aria-hidden="true" />} title={t('property')}>
                <Row label={t('purpose')} value={details.property.purpose} />
                <Row label={t('propertyCity')} value={details.property.propertyCity} />
                {details.property.propertyValue != null && (
                  <Row label={t('propertyValue')} value={money(details.property.propertyValue)} />
                )}
                {details.property.requestedMortgage != null && (
                  <Row label={t('requestedMortgage')} value={money(details.property.requestedMortgage)} />
                )}
                {details.property.equity != null && (
                  <Row label={t('equity')} value={money(details.property.equity)} />
                )}
              </Section>
            )}

            {details.borrowers.map((b, i) => (
              <Section
                key={i}
                icon={<User className="size-4" aria-hidden="true" />}
                title={details.borrowers.length > 1 ? t('borrowerN', { n: i + 1 }) : t('borrower')}
              >
                <Row label={t('name')} value={b.name} />
                <Row label={t('phone')} value={b.phone} dir="ltr" />
                <Row label={t('email')} value={b.email} dir="ltr" />
                <Row label={t('nationalId')} value={b.nationalId} dir="ltr" />
                <Row label={t('birthDate')} value={b.birthDate ? date(b.birthDate) : null} />
                <Row label={t('city')} value={b.city} />
                <Row label={t('address')} value={b.address} />
                <Row label={t('citizenship')} value={b.citizenship} />
                {b.childrenCount != null && <Row label={t('children')} value={String(b.childrenCount)} />}
                <Row label={t('employer')} value={b.employerName} />
                {b.monthlyIncome != null && <Row label={t('monthlyIncome')} value={money(b.monthlyIncome)} />}
                <Row label={t('employmentStart')} value={b.employmentStartDate ? date(b.employmentStartDate) : null} />
              </Section>
            ))}

            {details.story && (
              <Section title={t('story')}>
                <p className="whitespace-pre-wrap break-words text-neutral-700">{details.story}</p>
              </Section>
            )}

            {lead.notes && (
              <Section title={t('notes')}>
                <p className="whitespace-pre-wrap break-words text-neutral-700">{lead.notes}</p>
              </Section>
            )}

            {!details.hasExtra && !lead.notes && (
              <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-neutral-500">
                {t('empty')}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const HEAT_TONE: Record<LeadHeat, string> = {
  hot: 'bg-red-50 text-red-700 border-red-200',
  warm: 'bg-amber-50 text-amber-700 border-amber-200',
  cold: 'bg-blue-50 text-blue-700 border-blue-200',
};

function HeatChip({ heat, label }: { heat: LeadHeat; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        HEAT_TONE[heat],
      )}
    >
      {label}
    </span>
  );
}

function Section({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-gold-text">
        {icon}
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

/** Renders a label/value pair, or nothing when the value is empty. */
function Row({ label, value, dir }: { label: string; value: string | null; dir?: 'ltr' }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-neutral-500">{label}</span>
      <span dir={dir} className="text-end font-medium text-neutral-900">
        {value}
      </span>
    </div>
  );
}
