import { Coins } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { userHasPermission } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';

import { getCaseCollectionsData, listCaseFeePayments } from '../services/collections.service';
import { CollectionsCompact } from './collections-compact';

/**
 * Collections sub-section of the מנהלה (admin) block — a compact summary that
 * expands to the ledger. Self-gates on view_collections (renders null without
 * it, incl. its own header) so the admin block never shows an empty section.
 * Replaces the former standalone CaseCollectionsBlock; the full management
 * surface lives on the central /collections dashboard.
 */
export async function CaseCollectionsAdminSection({ caseId }: { caseId: string }) {
  if (!(await userHasPermission('view_collections'))) return null;

  const id = asCaseId(caseId);
  const [canManage, payments, collectionsData, t, locale] = await Promise.all([
    userHasPermission('manage_collections'),
    listCaseFeePayments(id),
    getCaseCollectionsData(id),
    getTranslations('collections'),
    getLocale().then(parseLocale),
  ]);
  const { feeAmount, advanceAmount, expenses, isExecution } = collectionsData;

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());

  return (
    <div className="pt-2">
      <div className="mb-2 flex items-center gap-2 border-b border-neutral-100 pb-2 pt-5">
        <span aria-hidden="true" className="text-brand-gold-text [&_svg]:size-4">
          <Coins />
        </span>
        <h3 className="text-sm font-semibold text-neutral-900">{t('block.title')}</h3>
      </div>
      <CollectionsCompact
        caseId={caseId}
        payments={payments}
        feeAmount={feeAmount}
        advanceAmount={advanceAmount}
        expenses={expenses}
        isExecution={isExecution}
        canManage={canManage}
        defaultDate={today}
        locale={locale}
      />
    </div>
  );
}
