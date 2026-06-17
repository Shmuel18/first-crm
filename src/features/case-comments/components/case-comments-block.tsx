import { MessagesSquare } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { CaseBlock } from '@/features/cases/components/case-block';
import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';

import {
  getCommenterName,
  listCaseComments,
  listMentionableProfiles,
} from '../services/case-comments.service';
import { CaseCommentsThread } from './case-comments-thread';

type Props = { caseId: string };

/**
 * Internal team comment thread on the case page. Visible to anyone who can view
 * the case (no extra permission); RLS scopes the rows to the same set. Manager
 * (is_admin) may delete others' comments — passed down as `canModerate`.
 */
export async function CaseCommentsBlock({ caseId }: Props) {
  const t = await getTranslations('caseComments');
  const locale = parseLocale(await getLocale());

  const [user, canModerate, members] = await Promise.all([
    getCurrentUser(),
    isCurrentUserAdmin(),
    listMentionableProfiles(caseId),
  ]);
  if (!user) return null;

  let comments: Awaited<ReturnType<typeof listCaseComments>> = [];
  try {
    comments = await listCaseComments(asCaseId(caseId));
  } catch (err) {
    const summary = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[CaseCommentsBlock] data fetch failed — ${summary}`);
  }

  const currentUserName = (await getCommenterName(user.id)) || t('you');

  return (
    <CaseBlock
      title={t('blockTitle')}
      icon={<MessagesSquare />}
      fullWidth
      blockKey="comments"
      rightSlot={
        comments.length > 0 ? (
          <span className="text-xs font-medium text-neutral-600 tabular-nums">
            {comments.length}
          </span>
        ) : null
      }
    >
      <CaseCommentsThread
        caseId={caseId}
        currentUserId={user.id}
        currentUserName={currentUserName}
        canModerate={canModerate}
        locale={locale}
        members={members}
        initialComments={comments}
      />
    </CaseBlock>
  );
}
