import { parseMentionBody } from '@/features/case-comments/domain/mentions';

import type { CaseCommentView } from '@/features/case-comments/types';

import type { ActivityEvent, ClientEmailLogRow } from '../types';

const EXCERPT_LEN = 140;

/** Comment body as plain text (mention tokens → "@Name"), truncated. */
function commentExcerpt(body: string): string {
  const plain = parseMentionBody(body)
    .map((seg) => (seg.type === 'mention' ? `@${seg.name}` : seg.value))
    .join('');
  return plain.length > EXCERPT_LEN ? plain.slice(0, EXCERPT_LEN) + '…' : plain;
}

export function commentToEvent(c: CaseCommentView): ActivityEvent {
  return {
    id: `comment:${c.id}`,
    timestamp: c.createdAt,
    actorName: c.authorName,
    kind: 'comment_added',
    excerpt: commentExcerpt(c.body),
  };
}

export function emailToEvent(row: ClientEmailLogRow, senderName: string | null): ActivityEvent {
  return {
    id: `email:${row.id}`,
    timestamp: row.created_at,
    actorName: senderName,
    kind: 'email_sent',
    emailKind: row.kind,
    recipient: row.recipient_email,
    subject: row.subject,
    body: row.body,
  };
}

/** Newest first; id tiebreak keeps the order stable across renders. */
export function sortEventsDesc(events: ReadonlyArray<ActivityEvent>): ActivityEvent[] {
  return [...events].sort(
    (a, b) => b.timestamp.localeCompare(a.timestamp) || a.id.localeCompare(b.id),
  );
}
