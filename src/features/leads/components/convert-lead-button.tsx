'use client';

import { useState, useTransition } from 'react';

import { ArrowLeftRight, Loader2 } from 'lucide-react';
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

import { convertLeadAction } from '../actions/convert-lead';

type Props = { leadId: string };

export function ConvertLeadButton({ leadId }: Props) {
  const t = useTranslations('leads');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirmConvert = () =>
    startTransition(async () => {
      setOpen(false);
      const res = await convertLeadAction(leadId);
      // On success the action redirects to the new case; only failures return.
      if (res.error === 'already_converted') {
        toast.error(t('toast.alreadyConverted'));
      } else {
        toast.error(t('toast.convertFailed'));
      }
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className="inline-flex items-center gap-1 text-xs font-medium text-[#A88840] hover:text-[#0A0A0A] disabled:opacity-60 transition"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ArrowLeftRight className="size-3.5" />
        )}
        {t('convert')}
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>{t('convertTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('convertBody')}</AlertDialogDescription>
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
                  onClick={confirmConvert}
                  disabled={pending}
                  className="h-10 bg-[#C9A961] hover:bg-[#B8985A] text-[#0A0A0A]"
                >
                  {t('convert')}
                </Button>
              }
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
