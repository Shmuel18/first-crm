'use client';

import { useTransition } from 'react';

import { Mail, MessageCircle, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { deleteTemplateAction } from '../actions/delete-template';
import type { MessageTemplate, TemplateChannel } from '../types';

const CHANNEL_ICON: Record<TemplateChannel, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageCircle,
  email: Mail,
  general: MessageSquare,
};

type Props = { template: MessageTemplate; onEdit: (template: MessageTemplate) => void };

export function TemplateRow({ template, onEdit }: Props) {
  const t = useTranslations('templates');
  const tc = useTranslations('common');
  const [pending, startTransition] = useTransition();
  const Icon = CHANNEL_ICON[template.channel];

  const handleDelete = () => {
    if (!window.confirm(t('deleteConfirm', { name: template.name }))) return;
    startTransition(async () => {
      const res = await deleteTemplateAction(template.id);
      if (res.ok) toast.success(t('toast.deleted'));
      else toast.error(t('toast.failed'));
    });
  };

  return (
    <li className="flex items-start gap-3 px-4 py-3 hover:bg-neutral-50/60">
      <span
        aria-hidden="true"
        className="size-9 rounded-lg bg-brand-gold-soft text-brand-gold-text flex items-center justify-center shrink-0"
      >
        <Icon className="size-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-neutral-900">{template.name}</p>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
            {t(`channels.${template.channel}`)}
          </span>
        </div>
        {template.subject && (
          <p className="text-xs text-neutral-600 mt-0.5 truncate">{template.subject}</p>
        )}
        <p className="text-xs text-neutral-700 mt-1 line-clamp-2 whitespace-pre-wrap">
          {template.body}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onEdit(template)}
          aria-label={`${tc('edit')} — ${template.name}`}
          className="size-8 rounded-md text-neutral-600 hover:bg-neutral-100 hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50 flex items-center justify-center transition"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          aria-label={`${tc('delete')} — ${template.name}`}
          className="size-8 rounded-md text-neutral-600 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-50 flex items-center justify-center transition"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
