'use client';

import { useState, useTransition } from 'react';

import { Trash2, UserCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

import { removeBorrowerFromCaseAction } from '../actions/remove-borrower-from-case';

type Props = {
  caseId: string;
  borrowerId: string;
  fullName: string;
  /** Already-translated role label for the sub-header. */
  roleLabel: string;
  relatedToSellers: boolean;
  /** Data-flagged primary — removal locked (a case keeps its primary). */
  isPrimary: boolean;
  /** First card in the list (covers data with no primary at all). */
  isFirst: boolean;
  /** Sole borrower on the case — removal locked (a case needs ≥1 borrower). */
  isOnly: boolean;
};

/**
 * Identity header + remove-confirmation for a borrower card. Split out of
 * CaseBorrowerCard so the card stays under the component size limit; owns its
 * own remove transition + confirm-dialog state (a self-contained concern).
 */
export function CaseBorrowerCardHeader({
  caseId,
  borrowerId,
  fullName,
  roleLabel,
  relatedToSellers,
  isPrimary,
  isFirst,
  isOnly,
}: Props) {
  const t = useTranslations('case.borrower');
  const tc = useTranslations('common');
  const tRemove = useTranslations('case.borrower.remove');
  const router = useRouter();
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [isRemoving, startRemove] = useTransition();

  const handleRemove = () => {
    startRemove(async () => {
      const result = await removeBorrowerFromCaseAction(caseId, borrowerId);
      if (result.ok) {
        toast.success(tRemove('success', { name: fullName }));
        setConfirmRemoveOpen(false);
        router.refresh();
      } else {
        toast.error(tRemove(`errors.${result.error}`));
      }
    });
  };

  return (
    <>
      <div className="flex items-start justify-between pb-3 border-b border-neutral-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-9 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
            <UserCircle2 className="size-5 text-neutral-500" />
          </span>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-neutral-900 text-sm truncate">{fullName}</span>
            <span className="text-xs text-neutral-500 flex items-center gap-1.5 flex-wrap">
              <span>{roleLabel}</span>
              {relatedToSellers && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-medium">
                  {t('relatedToSellers')}
                </span>
              )}
            </span>
          </div>
        </div>
        {/* Removal hidden for the primary / first / sole borrower; the server
            action enforces the same guards as defense-in-depth. */}
        {!isPrimary && !isFirst && !isOnly && (
          <Tooltip content={tRemove('action')}>
            <button
              type="button"
              aria-label={tRemove('action')}
              onClick={() => setConfirmRemoveOpen(true)}
              disabled={isRemoving}
              className="shrink-0 inline-flex items-center justify-center size-8 rounded-md text-neutral-500 hover:text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      </div>

      <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>{tRemove('dialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {tRemove('dialog.description', { name: fullName })}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <Button variant="destructive" onClick={handleRemove} disabled={isRemoving}>
              {tRemove('dialog.confirm')}
            </Button>
            <AlertDialogCancel render={<Button variant="outline">{tc('cancel')}</Button>} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
