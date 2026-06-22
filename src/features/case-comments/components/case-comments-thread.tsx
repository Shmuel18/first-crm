'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import type { Locale } from '@/lib/i18n/direction';

import { deleteCaseCommentAction } from '../actions/delete-case-comment';
import { editCaseCommentAction } from '../actions/edit-case-comment';
import { postCaseCommentAction } from '../actions/post-case-comment';
import { isDocumentationMilestone } from '../domain/documentation-celebration';
import type { CaseCommentView } from '../types';
import { CaseCommentBubble } from './case-comment-bubble';
import { CaseCommentComposer } from './case-comment-composer';
import { DocumentationCelebration } from './documentation-celebration';

type Member = { id: string; name: string };

type Props = {
  caseId: string;
  currentUserId: string;
  currentUserName: string;
  canModerate: boolean;
  locale: Locale;
  members: ReadonlyArray<Member>;
  initialComments: ReadonlyArray<CaseCommentView>;
};

export function CaseCommentsThread({
  caseId,
  currentUserId,
  currentUserName,
  canModerate,
  locale,
  members,
  initialComments,
}: Props) {
  const t = useTranslations('caseComments');
  const [comments, setComments] = useState<ReadonlyArray<CaseCommentView>>(initialComments);
  const [celebration, setCelebration] = useState<{
    id: number;
    milestone: boolean;
  } | null>(null);
  const celebrationIdRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  const finishCelebration = useCallback(() => setCelebration(null), []);

  // Reconcile to fresh server data on a payload change (render-time, no effect),
  // mirroring TasksBoard's prop-sync pattern.
  const [syncedRef, setSyncedRef] = useState(initialComments);
  if (syncedRef !== initialComments) {
    setSyncedRef(initialComments);
    setComments(initialComments);
  }

  // Relative timestamps in the bubbles ("a second ago") are computed at render,
  // so without a re-render they freeze. Tick every 30s so they stay current
  // without a manual refresh — one timer for the whole thread, not per bubble.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((tick) => tick + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Keep the newest comment in view when the count changes — DOM-only side
  // effect (no setState), the legitimate use of useEffect.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  const handlePost = async (body: string): Promise<boolean> => {
    // Plain client-unique id (NOT crypto.randomUUID — undefined on insecure
    // HTTP contexts). Only needs to be unique within this session to reconcile
    // the optimistic bubble with its saved row.
    const tempId = `temp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const optimistic: CaseCommentView = {
      id: tempId,
      authorId: currentUserId,
      authorName: currentUserName,
      body,
      createdAt: new Date().toISOString(),
      editedAt: null,
    };
    setComments((c) => [...c, optimistic]);
    let res: Awaited<ReturnType<typeof postCaseCommentAction>>;
    try {
      res = await postCaseCommentAction(caseId, body);
    } catch {
      setComments((c) => c.filter((x) => x.id !== tempId));
      toast.error(t('toast.postFailed'));
      return false;
    }
    if (!res.ok) {
      setComments((c) => c.filter((x) => x.id !== tempId));
      toast.error(t('toast.postFailed'));
      return false;
    }
    setComments((c) =>
      c.map((x) =>
        x.id === tempId ? { ...x, id: res.comment.id, createdAt: res.comment.createdAt } : x,
      ),
    );
    const authoredCount =
      comments.filter((comment) => comment.authorId === currentUserId).length + 1;
    celebrationIdRef.current += 1;
    setCelebration({
      id: celebrationIdRef.current,
      milestone: isDocumentationMilestone(authoredCount),
    });
    return true;
  };

  const handleSaveEdit = async (id: string, body: string): Promise<boolean> => {
    const prev = comments;
    setComments((c) => c.map((x) => (x.id === id ? { ...x, body } : x)));
    const res = await editCaseCommentAction(id, body);
    if (!res.ok) {
      setComments(prev);
      toast.error(t('toast.editFailed'));
      return false;
    }
    setComments((c) => c.map((x) => (x.id === id ? { ...x, body, editedAt: res.editedAt } : x)));
    return true;
  };

  const handleDelete = async (id: string): Promise<boolean> => {
    const prev = comments;
    setComments((c) => c.filter((x) => x.id !== id));
    const res = await deleteCaseCommentAction(id);
    if (!res.ok) {
      setComments(prev);
      toast.error(t('toast.deleteFailed'));
      return false;
    }
    return true;
  };

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <p className="py-4 text-center text-sm text-neutral-500">{t('empty')}</p>
      ) : (
        <div ref={listRef} className="max-h-96 space-y-4 overflow-y-auto pe-1">
          {comments.map((c) => {
            const isTemp = c.id.startsWith('temp-');
            const mine = c.authorId === currentUserId;
            return (
              <CaseCommentBubble
                key={c.id}
                comment={c}
                locale={locale}
                canEdit={!isTemp && mine}
                canDelete={!isTemp && (mine || canModerate)}
                onSaveEdit={handleSaveEdit}
                onDelete={handleDelete}
              />
            );
          })}
        </div>
      )}

      <CaseCommentComposer members={members} onPost={handlePost} />

      {celebration && (
        <DocumentationCelebration
          celebrationId={celebration.id}
          milestone={celebration.milestone}
          onComplete={finishCelebration}
        />
      )}
    </div>
  );
}
