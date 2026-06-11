'use client';

import {
  ArrowRightLeft,
  CheckCircle2,
  ClipboardList,
  Coins,
  FileText,
  FolderPlus,
  Landmark,
  Mail,
  MessageSquare,
  Pencil,
  Reply,
  Send,
  User,
  UserCog,
  UserMinus,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  formatFieldValue,
  getFieldLabel,
  type AuditTranslator,
} from '@/features/audit/lib/field-labels';
import { formatRelativeTime } from '@/features/case-comments/domain/format-relative-time';

import type { Locale } from '@/lib/i18n/direction';

import type { ActivityEntity, ActivityEvent, ActivityFieldChange } from '../types';

import type { LucideIcon } from 'lucide-react';

const ENTITY_ICONS: Record<ActivityEntity, LucideIcon> = {
  cases: FolderPlus,
  borrowers: User,
  borrower_incomes: Wallet,
  borrower_obligations: Wallet,
  case_banks: Landmark,
  case_borrowers: User,
  documents: FileText,
  tasks: ClipboardList,
  case_financials: Coins,
};

function iconFor(event: ActivityEvent): LucideIcon {
  switch (event.kind) {
    case 'case_created':
      return FolderPlus;
    case 'status_changed':
      return ArrowRightLeft;
    case 'advisor_changed':
      return UserCog;
    case 'borrower_added':
      return UserPlus;
    case 'borrower_removed':
      return UserMinus;
    case 'bank_submitted':
      return Send;
    case 'bank_response':
      return Reply;
    case 'task_completed':
      return CheckCircle2;
    case 'document_status':
      return FileText;
    case 'comment_added':
      return MessageSquare;
    case 'email_sent':
      return Mail;
    case 'fields_updated':
      return Pencil;
    case 'record_added':
    case 'record_removed':
      return ENTITY_ICONS[event.entity];
  }
}

/** Icon-circle tone — mirrors the audit table's color language (created =
 *  emerald, removed = rose) with gold reserved for case milestones. */
function toneFor(event: ActivityEvent): string {
  switch (event.kind) {
    case 'case_created':
    case 'status_changed':
    case 'bank_submitted':
    case 'bank_response':
    case 'task_completed':
      return 'border-brand-gold/40 bg-brand-gold-tint text-brand-gold-text';
    case 'borrower_added':
    case 'record_added':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'borrower_removed':
    case 'record_removed':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-neutral-200 bg-white text-neutral-500';
  }
}

function sentenceFor(event: ActivityEvent, t: (key: string) => string): string {
  switch (event.kind) {
    case 'record_added':
      return t(`added.${event.entity}`);
    case 'record_removed':
      return t(`removed.${event.entity}`);
    case 'email_sent':
      return t(`events.email_${event.emailKind}`);
    case 'fields_updated':
      return t('events.fields_updated');
    default:
      return t(`events.${event.kind}`);
  }
}

function subjectFor(event: ActivityEvent, ta: AuditTranslator): string | null {
  switch (event.kind) {
    case 'fields_updated': {
      const entity = ta(`tables.${event.entity}`);
      return event.subject ? `${entity} · ${event.subject}` : entity;
    }
    case 'case_created':
    case 'status_changed':
    case 'advisor_changed':
    case 'comment_added':
    case 'email_sent':
      return null;
    default:
      return event.subject;
  }
}

/** Renders a dynamically-chosen lucide icon. Destructured from props (same
 *  pattern as kpi-strip) so the static-components lint rule can verify the
 *  component reference is stable. */
