'use client';

import { useEffect, useRef, useState } from 'react';

import { Mic, Send, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useVoiceInput } from '../hooks/use-voice-input';

/** Tallest the input grows before it starts scrolling (px). */
const INPUT_MAX_PX = 160;

/**
 * The assistant's composer: auto-growing textarea (Enter sends,
 * Shift+Enter breaks a line), voice dictation (transcript lands in the input
 * for review — never auto-sent), and the conversation-context chip with a
 * one-click clear. Extracted from the bubble to keep both components small.
 */
export function AiComposer({
  busy,
  onSend,
  contextChip,
  onClearContext,
}: {
  busy: boolean;
  onSend: (text: string) => void;
  /** Label of the conversation-carried case; null hides the chip. */
  contextChip: string | null;
  onClearContext: () => void;
}) {
  const t = useTranslations('assistant');
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Grow the textarea to fit its content, up to a cap (then it scrolls).
  const grow = (): void => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_PX)}px`;
  };

  const voice = useVoiceInput((transcript) => {
    setInput((prev) => (prev.trim().length > 0 ? `${prev} ${transcript}` : transcript));
    requestAnimationFrame(() => {
      grow();
      inputRef.current?.focus();
    });
  });

  const send = (): void => {
    const q = input.trim();
    if (!q || busy) return;
    onSend(q);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  return (
    <>
      {contextChip !== null && (
        <div className="flex items-center gap-1.5 px-3 pb-1 text-[11px] text-neutral-500">
          {t('contextLabel')}
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-gold/40 bg-brand-gold-soft px-2 py-0.5 font-medium text-brand-gold-text">
            {contextChip || t('contextCase')}
            <button
              type="button"
              aria-label={t('clearContext')}
              onClick={onClearContext}
              className="flex size-3.5 items-center justify-center rounded-full hover:bg-white"
            >
              <X className="size-2.5" />
            </button>
          </span>
        </div>
      )}
      <div className="flex items-end gap-2 border-t border-neutral-100 p-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            grow();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={voice.listening ? t('listening') : t('placeholder')}
          aria-label={t('placeholder')}
          className="app-scrollbar max-h-40 flex-1 resize-none rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-gold"
        />
        {voice.supported && (
          <button
            type="button"
            onClick={voice.toggle}
            aria-label={voice.listening ? t('stopVoice') : t('startVoice')}
            aria-pressed={voice.listening}
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg border transition ${
              voice.listening
                ? 'animate-pulse border-red-300 bg-red-50 text-red-600'
                : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'
            }`}
          >
            <Mic className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={send}
          disabled={busy || input.trim().length === 0}
          aria-label={t('send')}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-gold text-brand-black hover:bg-brand-gold-hover disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </div>
    </>
  );
}
