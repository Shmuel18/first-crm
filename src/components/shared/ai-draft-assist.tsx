'use client';

import { useRef, useState } from 'react';

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ThinkingDots } from '@/components/shared/thinking-dots';

/**
 * The "נסח עם AI" strip inside ComposeEmailDialog (ai-v2-spec.md §4.2).
 * The draft appears WHOLE once it is ready — thinking dots cover the wait
 * (same behaviour as the assistant bubble; a half-written word looks broken).
 * One click moves the draft into the editable editor — the AI never touches
 * the send path itself.
 */

const PURPOSES = ['missing_docs', 'status_update', 'custom'] as const;
type Purpose = (typeof PURPOSES)[number];

/** Tallest the instruction box grows before it starts scrolling (px). */
const INSTRUCTION_MAX_PX = 120;

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
  const [busy, setBusy] = useState(false);
  const runningRef = useRef(false);
  const instructionRef = useRef<HTMLTextAreaElement>(null);
  const dir = language === 'he' ? 'rtl' : 'ltr';

  // Grow the instruction box to fit what was typed, up to a cap (then it
  // scrolls) — a one-line input hid the end of every longer instruction.
  const grow = (): void => {
    const el = instructionRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, INSTRUCTION_MAX_PX)}px`;
  };

  const generate = async (): Promise<void> => {
    if (runningRef.current) return;
    if (purpose === 'custom' && instruction.trim().length === 0) {
      toast.error(t('instructionRequired'));
      return;
    }
    runningRef.current = true;
    setDraft('');
    setBusy(true);
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
      // Drain the whole stream BEFORE rendering: the draft lands in one piece
      // instead of assembling itself word by word in front of the advisor.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
      }
      const text = acc.trim();
      if (text.length === 0) {
        toast.error(t('failed'));
        return;
      }
      setDraft(text);
    } catch {
      toast.error(t('failed'));
    } finally {
      setBusy(false);
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
          disabled={busy}
          className="h-7 rounded-md border border-brand-gold/40 bg-white px-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-gold disabled:opacity-50"
        >
          {PURPOSES.map((p) => (
            <option key={p} value={p}>
              {t(`purposes.${p}`)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          className="ms-auto inline-flex items-center gap-1.5 rounded-md bg-brand-gold px-2.5 py-1 text-xs font-semibold text-brand-black hover:bg-brand-gold-hover disabled:opacity-60"
        >
          {busy ? <ThinkingDots /> : null}
          {busy ? t('writing') : t('generate')}
        </button>
      </div>

      {/* Own full-width row (not squeezed into the toolbar): Enter breaks a
          line, the box grows with the text, and nothing scrolls out of sight. */}
      {purpose === 'custom' && (
        <textarea
          ref={instructionRef}
          value={instruction}
          onChange={(e) => {
            setInstruction(e.target.value);
            grow();
          }}
          rows={2}
          dir={dir}
          placeholder={t('instructionPlaceholder')}
          aria-label={t('instructionPlaceholder')}
          maxLength={500}
          disabled={busy}
          className="app-scrollbar block max-h-30 w-full resize-none rounded-md border border-brand-gold/40 bg-white px-2 py-1.5 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-gold disabled:opacity-50"
        />
      )}

      {(draft.length > 0 || busy) && (
        <>
          <div
            dir={dir}
            className="app-scrollbar max-h-36 overflow-y-auto whitespace-pre-wrap rounded-md border border-brand-gold/20 bg-white p-2 text-xs leading-relaxed text-neutral-800"
          >
            {busy ? <ThinkingDots /> : draft}
          </div>
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setDraft('')}
              disabled={busy || draft.length === 0}
              className="rounded-md border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
            >
              {t('clear')}
            </button>
            <button
              type="button"
              onClick={() => onUseDraft(draft)}
              disabled={busy || draft.length === 0}
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