function EventIcon({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return <Icon className={className} aria-hidden="true" />;
}

function FromToPills({ from, to, gold }: { from: string | null; to: string | null; gold: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">
        {from ?? '—'}
      </span>
      <span aria-hidden="true" className="text-neutral-400">←</span>
      <span
        className={[
          'rounded-full px-2 py-0.5 text-[11px] font-medium',
          gold ? 'bg-brand-gold-tint text-brand-gold-text' : 'bg-neutral-100 text-neutral-900',
        ].join(' ')}
      >
        {to ?? '—'}
      </span>
    </span>
  );
}

function FieldDiffs({
  changes,
  ta,
  locale,
}: {
  changes: ActivityFieldChange[];
  ta: AuditTranslator;
  locale: Locale;
}) {
  return (
    <div className="space-y-0.5">
      {changes.map((c) => (
        <div key={c.field} className="text-xs leading-snug text-neutral-600">
          <span className="font-medium">{getFieldLabel(ta, c.field)}</span>
          <span className="text-neutral-400">: </span>
          <span className="text-neutral-500 line-through decoration-neutral-400">
            {formatFieldValue(ta, locale, c.field, c.old)}
          </span>
          <span aria-hidden="true" className="mx-1 text-neutral-400">←</span>
          <span className="font-medium text-neutral-900">
            {formatFieldValue(ta, locale, c.field, c.new)}
          </span>
        </div>
      ))}
    </div>
  );
}

function EventDetail({
  event,
  ta,
  locale,
}: {
  event: ActivityEvent;
  ta: AuditTranslator;
  locale: Locale;
}) {
  switch (event.kind) {
    case 'status_changed':
      return <FromToPills from={event.from} to={event.to} gold />;
    case 'advisor_changed':
      return <FromToPills from={event.from} to={event.to} gold={false} />;
    case 'document_status':
      return (
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-900">
          {event.status ? formatFieldValue(ta, locale, 'status', event.status) : '—'}
        </span>
      );
    case 'comment_added':
      return (
        <p className="rounded-md border-s-2 border-brand-gold/40 bg-brand-gold-soft/60 px-2.5 py-1.5 text-xs text-neutral-700 whitespace-pre-wrap break-words">
          {event.excerpt}
        </p>
      );
    case 'email_sent':
      return (
        <p className="text-xs text-neutral-600">
          <span className="font-medium text-neutral-900">{event.subject}</span>
          <span className="text-neutral-400"> · </span>
          <span dir="ltr">{event.recipient}</span>
        </p>
      );
    case 'fields_updated':
      return <FieldDiffs changes={event.changes} ta={ta} locale={locale} />;
    default:
      return null;
  }
}

export function ActivityEventLine({ event, locale }: { event: ActivityEvent; locale: Locale }) {
  const t = useTranslations('caseActivity');
  // Same justified cast as AuditLogTable: the audit helpers need `.has(key)`,
  // which next-intl's t() supports at runtime but doesn't expose in its type.
  const ta = useTranslations('auditLog') as unknown as AuditTranslator;

  const subject = subjectFor(event, ta);
  const fullDate = new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(event.timestamp));

  return (
    <li className="relative flex items-start gap-3">
      <span
        aria-hidden="true"
        className={[
          'z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border shadow-sm',
          toneFor(event),
        ].join(' ')}
      >
        <EventIcon icon={iconFor(event)} className="size-3.5" />
      </span>

      <div className="min-w-0 flex-1 space-y-1 pb-1">
        <p className="text-sm leading-snug text-neutral-900">
          <span className="font-medium">{sentenceFor(event, t)}</span>
          {subject && (
            <>
              <span aria-hidden="true" className="text-neutral-400"> · </span>
              <span className="text-brand-gold-text">{subject}</span>
            </>
          )}
        </p>

        <EventDetail event={event} ta={ta} locale={locale} />

        <p className="text-[11px] text-neutral-500">
          <span>{event.actorName ?? ta('system')}</span>
          <span aria-hidden="true" className="text-neutral-400"> · </span>
          <time dateTime={event.timestamp} title={fullDate} suppressHydrationWarning>
            {formatRelativeTime(event.timestamp, locale)}
          </time>
        </p>
      </div>
    </li>
  );
}
