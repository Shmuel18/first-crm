import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  Banknote,
  Briefcase,
  Building2,
  FileText,
  Home,
  Pencil,
  Settings,
  UserCircle2,
  Wallet,
} from 'lucide-react';

import { listBorrowersForCase } from '@/features/borrowers/services/borrowers.service';
import { listCaseBanks } from '@/features/case-banks/services/case-banks.service';
import { CaseActionBar } from '@/features/cases/components/case-action-bar';
import { CaseBlock } from '@/features/cases/components/case-block';
import {
  CASE_BLOCKER_LABELS,
  INSURANCE_STATUS_LABELS,
  type CaseBlocker,
  type InsuranceStatus,
} from '@/features/cases/schemas/case.schema';
import { getCaseById } from '@/features/cases/services/cases.service';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ id: string }> };

export default async function CaseDetailPage({ params }: Props) {
  const { id } = await params;

  const [caseData, borrowers, banks] = await Promise.all([
    getCaseById(id),
    listBorrowersForCase(id),
    listCaseBanks(id),
  ]);

  if (!caseData) notFound();

  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  const canSeeFinancials = isAdmin === true;

  const borrowerNames =
    borrowers
      .map(({ borrower }) =>
        [borrower.first_name, borrower.last_name].filter(Boolean).join(' '),
      )
      .filter(Boolean)
      .join(' ו') || '';

  const advisor =
    [caseData.assigned_advisor?.first_name, caseData.assigned_advisor?.last_name]
      .filter(Boolean)
      .join(' ') || '— לא מוקצה';

  const ltv =
    caseData.property_value && caseData.requested_mortgage_amount
      ? (Number(caseData.requested_mortgage_amount) / Number(caseData.property_value)) * 100
      : null;

  return (
    <div className="space-y-5 -mt-6" dir="rtl">
      <CaseActionBar
        caseNumber={caseData.case_number}
        statusName={caseData.status?.name_he ?? null}
        statusColor={caseData.status?.color ?? null}
        caseTypePrimary={caseData.case_type_primary?.name_he ?? null}
        caseTypeSecondary={caseData.case_type_secondary?.name_he ?? null}
        borrowerNames={borrowerNames}
      />

      {/* Content blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Block 1: Borrowers (Personal) */}
        <CaseBlock
          title={`לווים ${borrowers.length > 0 ? `(${borrowers.length})` : ''}`}
          icon={<UserCircle2 />}
          fullWidth
          rightSlot={
            <Link
              href={`/cases/${caseData.id}/borrowers/new`}
              className="text-xs text-[#C9A961] hover:underline font-medium"
            >
              + הוסף לווה
            </Link>
          }
        >
          {borrowers.length === 0 ? (
            <EmptyBorrowers caseId={caseData.id} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {borrowers.map(({ borrower, role_in_case, is_primary }) => (
                <BorrowerCard
                  key={borrower.id}
                  caseId={caseData.id}
                  borrower={borrower}
                  roleInCase={role_in_case}
                  isPrimary={is_primary}
                />
              ))}
            </div>
          )}
        </CaseBlock>

        {/* Block 2: Property */}
        <CaseBlock title="נכס ועסקה" icon={<Home />}>
          <DataRow label="שווי הנכס" value={formatMoney(caseData.property_value)} large />
          <DataRow
            label="גובה משכנתא מבוקש"
            value={formatMoney(caseData.requested_mortgage_amount)}
            large
          />
          <DataRow label="הון עצמי" value={formatMoney(caseData.equity)} />
          {ltv !== null && (
            <DataRow
              label="LTV (יחס משכנתא/שווי)"
              value={`${ltv.toFixed(1)}%`}
              accent={ltv > 75 ? 'red' : ltv > 60 ? 'yellow' : 'green'}
            />
          )}
        </CaseBlock>

        {/* Block 3: Banks */}
        <CaseBlock
          title={`בנקים ${banks.length > 0 ? `(${banks.length})` : ''}`}
          icon={<Building2 />}
          rightSlot={
            <Link
              href={`/cases/${caseData.id}/banks/new`}
              className="text-xs text-[#C9A961] hover:underline font-medium"
            >
              + הוסף בנק
            </Link>
          }
        >
          {banks.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-6">
              טרם נוספו בנקים לתיק
            </p>
          ) : (
            <div className="space-y-2">
              {banks.map((cb) => (
                <BankRow key={cb.id} caseId={caseData.id} cb={cb} />
              ))}
            </div>
          )}
        </CaseBlock>

        {/* Block 4: Admin Info */}
        <CaseBlock title="מנהלה" icon={<Wallet />}>
          <BlockerRow blocker={caseData.case_blocker as CaseBlocker | null} />
          <InsuranceRow status={caseData.insurance_status as InsuranceStatus | null} />
          <DataRow
            label="הופנה ע״י"
            value={caseData.referrer_name ?? '—'}
          />
          <DataRow label="יועץ מטפל" value={advisor} />
          <DataRow
            label="תאריך פתיחה"
            value={new Date(caseData.created_at).toLocaleDateString('he-IL')}
          />
          {canSeeFinancials && (
            <>
              <DataRow
                label="שכ&quot;ט סוכם"
                value={formatMoney(caseData.fee_amount)}
                accent="gold"
              />
              <DataRow
                label="הכנסה צפויה"
                value={formatMoney(caseData.expected_income)}
                accent="gold"
              />
            </>
          )}
        </CaseBlock>

        {/* Block 5: Short Note (separate from full case story) */}
        <CaseBlock title="הערה קצרה" icon={<Briefcase />} fullWidth>
          {caseData.short_note ? (
            <p className="text-sm text-neutral-800 leading-relaxed">{caseData.short_note}</p>
          ) : (
            <p className="text-sm text-neutral-400 italic">
              ללא הערה. מוצגת בדשבורד מתחת לסטטוס - לתזכורות מהירות.
            </p>
          )}
        </CaseBlock>

        {/* Block 6: Request Details - the full case story */}
        <CaseBlock title="פרטי הבקשה (סיפור התיק)" icon={<FileText />} fullWidth>
          {caseData.request_details ? (
            <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">
              {caseData.request_details}
            </p>
          ) : (
            <p className="text-sm text-neutral-400 italic">
              טרם נכתבו פרטי בקשה מלאים.
            </p>
          )}
        </CaseBlock>

        {/* Block 7: Documents Placeholder */}
        <CaseBlock title="מסמכים" icon={<Banknote />} fullWidth>
          <p className="text-sm text-neutral-500 text-center py-4">
            ניהול מסמכים + סנכרון Google Drive יתווסף בקרוב
          </p>
        </CaseBlock>
      </div>

      {/* Quick edit link */}
      <div className="text-center text-xs text-neutral-400 pt-4">
        <Link
          href={`/cases/${caseData.id}/edit`}
          className="inline-flex items-center gap-1 hover:text-[#C9A961] transition"
        >
          <Pencil className="size-3" />
          ערוך פרטים בסיסיים (זמני - עד שיתווסף inline edit)
        </Link>
        <span className="mx-2">·</span>
        <Settings className="size-3 inline-block align-middle" />
        <span className="ms-1">ינוהל מההגדרות</span>
      </div>
    </div>
  );
}

