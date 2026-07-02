'use client';

import { useTransition } from 'react';

import { FileText, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Tooltip } from '@/components/ui/tooltip';

import { generateBankPdfAction } from '../actions/generate-bank-pdf';

type Props = {
  caseId: string;
  /** Tooltip text — usually "הפק PDF לבנק". */
  title: string;
};

/**
 * Action-bar icon that asks the server for a freshly rendered bank PDF, then
 * triggers a browser download. base64 → Blob → object URL → anchor click →
 * URL.revokeObjectURL to avoid leaking the blob.
 */
export function GenerateBankPdfButton({ caseId, title }: Props) {
  const tc = useTranslations('common');
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    if (isPending) return;
    startTransition(async () => {
      const result = await generateBankPdfAction(caseId);
      if (!result.ok) {
        // Generic translated message — the action never returns a raw error.
        toast.error(tc('saveFailed'));
        return;
      }

      // Decode base64 → Uint8Array → Blob. Atob is fine for binary if we copy
      // byte-by-byte rather than treating the string as utf-8.
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

  return (
    <Tooltip content={title}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-label={title}
        className="tap-target relative size-8 rounded-md text-neutral-700 hover:bg-white hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50 transition flex items-center justify-center disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <FileText className="size-3.5" aria-hidden="true" />
        )}
      </button>
    </Tooltip>
  );
}
