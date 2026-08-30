import { FileSignature } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { getCaseCollectionsData } from '@/features/collections/services/collections.service';
import { userHasPermissions } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';

import { resolveAgreementState } from '../domain/agreement-state';
import {
  getAgreementClientSnapshot,
  listCaseAgreements,
} from '../services/agreements.service';
import { AgreementAdminClient } from './agreement-admin-client';

/**
 * הסכם התקשרות sub-section of the מנהלה block: did the client sign, send for
 * digital signature, or mark a paper signature. Self-gates on view_collections
 * (the row carries the agreed fee, so it lives inside the financial permission
 * fabric, same as the collections ledger) — renders null, incl. its own
 * header, without it.
 */
export async function CaseAgreementAdminSection({ caseId }: { caseId: string }) {
  const perms = await userHasPermissions('view_collections', 'manage_collections', 'view_case_fee');
  if (!perms.view_collections) return null;

  const id = asCaseId(caseId);
  const [rows, collections, snapshot, t, locale] = await Promise.all([
    listCaseAgreements(caseId),
    getCaseCollectionsData(id),
    getAgreementClientSnapshot(caseId),
    getTranslations('agreements'),
    getLocale().then(parseLocale),
  ]);
  const state = resolveAgreementState(rows, new Date());

  return (
    <div className="pt-2">
      <div className="mb-2 flex items-center gap-2 border-b border-neutral-100 pb-2 pt-5">
        <span aria-hidden="true" className="text-brand-gold-text [&_svg]:size-4">
          <FileSignature />
        </span>
        <h3 className="text-sm font-semibold text-neutral-900">{t('block.title')}</h3>
      </div>
      <AgreementAdminClient
        caseId={caseId}
        initialState={state}
        canManage={perms.manage_collections === true}
        // Sending shows + snapshots the fee — needs the financial permission too.
        canSend={perms.manage_collections === true && perms.view_case_fee === true}
        defaultEmail={snapshot?.email ?? ''}
        defaultFeeTotal={collections.feeAmount}
        defaultFeeAdvance={collections.advanceAmount}
        locale={locale}
      />
    </div>
  );
}
