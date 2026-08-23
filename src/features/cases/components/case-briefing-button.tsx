'use client';

import { useRef, useState } from 'react';

import { Check, Copy, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip } from '@/components/ui/tooltip';

/**
 * Pre-call briefing (ai-v2-spec.md §4.1): opens a dialog and STREAMS the
 * briefing text as the model writes it — flow, not a spinner (§7.2). The
 * result is ephemeral; a copy button is the only takeaway.
 */
export function CaseBriefingButton({ caseId, title }: { caseId: string; title: string }) {
  const t = useTranslations('case.briefing');
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'idle' | 'streaming' | 'done' | 'error'>('idle');
  const [copied, setCopied] = useState(false);
  const runningRef = useRef(false);

  const start = async (): Promise<void> => {
    if (runningRef.current) return;
    runningRef.current = true;
    setText('');
    setCopied(false);
    setPhase('streaming');
    try {
      const res = await fetch('/api/ai/case-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      });
      if (!res.ok || !res.body) {
        setPhase('error');
        toast.error(res.status === 429 ? t('rateLimited') : t('failed'));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((prev) => prev + decoder.decode(value, { stream: true }));
      }
      setPhase('done');
    } catch {
      setPhase('error');
      toast.error(t('failed'));
    } finally {
      runningRef.current = false;
    }
  };

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Tooltip content={title}>
        <button
          type="button"
          aria-label={title}
          onClick={() => {
            setOpen(true);
            if (phase === 'idle' || phase === 'error') void start();
          }}
          className="tap-target relative size-8 rounded-md text-brand-gold-text hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50 transition flex items-center justify-center"
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
        </button>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-brand-gold-text" aria-hidden="true" />
              {t('title')}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-32 whitespace-pre-wrap rounded-lg border border-brand-gold/30 bg-brand-gold-soft/60 p-3 text-sm leading-relaxed text-neutral-900">
            {text}
            {phase === 'streaming' && (
              <span className="ms-0.5 inline-block h-4 w-0.5 animate-pulse bg-brand-gold-dark align-middle" aria-hidden="true" />
            )}
            {phase === 'streaming' && text.length === 0 && (
              <span className="text-neutral-500">{t('thinking')}</span>
            )}
            {phase === 'error' && text.length === 0 && (
              <span className="text-neutral-500">{t('failed')}</span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-neutral-400">{t('disclaimer')}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void start()}
                disabled={phase === 'streaming'}
                className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              >
                {t('regenerate')}
              </button>
              <button
                type="button"
                onClick={() => void copy()}
                disabled={phase !== 'done' || text.length === 0}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-black px-2.5 py-1 text-xs text-white disabled:opacity-50"
              >
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                {copied ? t('copied') : t('copy')}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
