'use client';

import { useState } from 'react';

import {
  DndContext,
  KeyboardSensor,
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
import { TaskFormDialog } from './task-form-dialog';
import { TaskReassignDialog } from './task-reassign-dialog';
import { TaskThreadDialog } from './task-thread-dialog';
import type { TaskStatus, TaskWithRelations } from '../types';

const BOARD_COLUMNS: TaskStatus[] = ['pending', 'in_progress', 'snoozed', 'completed'];

type Profile = { id: string; first_name: string | null; last_name: string | null };
type CaseOption = { id: string; case_number: string; label: string };

type Props = {
  tasks: ReadonlyArray<TaskWithRelations>;
  locale: Locale;
  assignees: ReadonlyArray<Profile>;
  cases: ReadonlyArray<CaseOption>;
};

export function TasksBoard({ tasks, locale, assignees, cases }: Props) {
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

  const [editing, setEditing] = useState<TaskWithRelations | null>(null);
  const [reassignTarget, setReassignTarget] = useState<TaskWithRelations | null>(null);
  const [threadTarget, setThreadTarget] = useState<TaskWithRelations | null>(null);

  // Small activation distance so a click (open) isn't read as a drag.
  // KeyboardSensor adds keyboard operability (A11Y-1): focus a card (Tab), pick
  // it up (Space/Enter), move across columns with arrow keys, drop (Space/Enter),
  // cancel (Esc). The card already spreads dnd's focusable attributes + keyboard
  // listeners, so the board just needed the sensor wired in.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

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
    <>
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
              onOpen={setEditing}
              onReassign={setReassignTarget}
              onThread={setThreadTarget}
            />
          ))}
        </div>
      </DndContext>

      <TaskFormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        mode="edit"
        task={editing}
        assignees={assignees}
        cases={cases}
      />

      <TaskReassignDialog
        open={reassignTarget !== null}
        onOpenChange={(open) => {
          if (!open) setReassignTarget(null);
        }}
        task={reassignTarget}
        assignees={assignees}
      />

      <TaskThreadDialog
        open={threadTarget !== null}
        onOpenChange={(open) => {
          if (!open) setThreadTarget(null);
        }}
        task={threadTarget}
      />
    </>
  );
}
