'use client';

import { useState } from 'react';

import {
  DndContext,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import type { Locale } from '@/lib/i18n/direction';

import { changeTaskStatusAction } from '../actions/change-task-status';
import { TaskBoardColumn } from './task-board-column';
import type { TaskStatus, TaskWithRelations } from '../types';

const BOARD_COLUMNS: TaskStatus[] = ['pending', 'in_progress', 'snoozed', 'completed'];

type Props = { tasks: ReadonlyArray<TaskWithRelations>; locale: Locale };

export function TasksBoard({ tasks, locale }: Props) {
  const t = useTranslations('tasks.status');
  const tb = useTranslations('tasks.board');
  const tc = useTranslations('common');

  const [items, setItems] = useState<ReadonlyArray<TaskWithRelations>>(tasks);
  // Reconcile to fresh server data after a revalidation (render-time, no effect).
  const [syncedRef, setSyncedRef] = useState(tasks);
  if (syncedRef !== tasks) {
    setSyncedRef(tasks);
    setItems(tasks);
  }

  // Small activation distance so a click (e.g. the case link) isn't read as a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (event: DragEndEvent) => {
    if (!event.over) return;
    const taskId = String(event.active.id);
    const target = String(event.over.id) as TaskStatus;
    const task = items.find((it) => it.id === taskId);
    if (!task || task.status === target) return;

    const previous = items;
    setItems((cur) => cur.map((it) => (it.id === taskId ? { ...it, status: target } : it)));

    void changeTaskStatusAction(taskId, target).then((res) => {
      if (!res.ok) {
        setItems(previous);
        toast.error(tc('saveFailed'));
      }
    });
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {BOARD_COLUMNS.map((status) => (
          <TaskBoardColumn
            key={status}
            status={status}
            label={t(status)}
            tasks={items.filter((it) => it.status === status)}
            locale={locale}
            emptyLabel={tb('empty')}
          />
        ))}
      </div>
    </DndContext>
  );
}
