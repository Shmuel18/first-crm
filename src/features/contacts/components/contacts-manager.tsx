'use client';

import { useState } from 'react';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CONTACT_KINDS, type ContactKind, type ProfessionalContact } from '../types';

import { ContactFormDialog } from './contact-form-dialog';
import { ContactRow } from './contact-row';

type Props = { contacts: ReadonlyArray<ProfessionalContact>; canManage: boolean };

/** Settings → the office's appraisers, lawyers and insurance agents, by kind. */
export function ContactsManager({ contacts, canManage }: Props) {
  const t = useTranslations('contacts');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProfessionalContact | null>(null);
  const [newKind, setNewKind] = useState<ContactKind>('appraiser');

  const openNew = (kind: ContactKind): void => {
    setEditing(null);
    setNewKind(kind);
    setOpen(true);
  };
  const openEdit = (contact: ProfessionalContact): void => {
    setEditing(contact);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      {CONTACT_KINDS.map((kind) => {
        const list = contacts.filter((c) => c.kind === kind);
        return (
          <section key={kind} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">
                {t(`kindsPlural.${kind}`)} <span className="text-neutral-400">({list.length})</span>
              </h3>
              {canManage && (
                <button
                  type="button"
                  onClick={() => openNew(kind)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 px-2.5 text-xs text-neutral-700 transition hover:border-brand-gold-text hover:text-brand-gold-text"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  {t('add')}
                </button>
              )}
            </div>
            {list.length === 0 ? (
              <p className="rounded-lg border border-dashed border-neutral-200 px-4 py-6 text-center text-xs text-neutral-500">
                {t('empty')}
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                {list.map((c) => (
                  <ContactRow key={c.id} contact={c} canManage={canManage} onEdit={openEdit} />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <ContactFormDialog
        key={editing?.id ?? `new-${newKind}-${String(open)}`}
        open={open}
        onOpenChange={setOpen}
        contact={editing}
        defaultKind={newKind}
      />
    </div>
  );
}
