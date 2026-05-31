import type { Metadata } from 'next';
import Link from 'next/link';

import { CheckSquare, X } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { z } from 'zod';

import { PageHeader } from '@/components/shared/page-header';
import { TasksBoard } from '@/features/tasks/components/tasks-board';
import { TasksLayoutToggle } from '@/features/tasks/components/tasks-layout-toggle';
import { TasksList } from '@/features/tasks/components/tasks-list';
import { TaskCreateButton } from '@/features/tasks/components/task-create-button';
import { TasksStatStrip } from '@/features/tasks/components/tasks-stat-strip';
import { TasksTagFilter } from '@/features/tasks/components/tasks-tag-filter';
import { TasksViewTabs } from '@/features/tasks/components/tasks-view-tabs';
import { capCompletedTasks, isImmediateTask, isOverdue } from '@/features/tasks/domain/task-state';
import { filterTasksByTag } from '@/features/tasks/domain/task-tags';
import {
  countPendingByView,
  getCaseNumberLabel,
  listAssignableProfiles,
  listCaseOptions,
  listTasks,
} from '@/features/tasks/services/tasks.service';
import {
  TASK_STATUS_VALUES,
  TASK_VIEW_VALUES,
  type TaskStatus,
  type TaskView,
} from '@/features/tasks/types';
import { createClient } from '@/lib/supabase/server';
import { asCaseId } from '@/lib/types/branded';
import { parseLocale } from '@/lib/i18n/direction';

type SearchParams = Promise<{
  view?: string;
  status?: string;
  case?: string;
  display?: string;
  tag?: string;
  focus?: string;
}>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('tasks');
  return { title: t('title'), description: t('subtitle') };
}

export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const view: TaskView = (TASK_VIEW_VALUES as readonly string[]).includes(sp.view ?? '')
    ? (sp.view as TaskView)
    : 'mine';
  const status: TaskStatus | undefined = (TASK_STATUS_VALUES as readonly string[]).includes(
    sp.status ?? '',
  )
    ? (sp.status as TaskStatus)
    : undefined;
  const caseId = z.uuid().safeParse(sp.case).success ? sp.case : undefined;
  const display: 'board' | 'list' = sp.display === 'list' ? 'list' : 'board';
  const focus: 'immediate' | 'overdue' | null =
    sp.focus === 'immediate' || sp.focus === 'overdue' ? sp.focus : null;

  const t = await getTranslations('tasks');
  const locale = parseLocale(await getLocale());

  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');

  // The board groups by status into columns, so it needs every status; the
  // status filter only applies to the list view.
  const [tasks, mineCount, assignedByMeCount, allCount, assignees, cases, caseLabel] =
    await Promise.all([
      listTasks({
        view,
        status: display === 'board' ? undefined : status,
        caseId: caseId ? asCaseId(caseId) : undefined,
      }),
      countPendingByView('mine'),
      countPendingByView('assigned-by-me'),
      isAdmin === true ? countPendingByView('all') : Promise.resolve(0),
      listAssignableProfiles(),
      listCaseOptions(locale),
      caseId ? getCaseNumberLabel(asCaseId(caseId)) : Promise.resolve(null),
    ]);

  const visibleTasks = filterTasksByTag(tasks, sp.tag ?? null);
  const immediateCount = visibleTasks.filter((task) => isImmediateTask(task)).length;
  const openCount = visibleTasks.filter((task) => task.status === 'pending').length;
  const overdueCount = visibleTasks.filter((task) => isOverdue(task)).length;
  const doneCount = visibleTasks.filter((task) => task.status === 'completed').length;

  // Triage focus: clicking the "immediate"/"overdue" KPI filters what the
  // board/list shows. The counts above stay on the full set so the strip
  // doesn't collapse when you focus.
  const focusedTasks =
    focus === 'immediate'
      ? visibleTasks.filter((task) => isImmediateTask(task))
      : focus === 'overdue'
        ? visibleTasks.filter((task) => isOverdue(task))
        : visibleTasks;

  return (
    <div className="space-y-5">
      <PageHeader icon={<CheckSquare />} title={t('title')} subtitle={t('subtitle')} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <TasksViewTabs
          currentView={view}
          isAdmin={isAdmin === true}
          counts={{ mine: mineCount, 'assigned-by-me': assignedByMeCount, all: allCount }}
        />
        <div className="flex items-center gap-2 ms-auto">
          <TaskCreateButton
            assignees={assignees}
            cases={cases}
            presetCaseId={caseId ?? null}
            size="sm"
          />
          <TasksLayoutToggle />
        </div>
      </div>

      <TasksTagFilter />

      <TasksStatStrip
        immediate={immediateCount}
        open={openCount}
        overdue={overdueCount}
        done={doneCount}
        focus={focus}
      />

      {caseId && caseLabel && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-gold/40 bg-brand-gold-soft px-3 py-2">
          <span className="text-sm text-neutral-700">
            {t('filteredByCase', { label: caseLabel })}
          </span>
          <Link
            href="/tasks?view=all"
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900"
          >
            <X className="size-3.5" />
            {t('clearCaseFilter')}
          </Link>
        </div>
      )}

      {display === 'board' ? (
        <TasksBoard
          tasks={capCompletedTasks(focusedTasks, 50)}
          locale={locale}
          assignees={assignees}
          cases={cases}
        />
      ) : (
        <TasksList
          tasks={focusedTasks}
          assignees={assignees}
          cases={cases}
          locale={locale}
          presetCaseId={caseId ?? null}
          hideCreateButton
        />
      )}
    </div>
  );
}
