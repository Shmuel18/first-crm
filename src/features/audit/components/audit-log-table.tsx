'use client';

import { useLocale, useTranslations } from 'next-intl';

import { formatFieldValue, getFieldLabel } from '../lib/field-labels';
import type { AuditEntry, AuditFieldChange } from '../services/audit.service';

const ACTION_STYLE: Record<string, string> = {
  INSERT: 'bg-emerald-100 text-emerald-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-rose-100 text-rose-800',
};

// Table names we have a friendly i18n label for. Anything else falls back
// to the raw table_name string (useful while audit coverage grows).
const KNOWN_TABLES = [
  'cases',
  'borrowers',
  'borrower_incomes',
  'borrower_obligations',
  'case_banks',
  'documents',
  'case_borrowers',
  'case_financials',
  'tasks',
  'leads',
] as const;
type KnownTable = (typeof KNOWN_TABLES)[number];
function isKnownTable(name: string): name is KnownTable {
  return (KNOWN_TABLES as readonly string[]).includes(name);
}

export function AuditLogTable({ entries }: { entries: ReadonlyArray<AuditEntry> }) {
  const t = useTranslations('auditLog');
  const locale = useLocale();
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'he' ? 'he-IL' : 'en-GB');

  if (entries.length === 0) {
    return <p className="px-6 py-12 text-center text-sm text-neutral-600">{t('empty')}</p>;
  }

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full table-fixed min-w-[820px]">
        <caption className="sr-only">{t('title')}</caption>
        <colgroup>
          <col className="w-44" />
          <col className="w-40" />
          <col className="w-28" />
          <col className="w-36" />
          <col />
        </colgroup>
        <thead>
          <tr className="bg-neutral-100 border-b-2 border-neutral-300">
            <Th>{t('columns.time')}</Th>
            <Th>{t('columns.user')}</Th>
            <Th>{t('columns.action')}</Th>
            <Th>{t('columns.table')}</Th>
            <Th>{t('columns.changes')}</Th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-neutral-100 hover:bg-neutral-50/60">
              <Td className="text-neutral-600 tabular-nums" dir="ltr">
                {fmt(entry.timestamp)}
              </Td>
              <Td className="text-neutral-800">{entry.actorName ?? t('system')}</Td>
              <Td>
                <span
                  className={[
                    'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium',
                    ACTION_STYLE[entry.action] ?? 'bg-neutral-100 text-neutral-700',
                  ].join(' ')}
                >
                  {actionLabel(t, entry.action)}
                </span>
              </Td>
              <Td className="text-xs text-neutral-700">
                {isKnownTable(entry.tableName) ? t(`tables.${entry.tableName}`) : entry.tableName}
              </Td>
              <Td className="text-xs text-neutral-600">
                <ChangesCell entry={entry} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function actionLabel(t: ReturnType<typeof useTranslations>, action: string): string {
  const key = action.toLowerCase();
  if (key === 'insert' || key === 'update' || key === 'delete') return t(`actions.${key}`);
  return action;
}

function ChangesCell({ entry }: { entry: AuditEntry }) {
  // UPDATE: render each diff as "label: old ← new" on its own line.
  // Field labels and values are both run through the field-labels helper —
  // so the user sees "סוג תושבות: תושב/ת חוץ ← תושב/ת ישראל" instead of
  // "residency_type: foreign_resident ← resident".
  if (entry.changes) {
    const fields = Object.entries(entry.changes);
    return (
      <div className="space-y-0.5">
        {fields.map(([field, change]) => (
          <div key={field} className="leading-tight">
            <span className="text-[12px] text-neutral-600 font-medium">
              {getFieldLabel(field)}
            </span>
            <span className="text-neutral-400">: </span>
            <DiffValue field={field} value={change.old} variant="old" />
            <span className="text-neutral-400 mx-1">←</span>
            <DiffValue field={field} value={change.new} variant="new" />
          </div>
        ))}
      </div>
    );
  }

  // INSERT / DELETE: the trigger stored the whole row. Don't dump every
  // column — just hint at the action and let the user dive into the row
  // elsewhere if needed.
  if (entry.wholeRow) {
    const count = Object.keys(entry.wholeRow).length;
    return <span className="text-neutral-500 italic">({count} שדות)</span>;
  }

  return <span className="text-neutral-400">—</span>;
}

function DiffValue({
  field,
  value,
  variant,
}: {
  field: string;
  value: AuditFieldChange['old'];
  variant: 'old' | 'new';
}) {
  const display = formatFieldValue(field, value);
  return (
    <span
      className={
        variant === 'old'
          ? 'text-neutral-500 line-through decoration-neutral-400'
          : 'text-neutral-900 font-medium'
      }
    >
      {display}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="text-start px-4 py-2.5 text-xs font-semibold text-neutral-600 uppercase tracking-wide"
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  dir,
}: {
  children: React.ReactNode;
  className?: string;
  dir?: 'ltr';
}) {
  return (
    <td dir={dir} className={`px-4 py-2.5 text-sm ${className ?? ''}`}>
      {children}
    </td>
  );
}
