'use client';

import { useEffect, useState } from 'react';

import { Download, FileText, Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  deleteTaskAttachmentAction,
  getTaskAttachmentUrlAction,
  listTaskAttachmentsAction,
} from '../actions/task-attachment-actions';
import type { TaskAttachment } from '../services/task-attachments.service';

type Props = { taskId: string };

/** Lists a task's general (case-less) attachments with download + delete. */
export function TaskAttachmentsList({ taskId }: Props) {
  const t = useTranslations('tasks.form.fields');
  const tc = useTranslations('common');
  const [items, setItems] = useState<TaskAttachment[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listTaskAttachmentsAction(taskId).then((res) => {
      if (active) setItems(res);
    });
    return () => {
      active = false;
    };
  }, [taskId]);

  if (items === null || items.length === 0) return null;

  const download = async (id: string): Promise<void> => {
    setBusyId(id);
    const res = await getTaskAttachmentUrlAction(id);
    setBusyId(null);
    if (res.ok) window.open(res.url, '_blank', 'noopener,noreferrer');
    else toast.error(t('attachmentsFailed'));
  };

  const remove = async (id: string): Promise<void> => {
    setBusyId(id);
    const res = await deleteTaskAttachmentAction(id);
    setBusyId(null);
    if (res.ok) setItems((prev) => (prev ?? []).filter((x) => x.id !== id));
    else toast.error(t('attachmentsFailed'));
  };

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-neutral-700">{t('attachmentsExisting')}</p>
      <ul className="space-y-1">
        {items.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm"
          >
            <FileText className="size-4 shrink-0 text-brand-gold-text" aria-hidden="true" />
            <span className="flex-1 truncate text-neutral-800">{a.file_name}</span>
            <button
              type="button"
              onClick={() => void download(a.id)}
              disabled={busyId === a.id}
              aria-label={`${t('attachmentsDownload')} — ${a.file_name}`}
              className="flex size-8 items-center justify-center rounded-md text-neutral-500 transition hover:bg-white hover:text-brand-gold-text disabled:opacity-50"
            >
              {busyId === a.id ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-4" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={() => void remove(a.id)}
              disabled={busyId === a.id}
              aria-label={`${tc('delete')} — ${a.file_name}`}
              className="flex size-8 items-center justify-center rounded-md text-neutral-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
