'use client';

import { useEffect, useState, useTransition } from 'react';

import { ListPlus, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Locale } from '@/lib/i18n/direction';

import { addChecklistTemplateAction } from '../actions/add-checklist-template';
import { getActiveChecklistTemplatesAction } from '../actions/get-checklist-templates';
import { CHECKLIST_TEMPLATE_GROUPS } from '../domain/checklist-templates';

import type { ChecklistTemplateOption } from '../services/checklist-templates-store.service';

type Props = {
  caseId: string;
  locale: Locale;
};

/**
 * "Preset list" dropdown inside the checklist manager — one click appends a
 * whole office work-list (Kaufman's templates) to the case checklist. Items
 * that already exist on the case are skipped server-side, so picking the
 * same list twice (or two lists sharing an item) never duplicates rows.
 */
export function ChecklistTemplatePicker({ caseId, locale }: Props) {
  const t = useTranslations('documents.checklist.manage');
  const tc = useTranslations('common');
  const [isPending, startTransition] = useTransition();
  const [templates, setTemplates] = useState<ChecklistTemplateOption[]>([]);

  // Templates are DB-driven (editable from /settings/checklists) — fetch on mount.
  useEffect(() => {
    let alive = true;
    void getActiveChecklistTemplatesAction().then((res) => {
      if (alive && res.ok) setTemplates(res.templates);
    });
    return () => {
      alive = false;
    };
  }, []);

  const pick = (templateKey: string) => {
    startTransition(async () => {
      const res = await addChecklistTemplateAction({ caseId, templateKey });
      if (!res.ok) {
        toast.error(tc('saveFailed'));
        return;
      }
      if (res.added === 0) toast.info(t('templateAllExist'));
      else toast.success(t('templateAdded', { count: res.added }));
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:border-brand-gold-text hover:text-brand-gold-text disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
          />
        }
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <ListPlus className="size-4" aria-hidden="true" />
        )}
        {t('addTemplate')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[50dvh] min-w-64 overflow-y-auto">
        {CHECKLIST_TEMPLATE_GROUPS.map((group, gi) => (
          // Base UI requires Label inside a Menu.Group (MenuGroupContext).
          <DropdownMenuGroup key={group}>
            {gi > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-neutral-500">
              {t(`templateGroups.${group}`)}
            </DropdownMenuLabel>
            {templates.filter((tpl) => tpl.group === group).map((tpl) => (
              <DropdownMenuItem key={tpl.key} disabled={isPending} onClick={() => pick(tpl.key)}>
                {locale === 'he' ? tpl.nameHe : tpl.nameEn}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
