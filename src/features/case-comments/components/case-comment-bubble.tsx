'use client';

import { useState, useTransition } from 'react';

import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import type { Locale } from '@/lib/i18n/direction';

import { formatRelativeTime } from '../domain/format-relative-time';
import { parseMentionBody } from '../domain/mentions';
import type { CaseCommentView } from '../types';

type Props = {
  comment: CaseCommentView;
  locale: Locale;
  canEdit: boolean;
  canDelete: boolean;
  onSaveEdit: (id: string, body: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join('') || '?').toUpperCase();
}

export function CaseCommentBubble({ comment, locale, canEdit, canDelete, onSaveEdit, onDelete }: Props) {
  const t = useTranslations('caseComments');
  const tc = useTranslations('common');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const fullDate = new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(comment.createdAt));

  const handleSave = () => {
    const body = draft.trim();
    if (!body || body === comment.body) {
      setEditing(false);
      setDraft(comment.body);
      return;
    }
    startTransition(async () => {
      const ok = await onSaveEdit(comment.id, body);
      if (ok) setEditing(false);
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const ok = await onDelete(comment.id);
      if (ok) setConfirmOpen(false);
    });
  };

  return (
    <div className="group/comment flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className="mt-0.5 size-7 shrink-0 rounded-full bg-brand-black text-brand-gold text-[10px] font-bold flex items-center justify-center"
      >
        {initialsOf(comment.authorName)}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-900 truncate">{comment.authorName}</span>
          <time
            dateTime={comment.createdAt}
            title={fullDate}
            suppressHydrationWarning
            className="text-[11px] text-neutral-500 shrink-0"
          >
            {formatRelativeTime(comment.createdAt, locale)}
          </time>
          {comment.editedAt && <span className="text-[11px] text-neutral-400">{t('edited')}</span>}

          {(canEdit || canDelete) && !editing && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label={tc('more')}
                    className="ms-auto tap-target opacity-100 md:opacity-0 md:group-hover/comment:opacity-100 md:focus-visible:opacity-100 transition text-neutral-400 hover:text-neutral-700"
                  />
                }
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-32">
                {canEdit && (
                  <DropdownMenuItem onClick={() => { setDraft(comment.body); setEditing(true); }}>
                    <Pencil className="size-3.5 me-2" />
                    {tc('edit')}
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    onClick={() => setConfirmOpen(true)}
                    className="text-red-600 focus:text-red-700 focus:bg-red-50"
                  >
                    <Trash2 className="size-3.5 me-2" />
                    {tc('delete')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {editing ? (
          <div className="mt-1 space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              maxLength={5000}
              autoFocus
              disabled={pending}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={pending}
                className="bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-semibold"
              >
                {tc('save')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => { setEditing(false); setDraft(comment.body); }}
                disabled={pending}
              >
                {tc('cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 text-sm text-neutral-700 whitespace-pre-wrap break-words">
            {parseMentionBody(comment.body).map((seg, i) =>
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
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('deleteDialog.description')}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel
              render={
                <Button variant="destructive" onClick={handleDelete} disabled={pending}>
                  {tc('delete')}
                </Button>
              }
            />
            <AlertDialogCancel render={<Button variant="outline">{tc('cancel')}</Button>} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
