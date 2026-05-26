import { redirect } from 'next/navigation';

import { getTranslations } from 'next-intl/server';

import { AuditLogTable } from '@/features/audit/components/audit-log-table';
import { listAuditEntries } from '@/features/audit/services/audit.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';

export default async function AuditLogSettingsPage() {
  if (!(await isCurrentUserAdmin())) redirect('/settings/profile');

  const t = await getTranslations('auditLog');
  const entries = await listAuditEntries(100);

  return (
    <div>
      <header className="mb-6">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="text-sm text-neutral-500 mt-0.5">{t('subtitle')}</p>
      </header>

      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
        <AuditLogTable entries={entries} />
      </div>
    </div>
  );
}