// ============= Sub-components =============

import type { BorrowerRow, RoleInCase } from '@/features/borrowers/types';
import type { CaseBankWithRelations } from '@/features/case-banks/types';

import { CaseStatusBadge } from '@/features/cases/components/case-status-badge';

function EmptyBorrowers({ caseId }: { caseId: string }) {
  return (
    <div className="text-center py-8">
      <p className="text-sm text-neutral-500 mb-3">טרם נוספו לווים לתיק</p>
      <Link
        href={`/cases/${caseId}/borrowers/new`}
        className="btn-gold inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
      >
        הוסף לווה ראשון
      </Link>
    </div>
  );
}

function BorrowerCard({
  caseId,
  borrower,
  roleInCase,
  isPrimary,
}: {
  caseId: string;
  borrower: BorrowerRow;
  roleInCase: RoleInCase;
  isPrimary: boolean;
}) {
  const fullName =
    [borrower.first_name, borrower.last_name].filter(Boolean).join(' ') || '(ללא שם)';
  const roleLabel = roleInCase === 'guarantor' ? 'ערב' : 'לווה';

  return (
    <div className="border border-neutral-200 rounded-lg p-4 hover:border-[#C9A961]/30 hover:bg-[#C9A961]/5 transition group">
      <div className="flex items-start justify-between mb-3 pb-3 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <span className="size-9 rounded-full bg-neutral-100 flex items-center justify-center">
            <UserCircle2 className="size-5 text-neutral-500" />
          </span>
          <div className="flex flex-col">
            <span className="font-medium text-neutral-900 text-sm">{fullName}</span>
            <span className="text-xs text-neutral-500">
              {roleLabel}
              {isPrimary && ' · ראשי'}
            </span>
          </div>
        </div>
        <Link
          href={`/cases/${caseId}/borrowers/${borrower.id}/edit`}
          className="opacity-0 group-hover:opacity-100 transition size-7 rounded hover:bg-white flex items-center justify-center"
          title="ערוך"
        >
          <Pencil className="size-3 text-neutral-500" />
        </Link>
      </div>

      <div className="space-y-1.5 text-xs">
        {borrower.national_id && (
          <Field label="ת״ז" value={borrower.national_id} mono />
        )}
        {borrower.phone && <Field label="טלפון" value={borrower.phone} mono />}
        {borrower.email && <Field label="מייל" value={borrower.email} />}
        {borrower.address && <Field label="כתובת" value={borrower.address} />}
      </div>
    </div>
  );
}

