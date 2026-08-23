'use client';

import { useRef, useState } from 'react';

import { Loader2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

/**
 * The "נסח עם AI" strip inside ComposeEmailDialog (ai-v2-spec.md §4.2).
 * Streams a draft into a preview box; one click moves it into the editable
 * editor — the AI never touches the send path itself.
 */

const PURPOSES = ['missing_docs', 'status_update', 'custom'] as const;
type Purpose = (typeof PURPOSES)[number];

type Props = {
  caseId: string;
  language: 'he' | 'en';
  onUseDraft: (text: string) => void;
};

export function AiDraftAssist({ caseId, language, onUseDraft }: Props) {
  const t = useTranslations('composeEmail.ai');
  const [purpose, setPurpose] = useState<Purpose>('missing_docs');
  const [instruction, setInstruction] = useState('');
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const runningRef = useRef(false);

  const generate = async (): Promise<void> => {
    if (runningRef.current) return;
    if (purpose === 'custom' && instruction.trim().length === 0) {
      toast.error(t('instructionRequired'));
      return;
    }
    runningRef.current = true;
    setDraft('');
    setStreaming(true);
    try {
      const res = await fetch('/api/ai/draft-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, purpose, instruction, language }),
      });
      if (!res.ok || !res.body) {
        toast.error(res.status === 429 ? t('rateLimited') : t('failed'));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setDraft(acc);
      }
    } catch {
      toast.error(t('failed'));
    } finally {
      setStreaming(false);
      runningRef.current = false;
    }
  };

  return (
    <div className="rounded-lg border border-brand-gold/30 bg-brand-gold-soft/50 p-2.5 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-gold-text">
          <Sparkles className="size-3.5" aria-hidden="true" />
          {t('label')}
        </span>
        <select
          aria-label={t('purposeLabel')}
          value={purpose}
          onChange={(e) => setPurpose(e.target.value as Purpose)}
          disabled={streaming}
          className="h-7 rounded-md border border-brand-gold/40 bg-white px-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-gold disabled:opacity-50"
        >
          {PURPOSES.map((p) => (
            <option key={p} value={p}>
              {t(`purposes.${p}`)}
            </option>
          ))}
        </select>
        {purpose === 'custom' && (
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={t('instructionPlaceholder')}
            aria-label={t('instructionPlaceholder')}
            maxLength={500}
            disabled={streaming}
            className="h-7 min-w-40 flex-1 rounded-md border border-brand-gold/40 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold disabled:opacity-50"
          />
        )}
        <button
          type="button"
          onClick={() => void generate()}
          disabled={streaming}
          className="ms-auto inline-flex items-center gap-1 rounded-md bg-brand-gold px-2.5 py-1 text-xs font-semibold text-brand-black hover:bg-brand-gold-hover disabled:opacity-60"
        >
          {streaming ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : null}
          {streaming ? t('writing') : t('generate')}
        </button>
      </div>

      {(draft.length > 0 || streaming) && (
        <>
          <div
            dir={language === 'he' ? 'rtl' : 'ltr'}
            className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-md border border-brand-gold/20 bg-white p-2 text-xs leading-relaxed text-neutral-800"
          >
            {draft}
            {streaming && (
              <span className="ms-0.5 inline-block h-3 w-0.5 animate-pulse bg-brand-gold-dark align-middle" aria-hidden="true" />
            )}
          </div>
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setDraft('')}
              disabled={streaming || draft.length === 0}
              className="rounded-md border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
            >
              {t('clear')}
            </button>
            <button
              type="button"
              onClick={() => onUseDraft(draft)}
              disabled={streaming || draft.length === 0}
              className="rounded-md bg-brand-black px-2 py-0.5 text-[11px] text-white disabled:opacity-50"
            >
              {t('useDraft')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
