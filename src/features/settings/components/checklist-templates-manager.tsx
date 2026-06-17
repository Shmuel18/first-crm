'use client';

import { useState } from 'react';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ChecklistTemplateFormDialog } from './checklist-template-form-dialog';
import { ChecklistTemplateRow } from './checklist-template-row';
import { CHECKLIST_TEMPLATE_GROUP_VALUES } from '../schemas/checklist-template.schema';

import type { ChecklistTemplateAdminRow } from '../services/checklist-templates.service';

type Props = { templates: ReadonlyArray<ChecklistTemplateAdminRow> };

export function ChecklistTemplatesManager({ templates }: Props) {
  const t = useTranslations('settings.checklists');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ChecklistTemplateAdminRow | null>(null);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (template: ChecklistTemplateAdminRow) => {
    setEditing(template);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openNew}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-gold px-4 text-sm font-medium text-brand-black transition hover:bg-brand-gold-dark"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t('new')}
        </button>
      </div>

      {templates.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-neutral-500">{t('empty')}</p>
      ) : (
        CHECKLIST_TEMPLATE_GROUP_VALUES.map((group) => {
          const rows = templates.filter((tpl) => tpl.group_key === group);
          if (rows.length === 0) return null;
          return (
            <section key={group} className="space-y-2">
              <h3 className="text-sm font-semibold text-neutral-700">{t(`groups.${group}`)}</h3>
              <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                {rows.map((tpl) => (
                  <ChecklistTemplateRow key={tpl.id} template={tpl} onEdit={openEdit} />
                ))}
              </ul>
            </section>
          );
        })
      )}

      <ChecklistTemplateFormDialog
        key={editing?.id ?? 'new'}
        open={open}
        onOpenChange={setOpen}
        template={editing}
      />
    </div>
  );
}
