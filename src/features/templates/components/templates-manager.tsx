'use client';

import { useState } from 'react';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { TemplateFormDialog } from './template-form-dialog';
import { TemplateRow } from './template-row';
import type { MessageTemplate } from '../types';

type Props = { templates: ReadonlyArray<MessageTemplate> };

export function TemplatesManager({ templates }: Props) {
  const t = useTranslations('templates');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (template: MessageTemplate) => {
    setEditing(template);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-brand-gold hover:bg-brand-gold-dark text-brand-black font-medium text-sm transition"
        >
          <Plus className="size-4" />
          {t('new')}
        </button>
      </div>

      {templates.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-neutral-500">{t('empty')}</p>
      ) : (
        <ul className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-hidden">
          {templates.map((template) => (
            <TemplateRow key={template.id} template={template} onEdit={openEdit} />
          ))}
        </ul>
      )}

      <TemplateFormDialog
        open={open}
        onOpenChange={setOpen}
        mode={editing ? 'edit' : 'create'}
        template={editing}
      />
    </div>
  );
}
