import { getTranslations } from 'next-intl/server';

import { ContactsManager } from '@/features/contacts/components/contacts-manager';
import { listProfessionalContacts } from '@/features/contacts/services/contacts.service';
import { userHasPermission } from '@/lib/auth/permissions';

export default async function ContactsSettingsPage() {
  const [contacts, canManage, t] = await Promise.all([
    listProfessionalContacts(),
    userHasPermission('manage_lookups'),
    getTranslations('contacts'),
  ]);

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="mt-0.5 text-sm text-neutral-500">{t('subtitle')}</p>
      </header>
      <ContactsManager contacts={contacts} canManage={canManage} />
    </div>
  );
}
