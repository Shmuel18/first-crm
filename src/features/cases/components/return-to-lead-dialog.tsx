'use client';

import { useTransition } from 'react';

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
import { callAction } from '@/lib/actions/call-action';

import { returnCaseToLeadAction } from '../actions/return-case-to-lead';

type Props = {
  caseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Confirms "return to leads" and lands on the leads tab where the lead now waits. */
export function ReturnToLeadDialog({ caseId, open, onOpenChange }: Props) {
  const t = useTranslations('case.actionBar.returnToLead');
  const tc = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onConfirm = (): void => {
    startTransition(async () => {
      const result = await callAction(() => returnCaseToLeadAction(caseId));
      if (result.ok) {
        toast.success(t('success'));
        router.push('/cases?view=leads');
      } else {
        toast.error(t(result.error === 'unauthorized' ? 'unauthorized' : 'error'));
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>{t('title')}</AlertDialogTitle>
        <AlertDialogDescription>{t('description')}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel
            render={
              <Button onClick={onConfirm} disabled={isPending}>
                {t('confirm')}
              </Button>
            }
          />
          <AlertDialogCancel render={<Button variant="outline">{tc('cancel')}</Button>} />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
