'use client';

import { useEffect, useState } from 'react';

import { AudioLines, Eye, FileText, Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { getDocumentPreviewUrlAction } from '@/features/documents/actions/get-document-preview-url';

import {
  deleteTaskAttachmentAction,
  getTaskAttachmentUrlAction,
  listTaskAttachmentsAction,
  listTaskCaseDocumentsAction,
} from '../actions/task-attachment-actions';
import { isAudioMime } from '../domain/recording';

import { TaskAudioPlayer } from './task-audio-player';
import { TaskDocPreviewDialog } from './task-doc-preview-dialog';

type Props = { taskId: string; reloadToken?: number };
type Item = {
  id: string;
  fileName: string;
  kind: 'general' | 'case';
  mimeType: string | null;
  driveUrl: string | null;
};
type Preview = { url: string; fileName: string; mimeType: string | null; driveUrl: string | null };

/**
 * Every file attached to a task: general task attachments plus case documents
 * tagged with this task. Voice recordings render as inline players; document
 * previews keep the explicit eye button.
 */
export function TaskAttachmentsList({ taskId, reloadToken }: Props) {
  const t = useTranslations('tasks.form.fields');
  const tc = useTranslations('common');
  const [items, setItems] = useState<Item[] | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string | null>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const [general, caseDocs] = await Promise.all([
        listTaskAttachmentsAction(taskId),
        listTaskCaseDocumentsAction(taskId),
      ]);
      const nextItems: Item[] = [
        ...general.map((g) => ({
          id: g.id,
          fileName: g.file_name,
          kind: 'general' as const,
          mimeType: g.mime_type,
          driveUrl: g.drive_file_url,
        })),
        ...caseDocs.map((d) => ({
          id: d.id,
          fileName: d.file_name,
          kind: 'case' as const,
          mimeType: d.mime_type,
          driveUrl: d.drive_file_url,
        })),
      ];
      if (!active) return;
      setItems(nextItems);

      const audioItems = nextItems.filter((item) => isAudioMime(item.mimeType));
      const resolved = await Promise.all(
        audioItems.map(async (item) => {
          const result =
            item.kind === 'general'
              ? await getTaskAttachmentUrlAction(item.id)
              : await getDocumentPreviewUrlAction(item.id);
          return [item.id, result.ok ? result.url : null] as const;
        }),
      );
      if (active) setAudioUrls(Object.fromEntries(resolved));
    })();

    return () => {
      active = false;
    };
  }, [taskId, reloadToken]);

  if (items === null || items.length === 0) return null;

  const openPreview = async (item: Item): Promise<void> => {
    setBusyId(item.id);
    const res =
      item.kind === 'general'
        ? await getTaskAttachmentUrlAction(item.id)
        : await getDocumentPreviewUrlAction(item.id);
    setBusyId(null);
    if (res.ok)
      setPreview({
        url: res.url,
        fileName: item.fileName,
        mimeType: item.mimeType,
        driveUrl: item.driveUrl,
      });
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
    <>
      {preview && (
        <TaskDocPreviewDialog
          url={preview.url}
          fileName={preview.fileName}
          mimeType={preview.mimeType}
          driveUrl={preview.driveUrl}
          onClose={() => setPreview(null)}
        />
      )}
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-neutral-700">{t('attachmentsExisting')}</p>
        <ul className="space-y-1">
          {items.map((item) => {
            const isAudio = isAudioMime(item.mimeType);
            const audioUrl = audioUrls[item.id];
            return (
              <li
                key={item.id}
                className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  {isAudio ? (
                    <AudioLines
                      className="size-4 shrink-0 text-brand-gold-text"
                      aria-hidden="true"
                    />
                  ) : (
                    <FileText
                      className="size-4 shrink-0 text-brand-gold-text"
                      aria-hidden="true"
                    />
                  )}
                  <span className="flex-1 truncate text-neutral-800">{item.fileName}</span>
                  {item.kind === 'case' && (
                    <span className="shrink-0 rounded-full bg-brand-gold-soft px-2 py-0.5 text-[10px] font-medium text-brand-gold-text">
                      {t('attachmentsInCase')}
                    </span>
                  )}
                  {!isAudio && (
                    <button
                      type="button"
                      onClick={() => void openPreview(item)}
                      disabled={busyId === item.id}
                      aria-label={`${t('attachmentsView')} — ${item.fileName}`}
                      className="flex size-8 items-center justify-center rounded-md text-neutral-500 transition hover:bg-white hover:text-brand-gold-text disabled:opacity-50"
                    >
                      {busyId === item.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  )}
                  {item.kind === 'general' && (
                    <button
                      type="button"
                      onClick={() => void remove(item.id)}
                      disabled={busyId === item.id}
                      aria-label={`${tc('delete')} — ${item.fileName}`}
                      className="flex size-8 items-center justify-center rounded-md text-neutral-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
                {isAudio && (
                  <div className="mt-2 ps-6">
                    {typeof audioUrl === 'string' ? (
                      <TaskAudioPlayer src={audioUrl} className="h-10 w-full" />
                    ) : audioUrl === null ? (
                      <p className="text-xs text-rose-600">{t('attachmentsFailed')}</p>
                    ) : (
                      <div className="flex h-10 items-center text-neutral-400">
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
