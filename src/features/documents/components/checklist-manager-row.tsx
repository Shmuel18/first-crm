'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, GripVertical, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { Locale } from '@/lib/i18n/direction';

import type { DocumentChecklistItem } from '../services/document-checklist.service';

type Props = {
  item: DocumentChecklistItem;
  locale: Locale;
  busy: boolean;
  onToggle: (item: DocumentChecklistItem) => void;
  onRemove: (item: DocumentChecklistItem) => void;
};

/**
 * One editable checklist row inside the manage modal: drag handle, label
 * (struck through when complete), a tick checkbox and a delete button.
 * Reordering uses dnd-kit's pointer-based sortable so it works on touch
 * (mobile) as well as mouse — drag is initiated only from the grip handle.
 *
 * Completion = manual tick OR a verified document; the tick writes only the
 * manual flag.
 */
export function ChecklistManagerRow({ item, locale, busy, onToggle, onRemove }: Props) {
  const t = useTranslations('documents.checklist');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.itemId,
  });

  const name = (locale === 'he' ? item.nameHe : item.nameEn) || item.nameHe;
  // Equivalent to status === 'verified' upstream, but recomputed from the
  // optimistic isDone flag so a tick reflects instantly before revalidation.
  const done = item.isDone || item.verifiedCount > 0;
  // A verified document forces completion even without the manual tick;
  // surface that so the user understands why it can't simply be unticked.
  const lockedByDoc = !item.isDone && item.verifiedCount > 0;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        'flex items-center gap-2 rounded-md border bg-white px-2 py-2 transition-colors',
        isDragging ? 'border-brand-gold-dark shadow-md' : 'border-neutral-200',
      ].join(' ')}
    >
      <button
        type="button"
        aria-label={t('manage.reorder')}
        className="cursor-grab text-neutral-400 hover:text-neutral-600 active:cursor-grabbing touch-none shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 rounded"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? t('manage.markUndone') : t('manage.markDone')}
        disabled={busy || lockedByDoc}
        onClick={() => onToggle(item)}
        className={[
          'size-5 rounded-md border inline-flex items-center justify-center shrink-0 transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50',
          done
            ? 'bg-emerald-600 border-emerald-600 text-white'
            : 'bg-white border-neutral-300 hover:border-neutral-400',
          busy || lockedByDoc ? 'opacity-60 cursor-not-allowed' : '',
        ].join(' ')}
      >
        {done && <Check className="size-3.5" aria-hidden="true" />}
      </button>

      <span
        className={[
          'flex-1 min-w-0 truncate text-sm',
          done ? 'text-neutral-400 line-through' : 'text-neutral-900',
        ].join(' ')}
      >
        {name}
        {!item.isRequired && (
          <span className="ms-2 text-[10px] uppercase tracking-wide text-neutral-400">
            {t('optional')}
          </span>
        )}
      </span>

      <button
        type="button"
        aria-label={t('manage.remove')}
        disabled={busy}
        onClick={() => onRemove(item)}
        className="shrink-0 rounded p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
}
