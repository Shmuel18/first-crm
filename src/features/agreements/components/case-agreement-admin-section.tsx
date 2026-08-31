import { FileSignature } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { userHasPermissions } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';

import { resolveAgreementState } from '../domain/agreement-state';
import { getAgreementClientSnapshot, listCaseAgreements } from '../services/agreements.service';
import { AgreementAdminClient } from './agreement-admin-client';

/**
 * הסכם התקשרות sub-section of the מנהלה block: did the client sign, send for
 * digital signature, or mark a paper signature.
 *
 * Self-gates on view_collections OR send_client_agreement — the second is what
 * lets the office delegate sending (e.g. to the secretary) without handing
 * over the collections module. Renders null, incl. its own header, for anyone
 * holding neither.
 */
export async function CaseAgreementAdminSection({ caseId }: { caseId: string }) {
  const perms = await userHasPermissions('view_collections', 'send_client_agreement');
  const canSend = perms.send_client_agreement === true;
  if (perms.view_collections !== true && !canSend) return null;

  const [rows, snapshot, t, locale] = await Promise.all([
    listCaseAgreements(caseId),
    getAgreementClientSnapshot(caseId),
    getTranslations('agreements'),
    getLocale().then(parseLocale),
  ]);
  const state = resolveAgreementState(rows, new Date());

  // Seed the dialog from the last agreement's terms so a re-send repeats them
  // instead of making the sender retype the rate.
  const previous = rows[0] ?? null;

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
        canManage={canSend}
        defaultEmail={snapshot?.email ?? ''}
        defaultFeePercent={previous?.feePercent ?? null}
        defaultFeeAdvance={previous?.feeAdvance ?? null}
        loanAmount={snapshot?.loanAmount ?? null}
        locale={locale}
      />
    </div>
  );
}
