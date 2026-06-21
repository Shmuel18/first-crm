'use client';

import { useRef, useState, useTransition } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';

import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import { buildMentionBody, findMentionQuery, insertMentionPlain, type PickedMention } from '../domain/mentions';

type Member = { id: string; name: string };

type Props = {
  members: ReadonlyArray<Member>;
  onPost: (body: string) => Promise<boolean>;
};

const MAX_SUGGESTIONS = 6;

export function CaseCommentComposer({ members, onPost }: Props) {
  const t = useTranslations('caseComments');
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  // Mentions the user picked, in order — folded back into @[name](uuid) on submit.
  const [picked, setPicked] = useState<PickedMention[]>([]);

  const suggestions = mention
    ? members
        .filter((m) => m.name.toLowerCase().includes(mention.query.toLowerCase()))
        .slice(0, MAX_SUGGESTIONS)
    : [];

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const { value, selectionStart } = e.target;
    setDraft(value);
    setMention(findMentionQuery(value, selectionStart ?? value.length));
    setActiveIdx(0);
  };

  const applyMention = (m: Member) => {
    if (!mention) return;
    const caret = taRef.current?.selectionStart ?? draft.length;
    const next = insertMentionPlain(draft, mention.start, caret, m.name);
    setDraft(next.value);
    setPicked((prev) => [...prev, { name: m.name, uuid: m.id }]);
    setMention(null);
    // Restore focus + caret after the controlled re-render.
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(next.caret, next.caret);
      }
    });
  };

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    const body = buildMentionBody(text, picked);
    setDraft('');
    setMention(null);
    startTransition(async () => {
      const ok = await onPost(body);
      if (ok) setPicked([]);
      else setDraft(text); // restore the clean text; picked kept so a retry rebuilds tokens
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const picked = suggestions[activeIdx];
        if (picked) {
          e.preventDefault();
          applyMention(picked);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="relative border-t border-neutral-100 pt-3">
      <Textarea
        ref={taRef}
        value={draft}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        rows={2}
        maxLength={5000}
        placeholder={t('composer.placeholder')}
        aria-label={t('composer.label')}
        disabled={pending}
      />

      {mention && suggestions.length > 0 && (
        <ul className="absolute bottom-full z-20 mb-1 max-h-56 w-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          {suggestions.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyMention(m);
                }}
                className={[
                  'w-full px-3 py-1.5 text-start text-sm',
                  i === activeIdx
                    ? 'bg-brand-gold-soft text-brand-gold-text'
                    : 'hover:bg-neutral-50',
                ].join(' ')}
              >
                @{m.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-neutral-400">{t('composer.hint')}</span>
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={pending || draft.trim().length === 0}
          className="bg-brand-gold hover:bg-brand-gold-hover font-semibold text-brand-black"
        >
          <Send className="size-3.5 me-1.5" />
          {t('composer.post')}
        </Button>
      </div>
    </div>
  );
}
