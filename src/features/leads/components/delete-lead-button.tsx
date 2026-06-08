'use client';

import { useState, useTransition } from 'react';

import { Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

import { deleteLeadAction } from '../actions/delete-lead';

type Props = { leadId: string; leadName: string };

export function DeleteLeadButton({ leadId, leadName }: Props) {
  const t = useTranslations('leads');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirmDelete = () =>
    startTransition(async () => {
      const res = await deleteLeadAction(leadId);
      setOpen(false);
      if (res.ok) toast.success(t('toast.deleted'));
      else toast.error(t('toast.deleteFailed'));
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-60 transition"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
        {t('delete')}
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('deleteBody', { name: leadName })}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel
              render={
                <Button type="button" variant="ghost" className="h-10">
                  {tc('cancel')}
                </Button>
              }
            />
            <AlertDialogAction
              render={
                <Button
                  type="button"
                  onClick={confirmDelete}
                  disabled={pending}
                  className="h-10 bg-red-600 hover:bg-red-700 text-white"
                >
                  {t('delete')}
                </Button>
              }
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
