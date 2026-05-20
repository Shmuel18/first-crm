import Link from 'next/link';

import { ArrowUpRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { listTasksForCase } from '@/features/tasks/services/tasks.service';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';

import { TasksList } from './tasks-list';

type Props = { caseId: string; locale: Locale };

const VISIBLE_LIMIT = 4;

export async function CaseTasksBlock({ caseId, locale }: Props) {
  const t = await getTranslations('tasks');

  const [tasks, assignees, caseOption] = await Promise.all([
    listTasksForCase(asCaseId(caseId)),
    fetchAssignees(),
    fetchSingleCaseOption(caseId, locale),
  ]);

  const visible = tasks.slice(0, VISIBLE_LIMIT);
  const hidden = tasks.length - visible.length;
  const cases = caseOption ? [caseOption] : [];

  return (
    <div className="space-y-2">
      <TasksList
        tasks={visible}
        assignees={assignees}
        cases={cases}
        locale={locale}
        presetCaseId={caseId}
        emptyKey="emptyCase"
        compact
      />

      {hidden > 0 && (
        <div className="pt-2 text-end">
          <Link
            href={`/tasks?view=all&case=${caseId}`}
            className="inline-flex items-center gap-1 text-xs text-[#C9A961] hover:underline"
          >
            {t('showAll', { count: hidden })}
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
      )}
    </div>
  );
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

async function fetchSingleCaseOption(caseId: string, locale: Locale) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('cases')
    .select(`
      id,
      case_number,
      case_borrowers(is_primary, borrower:borrowers(first_name, last_name))
    `)
    .eq('id', caseId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!data) return null;

  const primary = data.case_borrowers?.find((cb) => cb.is_primary)?.borrower;
  const placeholder = locale === 'he' ? 'ללא שם' : 'No name';
  const name = [primary?.first_name, primary?.last_name].filter(Boolean).join(' ') || placeholder;

  return {
    id: data.id,
    case_number: data.case_number,
    label: `#${data.case_number} · ${name}`,
  };
}
