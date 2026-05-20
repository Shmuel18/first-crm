import type { Metadata } from 'next';
import Link from 'next/link';

import { CheckSquare, X } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { z } from 'zod';

import { PageHeader } from '@/components/shared/page-header';
import { TasksList } from '@/features/tasks/components/tasks-list';
import { TasksStatStrip } from '@/features/tasks/components/tasks-stat-strip';
import { TasksViewTabs } from '@/features/tasks/components/tasks-view-tabs';
import { isOverdue } from '@/features/tasks/domain/task-state';
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
import type { Locale } from '@/lib/i18n/direction';

type SearchParams = Promise<{ view?: string; status?: string; case?: string }>;

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

  const t = await getTranslations('tasks');
  const locale = (await getLocale()) as Locale;

  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');

  const [tasks, mineCount, assignedByMeCount, allCount, assignees, cases, caseLabel] =
    await Promise.all([
      listTasks({ view, status, caseId: caseId ? asCaseId(caseId) : undefined }),
      countPendingByView('mine'),
      countPendingByView('assigned-by-me'),
      isAdmin === true ? countPendingByView('all') : Promise.resolve(0),
      listAssignableProfiles(),
      listCaseOptions(locale),
      caseId ? getCaseNumberLabel(asCaseId(caseId)) : Promise.resolve(null),
    ]);

  const openCount = tasks.filter((task) => task.status === 'pending').length;
  const overdueCount = tasks.filter((task) => isOverdue(task)).length;
  const doneCount = tasks.filter((task) => task.status === 'completed').length;

  return (
    <div className="space-y-5">
      <PageHeader icon={<CheckSquare />} title={t('title')} subtitle={t('subtitle')} />

      <TasksViewTabs
        currentView={view}
        isAdmin={isAdmin === true}
        counts={{ mine: mineCount, 'assigned-by-me': assignedByMeCount, all: allCount }}
      />

      <TasksStatStrip open={openCount} overdue={overdueCount} done={doneCount} />

      {caseId && caseLabel && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[#C9A961]/40 bg-[#FAF8F3] px-3 py-2">
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

      <TasksList
        tasks={tasks}
        assignees={assignees}
        cases={cases}
        locale={locale}
        presetCaseId={caseId ?? null}
      />
    </div>
  );
}
