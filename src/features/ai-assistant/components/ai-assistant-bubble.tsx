'use client';

import { useEffect, useRef, useState } from 'react';

import { Loader2, Send, Sparkles, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useAiAssistant } from '../hooks/use-ai-assistant';

import { AiResponseView } from './ai-response-view';

const EXAMPLE_KEYS = ['ex1', 'ex2', 'ex3'] as const;

/**
 * The unified AI assistant (ai-v2-spec "the assistant"): a floating, global,
 * context-aware chat. It reuses the SAME brain as the dashboard bar
 * (/api/ai/nl-query + /api/ai/confirm-action) — so everything is
 * permission-gated and audited server-side. On a case page it answers about
 * THAT case without re-naming it; anywhere it counts/searches/answers or
 * proposes an action for the human to confirm.
 */
export function AiAssistantBubble() {
  const t = useTranslations('assistant');
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const { turns, busy, confirmingId, ask, confirm, dismiss, clear } = useAiAssistant();

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = (): void => {
    const q = input.trim();
    if (!q || busy) return;
    void ask(q);
    setInput('');
  };

  const runExample = (text: string): void => {
    if (busy) return;
    void ask(text);
  };

  const iconButton =
    'flex size-7 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t('close') : t('open')}
        aria-expanded={open}
        className={`fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] end-4 z-40 size-14 items-center justify-center rounded-full bg-brand-black text-white shadow-lg ring-1 ring-brand-gold/40 transition hover:scale-105 md:bottom-6 md:end-6 ${
          open ? 'hidden md:flex' : 'flex'
        }`}
      >
        {open ? <X className="size-5" /> : <Sparkles className="size-5 text-brand-gold-light" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('title')}
          className="fixed inset-x-0 bottom-0 z-40 flex max-h-[80vh] flex-col rounded-t-2xl border border-neutral-200 bg-white shadow-2xl md:inset-x-auto md:bottom-24 md:end-6 md:max-h-[70vh] md:w-96 md:rounded-2xl"
        >
          <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
            <Sparkles className="size-4 text-brand-gold-text" aria-hidden="true" />
            <span className="font-display text-sm font-semibold text-neutral-900">{t('title')}</span>
            <span className="ms-auto flex items-center gap-1">
              {turns.length > 0 && (
                <button type="button" aria-label={t('clearChat')} onClick={clear} className={iconButton}>
                  <Trash2 className="size-4" />
                </button>
              )}
              <button type="button" aria-label={t('close')} onClick={() => setOpen(false)} className={iconButton}>
                <X className="size-4" />
              </button>
            </span>
          </div>

          <div ref={listRef} className="app-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {turns.length === 0 && !busy && (
              <div className="py-6 text-center">
                <p className="text-sm leading-relaxed text-neutral-600">{t('greeting')}</p>
                <div className="mt-3 flex flex-col gap-1.5">
                  {EXAMPLE_KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => runExample(t(`examples.${k}`))}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-start text-xs text-neutral-700 hover:border-brand-gold/50 hover:bg-brand-gold-soft"
                    >
                      {t(`examples.${k}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((turn) => {
              if (turn.role === 'user') {
                return (
                  <div key={turn.id} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-brand-black px-3 py-1.5 text-sm text-white">
                      {turn.text}
                    </p>
                  </div>
                );
              }
              const r = turn.response;
              const action = r.answerable ? (r.proposedAction ?? null) : null;
              return (
                <div
                  key={turn.id}
                  className="rounded-lg border border-brand-gold/30 bg-brand-gold-soft/50 p-3"
                >
                  {turn.done && action ? (
                    <p className="text-sm font-medium text-neutral-800">✓ {action.summary}</p>
                  ) : (
                    <AiResponseView
                      response={r}
                      confirming={confirmingId === turn.id}
                      onConfirm={action ? () => void confirm(turn.id, action) : undefined}
                      onDismiss={() => dismiss(turn.id)}
                      onNavigate={() => setOpen(false)}
                    />
                  )}
                </div>
              );
            })}

            {busy && (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader2 className="size-4 animate-spin text-brand-gold-text" aria-hidden="true" />
                {t('thinking')}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-neutral-100 p-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder={t('placeholder')}
              aria-label={t('placeholder')}
              className="h-9 flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-gold"
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || input.trim().length === 0}
              aria-label={t('send')}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-gold text-brand-black hover:bg-brand-gold-hover disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
