import { getLocale, getTranslations } from 'next-intl/server';

import { TasksList } from '@/features/tasks/components/tasks-list';
import { TasksViewTabs } from '@/features/tasks/components/tasks-view-tabs';
import { listTasks } from '@/features/tasks/services/tasks.service';
import {
  TASK_STATUS_VALUES,
  TASK_VIEW_VALUES,
  type TaskStatus,
  type TaskView,
} from '@/features/tasks/types';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/i18n/direction';

type SearchParams = Promise<{ view?: string; status?: string }>;

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

  const t = await getTranslations('tasks');
  const locale = (await getLocale()) as Locale;

  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');

  const [tasks, mineCount, assignedByMeCount, allCount, assignees, cases] = await Promise.all([
    listTasks({ view, status }),
    countByView('mine'),
    countByView('assigned-by-me'),
    isAdmin === true ? countByView('all') : Promise.resolve(0),
    fetchAssignees(),
    fetchCaseOptions(locale),
  ]);

  return (
    <div className="space-y-5 -mt-6">
      <div>
        <h1 className="text-2xl font-light text-neutral-900">{t('title')}</h1>
        <p className="text-sm text-neutral-500 mt-1">{t('subtitle')}</p>
      </div>

      <TasksViewTabs
        currentView={view}
        isAdmin={isAdmin === true}
        counts={{ mine: mineCount, 'assigned-by-me': assignedByMeCount, all: allCount }}
      />

      <TasksList tasks={tasks} assignees={assignees} cases={cases} locale={locale} />
    </div>
  );
}

async function countByView(view: TaskView): Promise<number> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return 0;

  let query = supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .is('deleted_at', null);

  if (view === 'mine') query = query.eq('assigned_to', userRes.user.id);
  else if (view === 'assigned-by-me') query = query.eq('created_by', userRes.user.id);

  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

async function fetchAssignees() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('is_active', true)
    .order('first_name');
  return data ?? [];
}

async function fetchCaseOptions(locale: Locale) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('cases')
    .select(`
      id,
      case_number,
      case_borrowers!inner(
        is_primary,
        borrower:borrowers(first_name, last_name)
      )
    `)
    .is('deleted_at', null)
    .eq('case_borrowers.is_primary', true)
    .order('case_number', { ascending: false })
    .limit(200);

  const placeholder = locale === 'he' ? 'ללא שם' : 'No name';

  return (data ?? []).map((row) => {
    const primary = row.case_borrowers?.[0]?.borrower;
    const name =
      [primary?.first_name, primary?.last_name].filter(Boolean).join(' ') || placeholder;
    return {
      id: row.id,
      case_number: row.case_number,
      label: `#${row.case_number} · ${name}`,
    };
  });
}
