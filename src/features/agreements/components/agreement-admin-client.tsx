'use client';

import { useEffect, useRef, useState } from 'react';

import { CheckCircle2, ExternalLink, FileText, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { callAction } from '@/lib/actions/call-action';
import { useInlineMutationSync } from '@/lib/hooks/use-inline-mutation-sync';
import type { Locale } from '@/lib/i18n/direction';

import { cancelAgreementAction } from '../actions/cancel-agreement';
import { getAgreementPdfUrlAction } from '../actions/get-agreement-pdf-url';
import { markAgreementSignedAction } from '../actions/mark-agreement-signed';
import { optimisticAgreement } from '../domain/optimistic-agreement';
import { AgreementSmallButton, AgreementStatusChip } from './agreement-status-chip';
import { SendAgreementDialog } from './send-agreement-dialog';

import type { AgreementState } from '../types';

type Props = {
  caseId: string;
  initialState: AgreementState;
  canManage: boolean;
  canSend: boolean;
  defaultEmail: string;
  defaultFeeTotal: number | null;
  defaultFeeAdvance: number | null;
  locale: Locale;
};

/**
 * Client shell for the הסכם התקשרות section: status chip + the actions the
 * current state allows. Optimistic: mutations update a local override
 * immediately and useInlineMutationSync's debounced router.refresh replaces
 * the router-cache payload (FE-1 pattern — no revalidatePath).
 */
export function AgreementAdminClient({
  caseId,
  initialState,
  canManage,
  canSend,
  defaultEmail,
  defaultFeeTotal,
  defaultFeeAdvance,
  locale,
}: Props) {
  const t = useTranslations('agreements.block');
  const [override, setOverride] = useState<AgreementState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { pendingCount, refreshOwed, beginOp, endOp, refreshSoon } = useInlineMutationSync();

  // When a fresh RSC payload lands (initialState changed) and nothing is
  // in flight, the server has caught up — drop the local override.
  const initialKey = JSON.stringify(initialState);
  const lastKey = useRef(initialKey);
  useEffect(() => {
    if (initialKey !== lastKey.current && pendingCount === 0 && !refreshOwed) {
      lastKey.current = initialKey;
      setOverride(null);
    }
  }, [initialKey, pendingCount, refreshOwed]);

  const state = override ?? initialState;
  // While an optimistic override is showing, its agreement id is a placeholder
  // — hold further mutations until the refreshed payload brings the real row.
  const settled = override === null;

  const runAction = async (
    invoke: () => Promise<{ ok: boolean; error?: string }>,
    optimistic: AgreementState,
  ): Promise<void> => {
    setBusy(true);
    beginOp();
    try {
      const res = await callAction(invoke);
      if (!res.ok) {
        toast.error(t(`errors.${'error' in res && res.error ? res.error : 'unknown'}`));
        return;
      }
      setOverride(optimistic);
      refreshSoon();
    } finally {
      endOp();
      setBusy(false);
    }
  };

  const markSigned = (): void => {
    void runAction(() => markAgreementSignedAction(caseId), {
      kind: 'signed',
      agreement: {
        ...optimisticAgreement(caseId),
        status: 'signed',
        signedMethod: 'manual',
        signedAt: new Date().toISOString(),
      },
    });
  };

  const cancel = (agreementId: string): void => {
    void runAction(() => cancelAgreementAction(caseId, agreementId), { kind: 'none' });
  };

  const viewPdf = async (agreementId: string): Promise<void> => {
    const res = await callAction(() => getAgreementPdfUrlAction(caseId, agreementId));
    if (!res.ok) {
      toast.error(t(`errors.${'error' in res && res.error ? res.error : 'unknown'}`));
      return;
    }
    window.open(res.url, '_blank', 'noopener');
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <AgreementStatusChip state={state} locale={locale} />
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {state.kind === 'signed' && state.agreement.signedMethod === 'digital' && (
            <>
              {state.agreement.pdfPath && (
                <AgreementSmallButton
                  onClick={() => void viewPdf(state.agreement.id)}
                  icon={<FileText className="size-3.5" />}
                  label={t('viewPdf')}
                />
              )}
              {state.agreement.driveFileUrl && (
                <a
                  href={state.agreement.driveFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50"
                >
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  {t('driveLink')}
                </a>
              )}
            </>
          )}
          {state.kind === 'signed' && state.agreement.signedMethod === 'manual' && canManage && (
            <AgreementSmallButton
              onClick={() => cancel(state.agreement.id)}
              label={t('unmarkSigned')}
              disabled={busy || !settled}
            />
          )}
          {state.kind === 'sent' && canManage && (
            <AgreementSmallButton
              onClick={() => cancel(state.agreement.id)}
              label={t('cancelLink')}
              disabled={busy || !settled}
            />
          )}
          {state.kind !== 'signed' && canManage && (
            <AgreementSmallButton
              onClick={markSigned}
              icon={<CheckCircle2 className="size-3.5" />}
              label={t('markSigned')}
              disabled={busy || !settled}
            />
          )}
          {state.kind !== 'signed' && canSend && (
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              disabled={busy || !settled}
              className="inline-flex items-center gap-1.5 rounded-md border border-brand-gold/50 px-2.5 py-1 text-xs font-medium text-brand-gold-text transition hover:bg-brand-gold-soft disabled:opacity-50"
            >
              <Send className="size-3.5" aria-hidden="true" />
              {state.kind === 'sent' ? t('resend') : t('send')}
            </button>
          )}
        </div>
      </div>
      {state.kind === 'sent' && state.agreement.clientEmail && (
        <p className="mt-1 text-xs text-neutral-400">
          {t('sentTo', { email: state.agreement.clientEmail })}
        </p>
      )}

      <SendAgreementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        caseId={caseId}
        defaultEmail={defaultEmail}
        defaultFeeTotal={defaultFeeTotal}
        defaultFeeAdvance={defaultFeeAdvance}
        locale={locale}
        onSent={(email, feeTotal, feeAdvance) => {
          setOverride({
            kind: 'sent',
            expired: false,
            agreement: { ...optimisticAgreement(caseId), feeTotal, feeAdvance, clientEmail: email },
          });
          refreshSoon();
        }}
      />
    </div>
  );
}
