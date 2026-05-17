import Link from 'next/link';

import {
  Archive,
  Bookmark,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Plus,
  Sprout,
  Star,
  User,
} from 'lucide-react';

import { CaseTableRow, type CaseTableRowData } from '@/features/cases/components/case-table-row';
import {
  getCaseClientLabel,
  getPrimaryBank,
  getPrimaryBorrowerNationalId,
  getSecondaryBanksCount,
  listCases,
} from '@/features/cases/services/cases.service';
import { createClient } from '@/lib/supabase/server';

export default async function CasesListPage() {
  const supabase = await createClient();
  const [casesResult, profileResult, statusesResult, banksResult, advisorsResult] =
    await Promise.all([
      listCases({ isArchived: false }),
      supabase.auth.getUser().then(async ({ data }) => {
        if (!data.user) return null;
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', data.user.id)
          .single();
        return profile;
      }),
      supabase
        .from('case_statuses')
        .select('id, name_he, color')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('banks')
        .select('id, name_he, color, logo_url')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('is_active', true)
        .order('first_name'),
    ]);

  const cases = casesResult;
  const firstName = profileResult?.first_name ?? '';
  const statusOptions = statusesResult.data ?? [];
  const bankOptions = banksResult.data ?? [];
  const advisorOptions = advisorsResult.data ?? [];

  const stuckCount = cases.filter((c) => c.status?.key === 'stuck').length;
  const newThisWeek = cases.filter((c) => {
    const daysAgo = (Date.now() - new Date(c.created_at).getTime()) / 86400000;
    return daysAgo <= 7;
  }).length;

  return (
    <div className="-mx-6 -mt-6" dir="rtl">
      {/* Welcome Banner */}
      <WelcomeBanner firstName={firstName} casesCount={cases.length} stuckCount={stuckCount} />

      {/* View Selector */}
      <ViewSelector activeCount={cases.length} />

      {/* Filters Bar */}
      <FiltersBar />

      {/* Saved Views Row */}
      <SavedViewsRow />

      {/* Top Summary */}
      <div className="bg-white px-6 py-3 border-b border-neutral-200">
        <div className="flex items-center gap-6 text-sm flex-wrap">
          <SummaryItem icon={FolderOpen} label="תיקים פעילים" value={cases.length} accent="#0A0A0A" />
          <SummaryDivider />
          <SummaryItem
            icon={Star}
            label="תקועים"
            value={stuckCount}
            accent={stuckCount > 0 ? '#DC2626' : '#0A0A0A'}
          />
          <SummaryDivider />
          <SummaryItem
            icon={Sprout}
            label="חדשים השבוע"
            value={newThisWeek}
            accent="#10B981"
          />
          <SummaryDivider />
          <span className="text-neutral-500">מציג {cases.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white">
        {cases.length === 0 ? (
          <EmptyState />
        ) : (
          <CasesTable
            cases={cases}
            statusOptions={statusOptions}
            bankOptions={bankOptions}
            advisorOptions={advisorOptions}
          />
        )}
      </div>
    </div>
  );
}

function WelcomeBanner({
  firstName,
  casesCount,
  stuckCount,
}: {
  firstName: string;
  casesCount: number;
  stuckCount: number;
}) {
  const greeting = getGreeting();
  const insight = getInsight(casesCount, stuckCount);

  return (
    <div className="bg-gradient-to-l from-[#FAFAFA] via-white to-[#FAFAFA] px-6 py-5 border-b border-neutral-200">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-neutral-900 leading-tight">
            {greeting}
            {firstName && (
              <>
                , <span className="text-[#C9A961]">{firstName}</span>
              </>
            )}
          </h1>
          {insight && <p className="text-sm text-neutral-500 mt-1">{insight}</p>}
        </div>
        <div className="text-xs text-neutral-400">
          {new Date().toLocaleDateString('he-IL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'בוקר טוב';
  if (hour < 18) return 'צהריים טובים';
  if (hour < 22) return 'ערב טוב';
  return 'לילה טוב';
}

function getInsight(cases: number, stuck: number): string {
  if (cases === 0) return 'מתחילים נקי - צור את התיק הראשון שלך';
  if (stuck > 0) {
    return `יש ${stuck === 1 ? 'תיק תקוע אחד' : `${stuck} תיקים תקועים`} שדורש${stuck === 1 ? '' : 'ים'} תשומת לב`;
  }
  if (cases === 1) return 'תיק אחד פעיל במערכת';
  return `${cases} תיקים פעילים במערכת - הכל זורם`;
}

function ViewSelector({ activeCount }: { activeCount: number }) {
  return (
    <div className="bg-white px-6 py-3 border-b border-neutral-200 flex gap-2">
      <ViewTab icon={FolderOpen} label="תיקים פעילים" count={activeCount} active />
      <ViewTab icon={Sprout} label="לידים" count={0} />
      <ViewTab icon={Archive} label="ארכיון" count={0} />
    </div>
  );
}

function ViewTab({
  icon: Icon,
  label,
  count,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition',
        active
          ? 'bg-[#0A0A0A] text-white'
          : 'bg-neutral-50 border border-neutral-200 text-neutral-600 hover:border-[#C9A961] hover:text-[#0A0A0A]',
      ].join(' ')}
    >
      <Icon className="size-4" />
      <span>{label}</span>
      {count > 0 && (
        <span
          className={[
            'inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold',
            active ? 'bg-[#C9A961] text-[#0A0A0A]' : 'bg-neutral-200 text-neutral-700',
          ].join(' ')}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function FiltersBar() {
  return (
    <div className="bg-white px-6 py-3 border-b border-neutral-200 flex items-center gap-2 flex-wrap">
      <FilterChip icon={User} label="התיקים שלי" />
      <FilterChip label="שלב בתהליך" />
      <FilterChip label="בנק" />
      <FilterChip label="גורם מעכב" />
      <div className="flex-1" />
      <ToggleSwitch label="רק תקועים" />
      <ToggleSwitch label="הסתר בוצעו והוקפאו" on />
    </div>
  );
}

function FilterChip({
  icon: Icon,
  label,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 text-sm text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 transition"
    >
      {Icon && <Icon className="size-3.5 text-neutral-400" />}
      <span>{label}</span>
      <ChevronDown className="size-3.5 text-neutral-400" />
    </button>
  );
}

function ToggleSwitch({ label, on }: { label: string; on?: boolean }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
      <span
        className={[
          'relative w-9 h-5 rounded-full transition',
          on ? 'bg-[#C9A961]' : 'bg-neutral-300',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 size-4 rounded-full bg-white transition',
            on ? 'right-0.5' : 'right-[18px]',
          ].join(' ')}
        />
      </span>
      <span className="text-neutral-700">{label}</span>
    </label>
  );
}

function SavedViewsRow() {
  return (
    <div className="bg-white px-6 py-2 border-b border-neutral-200 flex items-center gap-2">
      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-700 hover:bg-neutral-50 transition">
        <Bookmark className="size-3.5" />
        תצוגות שמורות
        <ChevronDown className="size-3.5" />
      </button>
      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#C9A961] hover:bg-[#C9A961]/10 transition">
        <Star className="size-3.5" />
        שמור תצוגה נוכחית
      </button>
      <div className="flex-1" />
      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-700 hover:bg-neutral-50 transition">
        <FileSpreadsheet className="size-3.5" />
        ייצוא לאקסל
      </button>
      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-700 hover:bg-neutral-50 transition">
        <FileText className="size-3.5" />
        ייצוא ל-PDF
      </button>
    </div>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="inline-flex items-center gap-2" style={{ color: accent }}>
      <Icon className="size-4" />
      <span className="font-bold tabular-nums">{value}</span>
      <span className="text-neutral-600">{label}</span>
    </div>
  );
}

function SummaryDivider() {
  return <span className="text-neutral-300">·</span>;
}

function EmptyState() {
  return (
    <div className="bg-white border-t border-neutral-200 p-20 text-center">
      <div className="size-16 mx-auto rounded-full bg-neutral-100 flex items-center justify-center mb-4">
        <FolderOpen className="size-8 text-neutral-400" />
      </div>
      <p className="text-neutral-600 mb-1 text-base font-medium">אין עדיין תיקים פעילים</p>
      <p className="text-sm text-neutral-500 mb-5">
        צור תיק ראשון או ייבא נתונים מ-Excel קיים
      </p>
      <Link
        href="/cases/new"
        className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm"
      >
        <Plus className="size-4" />
        פתיחת תיק חדש
      </Link>
    </div>
  );
}

type Case = Awaited<ReturnType<typeof listCases>>[number];
type StatusOption = { id: string; name_he: string; color: string };
type BankOption = { id: string; name_he: string; color: string; logo_url: string | null };
type AdvisorOption = { id: string; first_name: string | null; last_name: string | null };

function toRowData(c: Case, index: number): CaseTableRowData {
  const advisor =
    [c.assigned_advisor?.first_name, c.assigned_advisor?.last_name]
      .filter(Boolean)
      .join(' ') || null;
  const primaryBank = getPrimaryBank(c);

  return {
    id: c.id,
    index,
    clientLabel: getCaseClientLabel(c),
    nationalId: getPrimaryBorrowerNationalId(c),
    statusId: c.status_id,
    statusName: c.status?.name_he ?? null,
    statusColor: c.status?.color ?? null,
    primaryBank: primaryBank
      ? {
          id: primaryBank.id,
          name_he: primaryBank.name_he,
          color: primaryBank.color,
          logo_url: primaryBank.logo_url,
        }
      : null,
    secondaryBanksCount: getSecondaryBanksCount(c),
    advisorId: c.assigned_advisor_id,
    advisorName: advisor,
    shortNote: c.short_note ?? null,
    isStuck: c.status?.key === 'stuck',
    isFrozen: c.status?.key === 'on_hold' || c.status?.key === 'closed',
    isRecent: (Date.now() - new Date(c.updated_at).getTime()) / 86400000 < 1,
    updatedAt: c.updated_at,
  };
}

function CasesTable({
  cases,
  statusOptions,
  bankOptions,
  advisorOptions,
}: {
  cases: Case[];
  statusOptions: ReadonlyArray<StatusOption>;
  bankOptions: ReadonlyArray<BankOption>;
  advisorOptions: ReadonlyArray<AdvisorOption>;
}) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full table-fixed min-w-[1100px]">
        <colgroup>
          <col className="w-12" />
          <col className="w-52" />
          <col className="w-32" />
          <col className="w-48" />
          <col className="w-44" />
          <col className="w-44" />
          <col />
        </colgroup>
        <thead>
          <tr className="border-b-2 border-neutral-200">
            <Th>#</Th>
            <Th>שם לקוח</Th>
            <Th>ת״ז / דרכון</Th>
            <Th>שלב בתהליך</Th>
            <Th>בנק</Th>
            <Th>עובד מטפל</Th>
            <Th>הערה קצרה</Th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c, index) => (
            <CaseTableRow
              key={c.id}
              row={toRowData(c, index + 1)}
              statusOptions={statusOptions}
              bankOptions={bankOptions}
              advisorOptions={advisorOptions}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3">
      {children}
    </th>
  );
}

