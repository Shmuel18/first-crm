'use client';

import { useTransition } from 'react';

import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { deleteChecklistTemplateAction } from '../actions/delete-checklist-template';

import type { ChecklistTemplateAdminRow } from '../services/checklist-templates.service';

type Props = {
  template: ChecklistTemplateAdminRow;
  onEdit: (template: ChecklistTemplateAdminRow) => void;
};

export function ChecklistTemplateRow({ template, onEdit }: Props) {
  const t = useTranslations('settings.checklists');
  const tc = useTranslations('common');
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!window.confirm(t('row.deleteConfirm', { name: template.name_he }))) return;
    startTransition(async () => {
      const res = await deleteChecklistTemplateAction(template.id);
      if (res.ok) toast.success(t('row.deleted'));
      else if (res.error === 'system_locked') toast.error(t('row.systemLocked'));
      else toast.error(tc('saveFailed'));
    });
  };

  return (
    <li className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50/60">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-neutral-900">{template.name_he}</p>
          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-700">
            {t('row.itemCount', { count: template.items.length })}
          </span>
          {!template.is_active && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
              {t('row.inactive')}
            </span>
          )}
          {template.is_system && (
            <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">
              {t('row.system')}
            </span>
          )}
        </div>
        {template.name_en && <p className="truncate text-xs text-neutral-500">{template.name_en}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onEdit(template)}
          aria-label={`${tc('edit')} — ${template.name_he}`}
          className="flex size-8 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-100 hover:text-brand-gold-text"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
        </button>
        {!template.is_system && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            aria-label={`${tc('delete')} — ${template.name_he}`}
            className="flex size-8 items-center justify-center rounded-md text-neutral-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
}
