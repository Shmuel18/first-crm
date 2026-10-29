'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';

import { CheckCircle2, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import type { CalendarItem } from '../types';

type Props = {
  item: CalendarItem | null;
  onClose: () => void;
  /** Move a target date / task / event to another day; resolves to success. */
  onMove: (item: CalendarItem, day: string) => Promise<boolean>;
  onCompleteTask: (taskId: string) => Promise<boolean>;
  onEditEvent: (eventId: string) => void;
  onDeleteEvent: (eventId: string) => Promise<boolean>;
};

/** What an item is, and the one or two things you can do with it from here. */
export function CalendarItemDialog({ item, onClose, onMove, onCompleteTask, onEditEvent, onDeleteEvent }: Props) {
  const t = useTranslations('calendar');
  const [day, setDay] = useState(item?.day ?? '');
  const [isPending, startTransition] = useTransition();
  if (!item) return null;

  const run = (fn: () => Promise<boolean>): void => {
    startTransition(async () => {
      if (await fn()) onClose();
    });
  };
  const editable = item.editable;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t(`prefix.${item.layer}`, { detail: item.detail ?? '' })} {item.title}
          </DialogTitle>
          <DialogDescription>
            {t(`layers.${item.layer}`)} · {Number(item.day.slice(8, 10))}/{Number(item.day.slice(5, 7))}/{item.day.slice(0, 4)}
            {item.time && <span dir="ltr"> {item.time}{item.endTime ? `–${item.endTime}` : ''}</span>}
          </DialogDescription>
        </DialogHeader>

        {item.caseLabel && item.caseLabel !== item.title && (
          <p className="text-sm text-neutral-700">{item.caseLabel}</p>
        )}
        {item.layer === 'stage' && item.direction === 'back' && (
          <p className="text-xs text-red-700">{t('movedBack')}</p>
        )}

        {editable && editable.kind !== 'event' && (
          <div className="flex items-end gap-2">
            <label className="flex-1 text-xs text-neutral-600">
              {t('moveTo')}
              <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="mt-1" />
            </label>
            <Button type="button" disabled={isPending || !day || day === item.day} onClick={() => run(() => onMove(item, day))}>
              {t('save')}
            </Button>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {editable?.kind === 'task' && (
            <Button type="button" variant="outline" disabled={isPending} onClick={() => run(() => onCompleteTask(editable.taskId))}>
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {t('markDone')}
            </Button>
          )}
          {editable?.kind === 'event' && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  if (window.confirm(t('confirmDelete'))) run(() => onDeleteEvent(editable.eventId));
                }}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {t('delete')}
              </Button>
              <Button type="button" variant="outline" onClick={() => onEditEvent(editable.eventId)}>
                <Pencil className="size-4" aria-hidden="true" />
                {t('edit')}
              </Button>
            </>
          )}
          {item.href && (
            <Link
              href={item.href}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-black px-3 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              {t(editable?.kind === 'task' ? 'openTask' : 'openCase')}
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
