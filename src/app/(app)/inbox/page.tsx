import { redirect } from 'next/navigation';

import { Sparkles } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { InboxPageContent } from '@/features/inbox/components/inbox-page-content';
import { countAttentionItems, listInboxItems } from '@/features/inbox/services/inbox.service';
import { getAiFeatureSettings } from '@/lib/ai/flags.server';
import { isAiPermissionInert } from '@/lib/ai/permission-visibility';
import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import type { InboxTab } from '@/features/inbox/types';

function parseTab(raw: string | string[] | undefined): InboxTab {
  return raw === 'all' || raw === 'handled' ? raw : 'attention';
}

/**
 * The smart-mail triage queue (ai-v2-spec.md §3.5). Gated on view_ai_inbox —
 * advisors without it still see case-linked rows elsewhere via RLS, but the
 * office-wide queue is a manager/secretary surface.
 */
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  // Permission AND flag: the nav item hides itself when email triage is off,
  // and this closes the direct-URL route so the page can't be reached either.
  if (!(await userHasPermission('view_ai_inbox'))) redirect('/cases');
  if (isAiPermissionInert('view_ai_inbox', await getAiFeatureSettings(await createClient()))) {
    redirect('/cases');
  }

  const tab = parseTab((await searchParams).tab);
  const [items, attentionCount, t] = await Promise.all([
    listInboxItems(tab),
    countAttentionItems(),
    getTranslations('inbox'),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-gold-soft px-3 py-1 text-sm font-medium text-brand-gold-text">
          <Sparkles className="size-4" aria-hidden="true" />
          {t('eyebrow')}
        </div>
        <h1 className="font-display text-3xl font-semibold text-neutral-950">{t('title')}</h1>
        <p className="mt-1 text-sm text-neutral-500">{t('subtitle')}</p>
      </header>
      <InboxPageContent items={items} tab={tab} attentionCount={attentionCount} />
    </div>
  );
}
