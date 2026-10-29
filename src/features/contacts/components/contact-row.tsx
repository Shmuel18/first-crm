'use client';

import { useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Mail, MessageCircle, Pencil, Phone, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { buildWhatsAppLink } from '@/features/borrowers/domain/contact-links';
import { callAction } from '@/lib/actions/call-action';

import { deleteContactAction } from '../actions/delete-contact';
import type { ProfessionalContact } from '../types';

type Props = {
  contact: ProfessionalContact;
  canManage: boolean;
  onEdit: (contact: ProfessionalContact) => void;
};

/** One professional in the Settings list: name, quick contact links, edit / delete. */
export function ContactRow({ contact, canManage, onEdit }: Props) {
  const t = useTranslations('contacts');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const whatsapp = buildWhatsAppLink(contact.whatsapp ?? contact.phone);

  const remove = (): void => {
    if (!window.confirm(t('confirmDelete', { name: contact.name }))) return;
    startTransition(async () => {
      const res = await callAction(() => deleteContactAction(contact.id));
      if (res.ok) router.refresh();
      else toast.error(t('saveFailed'));
    });
  };

  const linkClass =
    'inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-brand-gold-text';
  const iconButton = 'rounded p-1.5 text-neutral-500 transition';

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
      <span className="min-w-32 flex-1 font-medium text-neutral-900">
        {contact.name}
        {contact.company && (
          <span className="ms-2 text-xs font-normal text-neutral-500">{contact.company}</span>
        )}
      </span>
      {contact.phone && (
        <a href={`tel:${contact.phone}`} dir="ltr" className={linkClass}>
          <Phone className="size-3.5" aria-hidden="true" />
          {contact.phone}
        </a>
      )}
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('fields.whatsapp')}
          className="text-emerald-600 hover:text-emerald-700"
        >
          <MessageCircle className="size-4" aria-hidden="true" />
        </a>
      )}
      {contact.email && (
        <a href={`mailto:${contact.email}`} dir="ltr" className={linkClass}>
          <Mail className="size-3.5" aria-hidden="true" />
          {contact.email}
        </a>
      )}
      {canManage && (
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(contact)}
            aria-label={t('form.edit')}
            className={`${iconButton} hover:bg-neutral-100 hover:text-neutral-900`}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            aria-label={t('delete')}
            className={`${iconButton} hover:bg-red-50 hover:text-red-600`}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      )}
    </li>
  );
}
