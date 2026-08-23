'use client';

import { useState, useTransition } from 'react';

import { Check, Loader2, Pencil, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { callAction } from '@/lib/actions/call-action';

import { renameDocumentAction } from '../actions/rename-document';
import { documentDisplayName } from '../domain/document-name';

type Props = {
  documentId: string;
  caseId: string;
  fileName: string;
  /** Rename is an edit — hidden for view-only viewers. */
  canRename: boolean;
  onRenamed: (fileName: string) => void;
};

/**
 * The document's name, editable in place. The office names files meaningfully
 * ("חוזה רכישה") and until now could only do that in Drive; the action renames
 * both sides so the next sync doesn't undo it.
 *
 * The extension is hidden while editing and re-applied on save — it matters
 * for opening the file, not for reading the list.
 */
export function DocumentTitleEditor({
  documentId,
  caseId,
  fileName,
  canRename,
  onRenamed,
}: Props) {
  const t = useTranslations('documents.rename');
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => documentDisplayName(fileName));
  const [pending, startTransition] = useTransition();

  const save = (): void => {
    const typed = value.trim();
    if (!typed || typed === documentDisplayName(fileName)) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await callAction(() => renameDocumentAction({ documentId, caseId, name: typed }));
      if (!res.ok) {
        const key =
          res.error === 'drive_failed'
            ? 'errors.drive'
            : res.error === 'unauthorized'
              ? 'errors.unauthorized'
              : res.error === 'validation'
                ? 'errors.validation'
                : 'errors.generic';
        toast.error(t(key));
        return;
      }
      toast.success(t('renamed'));
      onRenamed(res.fileName);
      setEditing(false);
    });
  };

  if (!editing) {
    return (
      <span className="flex items-center gap-2">
        <span className="truncate">{documentDisplayName(fileName)}</span>
        {canRename && (
          <button
            type="button"
            onClick={() => {
              setValue(documentDisplayName(fileName));
              setEditing(true);
            }}
            aria-label={t('action')}
            title={t('action')}
            className="shrink-0 rounded p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') setEditing(false);
        }}
        disabled={pending}
        maxLength={200}
        aria-label={t('action')}
        autoFocus
        className="h-9 text-base"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        aria-label={t('save')}
        className="shrink-0 rounded p-1.5 text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Check className="size-4" aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={pending}
        aria-label={t('cancel')}
        className="shrink-0 rounded p-1.5 text-neutral-500 transition hover:bg-neutral-100 disabled:opacity-50"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </span>
  );
}
