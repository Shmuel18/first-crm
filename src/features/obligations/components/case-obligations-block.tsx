import { CreditCard } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { CaseBlock } from '@/features/cases/components/case-block';
import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';

import { listObligationsFlatForCase } from '../services/obligations.service';
import { CaseObligationsList } from './case-obligations-list';

type Props = { caseId: string };

/**
 * Case-level obligations block. Obligations are accounted for at the case
 * level (a couple's combined debt picture), so the UI lists them flat
 * instead of splitting per borrower. New obligations are billed to the
 * primary borrower in the DB; the visible list is unified.
 *
 * Hidden when the caller lacks `view_case_obligations` so an empty shell
 * doesn't leak the case structure to non-viewers.
 */
export async function CaseObligationsBlock({ caseId }: Props) {
  const t = await getTranslations('obligations');
  const [canView, canEdit] = await Promise.all([
    userHasPermission('view_case_obligations'),
    userCanEditCase(caseId),
  ]);
  if (!canView) return null;

  const locale = parseLocale(await getLocale());

  let view: Awaited<ReturnType<typeof listObligationsFlatForCase>> = {
    obligations: [],
    primaryBorrowerId: null,
    monthlyPaymentTotal: 0,
    remainingDebtTotal: 0,
  };
  try {
    view = await listObligationsFlatForCase(asCaseId(caseId));
  } catch (err) {
    // Flatten to a single-line STRING so console.error in dev overlay /
    // Chrome devtools shows the fields directly instead of collapsing to
    // "Object". JSON.stringify catches own-properties — covers Supabase
    // PostgrestError shape (message / code / details / hint) AND any
    // future shape we haven't enumerated.
    const summary =
      err instanceof Error
        ? `${err.name}: ${err.message}`
        : err && typeof err === 'object'
          ? JSON.stringify(err, Object.getOwnPropertyNames(err))
          : String(err);
    console.error(`[CaseObligationsBlock] data fetch failed — ${summary}`);
  }

  const fmt = new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-US', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  });

  return (
    <CaseBlock
      title={t('blockTitle')}
      icon={<CreditCard />}
      fullWidth
      blockKey="obligations"
      rightSlot={
        view.obligations.length > 0 && (
          <span className="text-xs text-neutral-600">
            {t('grandTotal')}:{' '}
            <span className="font-semibold text-neutral-900">
              {fmt.format(view.monthlyPaymentTotal)}
            </span>
          </span>
        )
      }
    >
      {view.primaryBorrowerId === null ? (
        <p className="text-sm text-neutral-600 text-center py-4">{t('noBorrowers')}</p>
      ) : (
        <CaseObligationsList
          caseId={caseId}
          primaryBorrowerId={view.primaryBorrowerId}
          obligations={view.obligations}
          monthlyPaymentTotal={view.monthlyPaymentTotal}
          remainingDebtTotal={view.remainingDebtTotal}
          locale={locale}
          canEdit={canEdit}
        />
      )}
    </CaseBlock>
  );
}
