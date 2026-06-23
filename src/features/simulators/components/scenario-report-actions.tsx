'use client';

import { useState, useTransition } from 'react';

import { Download, Loader2, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ComposeEmailDialog } from '@/components/shared/compose-email-dialog';

import { emailScenarioReportAction } from '../actions/email-scenario-report';
import { generateReportPdfAction } from '../actions/generate-report-pdf';

type Props = {
  scenarioId: string;
  /** Live advisor conclusion to bake into the PDF (overrides the saved value). */
  conclusion: string;
  /** Only case-scoped scenarios can be emailed to a client. */
  canSend?: boolean;
};
type Draft = { subject: string; body: string };

/**
 * Download the rendered scenario PDF, or email it to the client (branded, PDF
 * attached, reviewed in the compose dialog first). Shared by the report page
 * and the mix workspace footer — the scenario must already be saved.
 */
export function ScenarioReportActions({ scenarioId, conclusion, canSend = false }: Props) {
  const t = useTranslations('simulators.report');
  const [isPending, startTransition] = useTransition();
  const [isSending, startSendTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);

  const handleDownload = () => {
    if (isPending) return;
    startTransition(async () => {
      const result = await generateReportPdfAction({ scenarioId, advisorConclusion: conclusion.trim() || null });
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      // base64 → bytes → Blob → object URL → anchor click → revoke.
      const binary = atob(result.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleSend = (subject: string, body: string, locale: 'he' | 'en') => {
    startSendTransition(async () => {
      const res = await emailScenarioReportAction({ scenarioId, locale, subject, body, advisorConclusion: conclusion.trim() || null });
      if (res.ok) {
        toast.success(t('emailSent'));
        setDraft(null);
        return;
      }
      toast.error(t(`errors.${res.error}`));
      if (res.error !== 'unknown') setDraft(null);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canSend ? (
        <button
          type="button"
          onClick={() => setDraft({ subject: t('emailDefaultSubject'), body: t('emailDefaultBody') })}
          disabled={isPending || isSending}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-50"
        >
          <Mail className="size-4" aria-hidden="true" />
          {t('sendToClient')}
        </button>
      ) : null}
      <button
        type="button"
        onClick={handleDownload}
        disabled={isPending}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-black px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
        {isPending ? t('generating') : t('download')}
      </button>

      <ComposeEmailDialog
        open={draft !== null}
        onOpenChange={(open) => !open && setDraft(null)}
        title={t('emailDialogTitle')}
        initialSubject={draft?.subject ?? ''}
        initialBody={draft?.body ?? ''}
        pending={isSending}
        onSend={handleSend}
        extraFields={
          <p className="rounded-md bg-brand-gold-soft px-3 py-2 text-xs text-brand-gold-text">{t('emailAttachNote')}</p>
        }
      />
    </div>
  );
}
