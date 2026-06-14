'use client';

import { useState, useTransition } from 'react';

import { Download, Loader2, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ComposeEmailDialog } from '@/components/shared/compose-email-dialog';

import { emailScenarioReportAction } from '../actions/email-scenario-report';
import { generateReportPdfAction } from '../actions/generate-report-pdf';

type Props = { scenarioId: string; initialConclusion: string | null };
type Draft = { subject: string; body: string };

/**
 * Advisor-facing report editor: a free-text conclusion seeded from the saved
 * scenario, plus two actions — download the rendered PDF, or email it to the
 * client (branded, PDF attached, reviewed in the compose dialog first). The
 * edited conclusion rides with both requests so the PDF reflects the live text
 * (server treats `undefined` as "keep saved", `null`/'' as "clear").
 */
export function ReportEditor({ scenarioId, initialConclusion }: Props) {
  const t = useTranslations('simulators.report');
  const [conclusion, setConclusion] = useState(initialConclusion ?? '');
  const [isPending, startTransition] = useTransition();
  const [isSending, startSendTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);

  const handleDownload = () => {
    if (isPending) return;
    startTransition(async () => {
      const result = await generateReportPdfAction({
        scenarioId,
        advisorConclusion: conclusion.trim() || null,
      });
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }

      // base64 → Uint8Array (copy byte-by-byte; atob yields a binary string) →
      // Blob → object URL → anchor click → revoke to avoid leaking the blob.
      const binary = atob(result.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleSend = (subject: string, body: string) => {
    startSendTransition(async () => {
      const res = await emailScenarioReportAction({
        scenarioId,
        subject,
        body,
        advisorConclusion: conclusion.trim() || null,
      });
      if (res.ok) {
        toast.success(t('emailSent'));
        setDraft(null);
        return;
      }
      toast.error(t(`errors.${res.error}`));
      // Keep the dialog open on a transient unknown failure so the advisor can retry.
      if (res.error !== 'unknown') setDraft(null);
    });
  };

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <label htmlFor="advisor-conclusion" className="block text-sm font-medium text-neutral-700">
        {t('conclusionLabel')}
      </label>
      <textarea
        id="advisor-conclusion"
        value={conclusion}
        onChange={(event) => setConclusion(event.target.value)}
        placeholder={t('conclusionPlaceholder')}
        maxLength={4000}
        rows={6}
        className="mt-2 w-full resize-y rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-brand-gold-dark focus:outline-none focus:ring-2 focus:ring-brand-gold-text/30"
      />
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setDraft({ subject: t('emailDefaultSubject'), body: t('emailDefaultBody') })}
          disabled={isPending || isSending}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-50"
        >
          <Mail className="size-4" aria-hidden="true" />
          {t('sendToClient')}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={isPending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-black px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-4" aria-hidden="true" />
          )}
          {isPending ? t('generating') : t('download')}
        </button>
      </div>

      <ComposeEmailDialog
        open={draft !== null}
        onOpenChange={(open) => !open && setDraft(null)}
        title={t('emailDialogTitle')}
        initialSubject={draft?.subject ?? ''}
        initialBody={draft?.body ?? ''}
        pending={isSending}
        onSend={handleSend}
        extraFields={
          <p className="rounded-md bg-brand-gold-soft px-3 py-2 text-xs text-brand-gold-text">
            {t('emailAttachNote')}
          </p>
        }
      />
    </section>
  );
}
