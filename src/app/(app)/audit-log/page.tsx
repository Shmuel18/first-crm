import { redirect } from 'next/navigation';

import { ScrollText } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { PageHeader } from '@/components/shared/page-header';
import { AuditLogTable } from '@/features/audit/components/audit-log-table';
import { listAuditEntries } from '@/features/audit/services/audit.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';

export default async function AuditLogPage() {
  if (!(await isCurrentUserAdmin())) redirect('/cases');

  const t = await getTranslations('auditLog');
  const entries = await listAuditEntries(100);

  return (
    <div className="space-y-5">
      <PageHeader icon={<ScrollText />} title={t('title')} subtitle={t('subtitle')} />
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
        <AuditLogTable entries={entries} />
      </div>
    </div>
  );
}
