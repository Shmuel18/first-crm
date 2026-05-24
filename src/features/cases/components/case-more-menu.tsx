'use client';

import { useTransition } from 'react';

import { Archive, MoreVertical, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { toggleArchiveAction } from '../actions/toggle-archive';

type Props = {
  caseId: string;
  isArchived: boolean;
  canArchive: boolean;
  canRestore: boolean;
};

export function CaseMoreMenu({ caseId, isArchived, canArchive, canRestore }: Props) {
  const t = useTranslations('case.actionBar');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Offer only the action matching the case's current state, and only when the
  // user holds the matching permission. With no available action, the server
  // would reject anyway, so render nothing rather than an empty menu.
  const canToggle = isArchived ? canRestore : canArchive;
  if (!canToggle) return null;

  const onToggle = () => {
    if (isPending) return;
    startTransition(async () => {
      const result = await toggleArchiveAction(caseId, !isArchived);
      if (result.ok) {
        toast.success(t(isArchived ? 'restoreSuccess' : 'archiveSuccess'));
        router.refresh();
      } else {
        toast.error(t(result.error === 'unauthorized' ? 'archiveUnauthorized' : 'archiveError'));
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={t('actions.more')}
            className="relative flex size-8 items-center justify-center rounded-md text-neutral-600 transition hover:bg-white hover:text-[#A88840] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/50"
          >
            <MoreVertical className="size-3.5" aria-hidden="true" />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem onClick={onToggle} disabled={isPending}>
          {isArchived ? <RotateCcw /> : <Archive />}
          {t(isArchived ? 'actions.restore' : 'actions.archive')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
