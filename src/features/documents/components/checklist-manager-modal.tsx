'use client';

import { useState, useTransition } from 'react';

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Locale } from '@/lib/i18n/direction';

import { addChecklistItemAction } from '../actions/add-checklist-item';
import { removeChecklistItemAction } from '../actions/remove-checklist-item';
import { reorderChecklistItemsAction } from '../actions/reorder-checklist-items';
import { toggleChecklistItemAction } from '../actions/toggle-checklist-item';
import type { DocumentChecklistItem } from '../services/document-checklist.service';
import { ChecklistManagerRow } from './checklist-manager-row';
import { ChecklistTemplatePicker } from './checklist-template-picker';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  title: string;
  items: ReadonlyArray<DocumentChecklistItem>;
  locale: Locale;
};

const isDone = (i: DocumentChecklistItem): boolean => i.isDone || i.verifiedCount > 0;

/**
 * Editable checklist manager (the modal in the mockup): tick rows received,
 * add free-text rows, remove rows (confirming when a document is linked) and
 * drag to reorder. Local state mirrors the server list and resyncs after each
 * action's revalidation.
 */
export function ChecklistManagerModal({
  open,
  onOpenChange,
  caseId,
  title,
  items,
  locale,
}: Props) {
  const t = useTranslations('documents.checklist');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<DocumentChecklistItem[]>([...items]);
  const [label, setLabel] = useState('');
  const [pendingRemove, setPendingRemove] = useState<DocumentChecklistItem | null>(null);
  const [isPending, startTransition] = useTransition();

  // Pointer-based drag → works on touch (mobile) and mouse. Small activation
  // distance so a tap on the handle isn't read as a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Resync to the server list whenever it changes (after an action's
  // revalidation). Render-time sync — the documented React pattern for
  // resetting state on a prop change without an effect.
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setRows([...items]);
  }

  const doneCount = rows.filter(isDone).length;

  const handleToggle = (item: DocumentChecklistItem) => {
    const next = !item.isDone;
    setRows((prev) =>
      prev.map((r) => (r.itemId === item.itemId ? { ...r, isDone: next } : r)),
    );
    startTransition(async () => {
      const res = await toggleChecklistItemAction(caseId, item.itemId, next);
      if (!res.ok) {
        setRows((prev) =>
          prev.map((r) => (r.itemId === item.itemId ? { ...r, isDone: !next } : r)),
        );
        toast.error(tc('saveFailed'));
      }
    });
  };

  const handleAdd = () => {
    const value = label.trim();
    if (!value) return;
    startTransition(async () => {
      const res = await addChecklistItemAction(caseId, value);
      if (res.ok) setLabel('');
      else toast.error(tc('saveFailed'));
    });
  };

  const doRemove = (item: DocumentChecklistItem) => {
    setRows((prev) => prev.filter((r) => r.itemId !== item.itemId));
    startTransition(async () => {
      const res = await removeChecklistItemAction(caseId, item.itemId);
      if (!res.ok) toast.error(tc('saveFailed'));
    });
  };

  const handleRemove = (item: DocumentChecklistItem) => {
    if (item.uploadedCount > 0) setPendingRemove(item);
    else doRemove(item);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = rows.findIndex((r) => r.itemId === active.id);
    const to = rows.findIndex((r) => r.itemId === over.id);
    if (from === -1 || to === -1) return;

    const reordered = arrayMove(rows, from, to);
    setRows(reordered);
    const ordered = reordered.map((r) => r.itemId);
    startTransition(async () => {
      const res = await reorderChecklistItemsAction(caseId, ordered);
      if (!res.ok) toast.error(tc('saveFailed'));
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-neutral-500">
            {t('manage.progress', { done: doneCount, total: rows.length })}
          </p>
        </DialogHeader>

        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500">{t('manage.empty')}</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={rows.map((r) => r.itemId)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-1.5 max-h-[55dvh] overflow-y-auto pe-1">
                {rows.map((item) => (
                  <ChecklistManagerRow
                    key={item.itemId}
                    item={item}
                    locale={locale}
                    busy={isPending}
                    onToggle={handleToggle}
                    onRemove={handleRemove}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <ChecklistTemplatePicker caseId={caseId} locale={locale} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={200}
            placeholder={t('manage.addPlaceholder')}
            className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
          />
          <button
            type="submit"
            disabled={isPending || label.trim().length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-4 py-2 text-sm font-medium text-brand-black transition hover:bg-brand-gold-hover disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            {t('manage.add')}
          </button>
        </form>
      </DialogContent>

      <AlertDialog
        open={pendingRemove !== null}
        onOpenChange={(o) => !o && setPendingRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogTitle>{t('manage.removeConfirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('manage.removeConfirmBody', { count: pendingRemove?.uploadedCount ?? 0 })}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
              {tc('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRemove) doRemove(pendingRemove);
                setPendingRemove(null);
              }}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
            >
              {t('manage.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
