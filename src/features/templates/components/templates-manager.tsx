'use client';

import { useState } from 'react';

import { Mail, MessageSquareText, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { TemplateFormDialog } from './template-form-dialog';
import { TemplateRow } from './template-row';
import { SystemTemplateDialog } from './system-template-dialog';
import { SystemTemplateRow } from './system-template-row';
import type { SystemEmailTemplateSummary } from '../services/system-email-templates.service';
import type { MessageTemplate } from '../types';

type Props = {
  templates: ReadonlyArray<MessageTemplate>;
  systemTemplates: ReadonlyArray<SystemEmailTemplateSummary>;
  locale: 'he' | 'en';
};

export function TemplatesManager({ templates, systemTemplates, locale }: Props) {
  const t = useTranslations('templates');
  const [tab, setTab] = useState<'automatic' | 'manual'>('automatic');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [systemOpen, setSystemOpen] = useState(false);
  const [editingSystem, setEditingSystem] = useState<SystemEmailTemplateSummary | null>(null);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (template: MessageTemplate) => {
    setEditing(template);
    setOpen(true);
  };
  const openSystemEdit = (template: SystemEmailTemplateSummary) => {
    setEditingSystem(template);
    setSystemOpen(true);
  };
  const setSystemDialogOpen = (nextOpen: boolean) => {
    setSystemOpen(nextOpen);
    if (!nextOpen) setEditingSystem(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
          <button
            type="button"
            onClick={() => setTab('automatic')}
            className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition ${
              tab === 'automatic' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
            }`}
          >
            <Mail className="size-4" />
            {t('tabs.automatic')}
          </button>
          <button
            type="button"
            onClick={() => setTab('manual')}
            className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition ${
              tab === 'manual' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
            }`}
          >
            <MessageSquareText className="size-4" />
            {t('tabs.manual')}
          </button>
        </div>

        {tab === 'manual' && (
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-brand-gold hover:bg-brand-gold-dark text-brand-black font-medium text-sm transition"
        >
          <Plus className="size-4" />
          {t('new')}
        </button>
        )}
      </div>

      {tab === 'automatic' ? (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {systemTemplates.map((template) => (
            <SystemTemplateRow
              key={template.key}
              template={template}
              locale={locale}
              onEdit={openSystemEdit}
            />
          ))}
        </ul>
      ) : templates.length === 0 ? (
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
      <SystemTemplateDialog
        key={editingSystem?.key ?? 'none'}
        open={systemOpen}
        onOpenChange={setSystemDialogOpen}
        template={editingSystem}
        initialLocale={locale}
      />
    </div>
  );
}
