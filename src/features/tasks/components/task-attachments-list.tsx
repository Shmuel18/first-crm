'use client';

import { useEffect, useState } from 'react';

import { Download, FileText, Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { getDocumentPreviewUrlAction } from '@/features/documents/actions/get-document-preview-url';

import {
  deleteTaskAttachmentAction,
  getTaskAttachmentUrlAction,
  listTaskAttachmentsAction,
  listTaskCaseDocumentsAction,
} from '../actions/task-attachment-actions';

type Props = { taskId: string };
type Item = { id: string; fileName: string; kind: 'general' | 'case' };

/**
 * Every file attached to a task: the general (case-less) attachments from the
 * task store AND the case documents that a case-linked task's files landed in
 * (tagged metadata.task_id — they used to be invisible from the task, the
 * "Kaufman uploaded a doc but I can't see it" report). Case docs are download-
 * only here (a "in case" badge); they're managed on the case's Documents page.
 */
export function TaskAttachmentsList({ taskId }: Props) {
  const t = useTranslations('tasks.form.fields');
  const tc = useTranslations('common');
  const [items, setItems] = useState<Item[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      listTaskAttachmentsAction(taskId),
      listTaskCaseDocumentsAction(taskId),
    ]).then(([general, caseDocs]) => {
      if (!active) return;
      setItems([
        ...general.map((g) => ({ id: g.id, fileName: g.file_name, kind: 'general' as const })),
        ...caseDocs.map((d) => ({ id: d.id, fileName: d.file_name, kind: 'case' as const })),
      ]);
    });
    return () => {
      active = false;
    };
  }, [taskId]);

  if (items === null || items.length === 0) return null;

  const download = async (item: Item): Promise<void> => {
    setBusyId(item.id);
    const res =
      item.kind === 'general'
        ? await getTaskAttachmentUrlAction(item.id)
        : await getDocumentPreviewUrlAction(item.id);
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
            <span className="flex-1 truncate text-neutral-800">{a.fileName}</span>
            {a.kind === 'case' && (
              <span className="shrink-0 rounded-full bg-brand-gold-soft px-2 py-0.5 text-[10px] font-medium text-brand-gold-text">
                {t('attachmentsInCase')}
              </span>
            )}
            <button
              type="button"
              onClick={() => void download(a)}
              disabled={busyId === a.id}
              aria-label={`${t('attachmentsDownload')} — ${a.fileName}`}
              className="flex size-8 items-center justify-center rounded-md text-neutral-500 transition hover:bg-white hover:text-brand-gold-text disabled:opacity-50"
            >
              {busyId === a.id ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-4" aria-hidden="true" />
              )}
            </button>
            {a.kind === 'general' && (
              <button
                type="button"
                onClick={() => void remove(a.id)}
                disabled={busyId === a.id}
                aria-label={`${tc('delete')} — ${a.fileName}`}
                className="flex size-8 items-center justify-center rounded-md text-neutral-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
