'use client';

import { useEffect, useRef, useState } from 'react';

import { Sparkles, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ThinkingDots } from '@/components/shared/thinking-dots';

import { useAiAssistant, type AssistantTurn } from '../hooks/use-ai-assistant';

import { AiComposer } from './ai-composer';
import { AiResponseView } from './ai-response-view';

const EXAMPLE_KEYS = ['ex1', 'ex2', 'ex3'] as const;
const FOLLOW_UP_KEYS = ['f1', 'f2', 'f3'] as const;

/** Follow-up chips appear after a case ANSWER — the moment a next step is
 *  natural ("what's missing", "summarize", "advance the stage"). */
function isCaseAnswer(turn: AssistantTurn | undefined): boolean {
  return (
    turn?.role === 'assistant' &&
    turn.response.answerable &&
    turn.response.caseId !== null &&
    turn.response.answer !== null &&
    !turn.response.proposedAction
  );
}

/**
 * The unified AI assistant (ai-v2-spec "the assistant"): a floating, global,
 * context-aware chat. It reuses the SAME brain as the dashboard bar
 * (/api/ai/nl-query + /api/ai/confirm-action) — so everything is
 * permission-gated and audited server-side. On a case page it answers about
 * THAT case without re-naming it; anywhere it counts/searches/answers or
 * proposes an action for the human to confirm. The panel is a FIXED size so
 * it never jumps as messages arrive; only the composer's input grows.
 */
export function AiAssistantBubble() {
  const t = useTranslations('assistant');
  const [open, setOpen] = useState(false);
  const {
    turns,
    busy,
    confirmingId,
    ask,
    confirm,
    dismiss,
    clear,
    onCasePage,
    contextCase,
    clearContext,
  } = useAiAssistant();
  // Inside a case, offer case suggestions ("summarize", "what's missing");
  // elsewhere, portfolio ones ("how many stuck cases").
  const exampleNs = onCasePage ? 'examplesCase' : 'examples';

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy, open]);

  const showFollowUps = !busy && isCaseAnswer(turns[turns.length - 1]);

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
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          className="fixed inset-x-0 bottom-0 z-40 flex h-[75vh] flex-col rounded-t-2xl border border-neutral-200 bg-white shadow-2xl md:inset-x-auto md:bottom-24 md:end-6 md:h-[32rem] md:max-h-[85vh] md:w-96 md:rounded-2xl"
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
                      onClick={() => !busy && void ask(t(`${exampleNs}.${k}`))}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-start text-xs text-neutral-700 hover:border-brand-gold/50 hover:bg-brand-gold-soft"
                    >
                      {t(`${exampleNs}.${k}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((turn) => {
              if (turn.role === 'user') {
                return (
                  <div key={turn.id} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-brand-black px-3 py-1.5 text-sm text-white">
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

            {/* Natural next steps after a case answer — one tap, no typing. */}
            {showFollowUps && (
              <div className="flex flex-wrap gap-1.5">
                {FOLLOW_UP_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => void ask(t(`followUps.${k}`))}
                    className="rounded-full border border-brand-gold/40 bg-white px-2.5 py-1 text-[11px] text-neutral-700 hover:border-brand-gold hover:bg-brand-gold-soft"
                  >
                    {t(`followUps.${k}`)}
                  </button>
                ))}
              </div>
            )}

            {busy && (
              <div className="w-fit rounded-lg border border-brand-gold/30 bg-brand-gold-soft/50 px-3 py-2.5">
                <ThinkingDots />
              </div>
            )}
          </div>

          <AiComposer
            busy={busy}
            onSend={(text) => void ask(text)}
            contextChip={contextCase && !onCasePage ? (contextCase.label ?? '') : null}
            onClearContext={clearContext}
          />
        </div>
      )}
    </>
  );
}
