'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';

import { Loader2, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { findMentionQuery, insertMention, parseMentionBody } from '@/features/case-comments/domain/mentions';
import { formatPersonName } from '@/lib/utils/person-name';

import { addTaskCommentAction } from '../actions/add-task-comment';
import {
  getTaskCommentsAction,
  getTaskMentionableProfilesAction,
} from '../services/task-comments.service';
import type { TaskCommentWithAuthor } from '../types';

// ── helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'עכשיו';
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `לפני ${hrs} שע׳`;
  const days = Math.floor(hrs / 24);
  return `לפני ${days} ימים`;
}

const EVENT_ICON: Record<string, string> = {
  created: '✦',
  assigned: '→',
  reassigned: '⇄',
  status_changed: '◈',
  completed: '✓',
  reopened: '↩',
  snoozed: '⏱',
};

type Member = { id: string; name: string };

const MAX_SUGGESTIONS = 6;

// ── sub-components ────────────────────────────────────────────────────────────

function SystemEventRow({ item }: { item: TaskCommentWithAuthor }) {
  const authorName = formatPersonName(item.author?.first_name, item.author?.last_name) || 'מערכת';
  const icon = EVENT_ICON[item.event_type] ?? '·';
  return (
    <div className="flex items-start gap-2 py-1.5 text-xs text-neutral-500">
      <span className="shrink-0 w-5 text-center text-brand-gold-text/70 font-medium">{icon}</span>
      <span className="flex-1 leading-relaxed">
        <span className="font-medium text-neutral-600">{item.body}</span>
        <span className="mx-1">·</span>
        <span>{authorName}</span>
        <span className="mx-1">·</span>
        <time dateTime={item.created_at}>{relativeTime(item.created_at)}</time>
      </span>
    </div>
  );
}

function CommentRow({ item }: { item: TaskCommentWithAuthor }) {
  const authorName = formatPersonName(item.author?.first_name, item.author?.last_name) || 'יועץ';
  const initials = [item.author?.first_name?.[0], item.author?.last_name?.[0]]
    .filter(Boolean)
    .join('')
    .toUpperCase() || '?';

  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span
        aria-hidden="true"
        className="shrink-0 size-7 rounded-full bg-brand-gold/20 text-brand-gold-text text-[11px] font-semibold flex items-center justify-center"
      >
        {initials}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-neutral-800">{authorName}</span>
          <time className="text-[10px] text-neutral-400" dateTime={item.created_at}>
            {relativeTime(item.created_at)}
          </time>
        </div>
        <p className="text-sm text-neutral-700 mt-0.5 whitespace-pre-wrap break-words leading-snug">
          {parseMentionBody(item.body).map((seg, i) =>
            seg.type === 'mention' ? (
              <span
                key={`m${i}`}
                className="rounded bg-brand-gold-soft px-1 font-medium text-brand-gold-text"
              >
                @{seg.name}
              </span>
            ) : (
              <span key={`t${i}`}>{seg.value}</span>
            ),
          )}
        </p>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

type Props = {
  taskId: string;
};

export function TaskThread({ taskId }: Props) {
  const t = useTranslations('tasks.thread');
  const [comments, setComments] = useState<TaskCommentWithAuthor[]>([]);
  const [loadPending, startLoad] = useTransition();
  const [sendPending, startSend] = useTransition();
  const [draft, setDraft] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = mention
    ? members
        .filter((m) => m.name.toLowerCase().includes(mention.query.toLowerCase()))
        .slice(0, MAX_SUGGESTIONS)
    : [];

  const reload = () => {
    startLoad(async () => {
      const res = await getTaskCommentsAction(taskId);
      if (res.ok) setComments(res.comments);
    });
  };

  // Load on mount and when taskId changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [taskId]);

  useEffect(() => {
    startLoad(async () => {
      const res = await getTaskMentionableProfilesAction();
      if (res.ok) setMembers(res.members);
    });
  }, []);

  // Scroll to bottom when new comments arrive.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  const handleSend = () => {
    const body = draft.trim();
    if (!body) return;
    startSend(async () => {
      const res = await addTaskCommentAction(taskId, body);
      if (!res.ok) {
        toast.error(t('sendFailed'));
        return;
      }
      setDraft('');
      setMention(null);
      reload();
    });
  };

  const handleDraftChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const { value, selectionStart } = e.target;
    setDraft(value);
    setMention(findMentionQuery(value, selectionStart ?? value.length));
    setActiveIdx(0);
  };

  const applyMention = (m: Member) => {
    if (!mention) return;
    const caret = textareaRef.current?.selectionStart ?? draft.length;
    const next = insertMention(draft, mention.start, caret, m.name, m.id);
    setDraft(next.value);
    setMention(null);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── thread scroll area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5 min-h-0">
        {loadPending && comments.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-4 animate-spin text-neutral-400" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-center text-neutral-400 py-8">{t('empty')}</p>
        ) : (
          comments.map((item) =>
            item.event_type === 'comment' ? (
              <CommentRow key={item.id} item={item} />
            ) : (
              <SystemEventRow key={item.id} item={item} />
            ),
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── divider ── */}
      <div className="border-t border-neutral-200 mx-0" />

      {/* ── compose area ── */}
      <div className="relative px-4 py-3 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={handleDraftChange}
          onKeyDown={handleKeyDown}
          placeholder={t('placeholder')}
          rows={2}
          maxLength={4000}
          disabled={sendPending}
          className="flex-1 resize-none rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:outline-none focus-visible:border-brand-gold-text focus-visible:ring-2 focus-visible:ring-brand-gold-text/30 disabled:opacity-50"
        />
        {mention && suggestions.length > 0 && (
          <ul className="absolute bottom-full start-4 z-20 mb-1 max-h-56 w-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
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
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={sendPending || !draft.trim()}
          aria-label={t('send')}
          className="shrink-0 bg-brand-gold hover:bg-brand-gold-hover text-brand-black disabled:opacity-40"
        >
          {sendPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
      <p className="px-4 pb-2 text-[10px] text-neutral-400">{t('hint')}</p>
    </div>
  );
}
