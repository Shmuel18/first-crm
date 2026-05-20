import Link from 'next/link';

import { ArrowUpRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import {
  getCaseOption,
  listAssignableProfiles,
  listTasksForCase,
} from '@/features/tasks/services/tasks.service';
import type { Locale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';

import { TasksList } from './tasks-list';

type Props = { caseId: string; locale: Locale };

const VISIBLE_LIMIT = 4;

export async function CaseTasksBlock({ caseId, locale }: Props) {
  const t = await getTranslations('tasks');

  const [tasks, assignees, caseOption] = await Promise.all([
    listTasksForCase(asCaseId(caseId)),
    listAssignableProfiles(),
    getCaseOption(asCaseId(caseId), locale),
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