function BankRow({ caseId, cb }: { caseId: string; cb: CaseBankWithRelations }) {
  return (
    <Link
      href={`/cases/${caseId}/banks/${cb.id}/edit`}
      className="flex items-center justify-between gap-3 p-3 border border-neutral-200 rounded-lg hover:border-[#C9A961]/30 hover:bg-[#C9A961]/5 transition"
    >
      <div className="flex items-center gap-3 flex-1">
        {cb.bank?.color && (
          <span
            className="size-3 rounded-full shrink-0"
            style={{ backgroundColor: cb.bank.color }}
          />
        )}
        <span className="font-medium text-sm text-neutral-900">
          {cb.bank?.name_he ?? '—'}
        </span>
        {cb.is_primary && (
          <span className="text-[10px] text-[#C9A961] font-bold">★ עיקרי</span>
        )}
        {cb.banker_name && (
          <span className="text-xs text-neutral-500">· {cb.banker_name}</span>
        )}
      </div>
      <CaseStatusBadge name={cb.status?.name_he ?? null} color={cb.status?.color ?? null} />
    </Link>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-neutral-500 min-w-12 shrink-0">{label}:</span>
      <span className={['text-neutral-800', mono ? 'font-mono' : ''].join(' ')} dir={mono ? 'ltr' : undefined}>
        {value}
      </span>
    </div>
  );
}

function BlockerRow({ blocker }: { blocker: CaseBlocker | null }) {
  if (!blocker) {
    return <DataRow label="גורם מעכב" value="לא צוין" />;
  }
  const config = CASE_BLOCKER_LABELS[blocker];
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-neutral-100">
      <span className="text-sm text-neutral-600">גורם מעכב</span>
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ backgroundColor: `${config.color}25`, color: config.color }}
      >
        <span className="size-1.5 rounded-full" style={{ backgroundColor: config.color }} />
        {config.he}
      </span>
    </div>
  );
}

function InsuranceRow({ status }: { status: InsuranceStatus | null }) {
  if (!status) {
    return <DataRow label="ביטוחים" value="לא צוין" />;
  }
  const config = INSURANCE_STATUS_LABELS[status];
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-neutral-100">
      <span className="text-sm text-neutral-600">ביטוחים</span>
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ backgroundColor: `${config.color}25`, color: config.color }}
      >
        {config.he}
      </span>
    </div>
  );
}

function DataRow({
  label,
  value,
  large,
  accent,
}: {
  label: string;
  value: string;
  large?: boolean;
  accent?: 'gold' | 'red' | 'green' | 'yellow';
}) {
  const accentClasses = {
    gold: 'text-[#C9A961]',
    red: 'text-red-600',
    green: 'text-emerald-600',
    yellow: 'text-amber-600',
  };
  const valueClass = [
    'tabular-nums font-semibold',
    large ? 'text-base' : 'text-sm',
    accent ? accentClasses[accent] : 'text-neutral-900',
  ].join(' ');

  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-neutral-100 last:border-b-0">
      <span className="text-sm text-neutral-600">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

function formatMoney(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return '—';
  return `₪${n.toLocaleString('he-IL')}`;
}
