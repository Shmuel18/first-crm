'use client';

import { useRouter } from 'next/navigation';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { updateCaseFieldAction } from '@/features/cases/actions/update-case-field';
import { completeTaskAction } from '@/features/tasks/actions/complete-task';
import { rescheduleTaskAction } from '@/features/tasks/actions/reschedule-task';
import { callAction } from '@/lib/actions/call-action';

import { deleteCalendarEventAction } from '../actions/delete-calendar-event';
import { moveCalendarEventAction } from '../actions/move-calendar-event';
import { addDays, daysBetween } from '../domain/calendar-range';
import type { CalendarItem } from '../types';

/**
 * The calendar's mutations — move (drag or the date field), complete a task,
 * delete an event — each refreshing the server-rendered feed on success and
 * toasting on failure. Resolve to whether it worked, for dialogs to close.
 */
export function useCalendarActions(): {
  move: (item: CalendarItem, day: string) => Promise<boolean>;
  completeTask: (taskId: string) => Promise<boolean>;
  deleteEvent: (eventId: string) => Promise<boolean>;
} {
  const t = useTranslations('calendar');
  const router = useRouter();

  const finish = (ok: boolean): boolean => {
    if (ok) router.refresh();
    else toast.error(t('actionFailed'));
    return ok;
  };

  const move = async (item: CalendarItem, day: string): Promise<boolean> => {
    const e = item.editable;
    if (!e || day === item.day) return false;
    const res =
      e.kind === 'targetDate'
        ? await callAction(() => updateCaseFieldAction(e.caseId, 'target_date', day))
        : e.kind === 'task'
          ? await callAction(() => rescheduleTaskAction(e.taskId, day))
          : // A chip of a multi-day event moves the whole span by the same offset.
            await callAction(() => moveCalendarEventAction(e.eventId, addDays(e.startDay, daysBetween(item.day, day))));
    return finish(res.ok);
  };

  const completeTask = async (taskId: string): Promise<boolean> =>
    finish((await callAction(() => completeTaskAction(taskId))).ok);

  const deleteEvent = async (eventId: string): Promise<boolean> =>
    finish((await callAction(() => deleteCalendarEventAction(eventId))).ok);

  return { move, completeTask, deleteEvent };
}
