import { redirect } from 'next/navigation';

import { MessageSquare } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { PageHeader } from '@/components/shared/page-header';
import { TemplatesManager } from '@/features/templates/components/templates-manager';
import { listMessageTemplates } from '@/features/templates/services/templates.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';

export default async function TemplatesPage() {
  if (!(await isCurrentUserAdmin())) redirect('/cases');

  const t = await getTranslations('templates');
  const templates = await listMessageTemplates();

  return (
    <div className="space-y-5">
      <PageHeader icon={<MessageSquare />} title={t('title')} subtitle={t('subtitle')} />
      <TemplatesManager templates={templates} />
    </div>
  );
}
