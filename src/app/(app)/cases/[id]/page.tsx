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

import { CaseBorrowerCard } from '@/features/borrowers/components/case-borrower-card';
import { listBorrowersForCase } from '@/features/borrowers/services/borrowers.service';
import { CaseBankRow } from '@/features/case-banks/components/case-bank-row';
import { listCaseBanks } from '@/features/case-banks/services/case-banks.service';
import { CaseActionBar } from '@/features/cases/components/case-action-bar';
import { CaseBlock } from '@/features/cases/components/case-block';
import { BlockerRow, DataRow, InsuranceRow } from '@/features/cases/components/case-info-rows';
import { calculateLtv, ltvBand } from '@/features/cases/domain/calculations';
import { formatMoney } from '@/features/cases/domain/format';
import type { CaseBlocker, InsuranceStatus } from '@/features/cases/schemas/case.schema';
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

  const ltv = calculateLtv(caseData.property_value, caseData.requested_mortgage_amount);
  const ltvAccent = ltv !== null ? bandToAccent(ltvBand(ltv)) : undefined;

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                <CaseBorrowerCard
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

        <CaseBlock title="נכס ועסקה" icon={<Home />}>
          <DataRow label="שווי הנכס" value={formatMoney(caseData.property_value)} large />
          <DataRow
            label="גובה משכנתא מבוקש"
            value={formatMoney(caseData.requested_mortgage_amount)}
            large
          />
          <DataRow label="הון עצמי" value={formatMoney(caseData.equity)} />
          {ltv !== null && (
            <DataRow label="LTV" value={`${ltv.toFixed(1)}%`} accent={ltvAccent} />
          )}
        </CaseBlock>

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
            <p className="text-sm text-neutral-500 text-center py-6">טרם נוספו בנקים לתיק</p>
          ) : (
            <div className="space-y-2">
              {banks.map((cb) => (
                <CaseBankRow key={cb.id} caseId={caseData.id} caseBank={cb} />
              ))}
            </div>
          )}
        </CaseBlock>

        <CaseBlock title="מנהלה" icon={<Wallet />}>
          <BlockerRow blocker={caseData.case_blocker as CaseBlocker | null} />
          <InsuranceRow status={caseData.insurance_status as InsuranceStatus | null} />
          <DataRow label="הופנה ע״י" value={caseData.referrer_name ?? '—'} />
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

        <CaseBlock title="משימות" icon={<Briefcase />}>
          <p className="text-sm text-neutral-500 text-center py-4">
            ניהול משימות יתווסף בקרוב
          </p>
        </CaseBlock>

        <CaseBlock title="הערה קצרה" icon={<Briefcase />} fullWidth>
          {caseData.short_note ? (
            <p className="text-sm text-neutral-800 leading-relaxed">{caseData.short_note}</p>
          ) : (
            <p className="text-sm text-neutral-400 italic">
              ללא הערה. מוצגת בדשבורד מתחת לסטטוס - לתזכורות מהירות.
            </p>
          )}
        </CaseBlock>

        <CaseBlock title="פרטי הבקשה (סיפור התיק)" icon={<FileText />} fullWidth>
          {caseData.request_details ? (
            <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">
              {caseData.request_details}
            </p>
          ) : (
            <p className="text-sm text-neutral-400 italic">טרם נכתבו פרטי בקשה מלאים.</p>
          )}
        </CaseBlock>

        <CaseBlock title="מסמכים" icon={<Banknote />} fullWidth>
          <p className="text-sm text-neutral-500 text-center py-4">
            ניהול מסמכים + סנכרון Google Drive יתווסף בקרוב
          </p>
        </CaseBlock>
      </div>

      <div className="text-center text-xs text-neutral-400 pt-4">
        <Link
          href={`/cases/${caseData.id}/edit`}
          className="inline-flex items-center gap-1 hover:text-[#C9A961] transition"
        >
          <Pencil className="size-3" />
          ערוך פרטים בסיסיים (זמני - עד שיתווסף inline edit מלא)
        </Link>
        <span className="mx-2">·</span>
        <Settings className="size-3 inline-block align-middle" />
        <span className="ms-1">ינוהל מההגדרות</span>
      </div>
    </div>
  );
}

function bandToAccent(band: ReturnType<typeof ltvBand>): 'green' | 'yellow' | 'red' {
  if (band === 'high') return 'red';
  if (band === 'moderate') return 'yellow';
  return 'green';
}

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
