'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { History, Loader2 } from 'lucide-react';
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

import { restoreBackupAction } from '../actions/restore-backup';

type Props = { fileId: string; fileName: string };

export function BackupRestoreButton({ fileId, fileName }: Props) {
  const t = useTranslations('settings.backup');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirmRestore = () =>
    startTransition(async () => {
      setOpen(false);
      const res = await restoreBackupAction(fileId);
      if (res.ok) {
        toast.success(t('toast.restoreDone', { count: res.restored }));
        router.refresh();
      } else if (res.error === 'invalid_file') {
        toast.error(t('toast.restoreInvalid'));
      } else if (res.error === 'not_connected') {
        toast.error(t('toast.notConnected'));
      } else {
        toast.error(t('toast.restoreFailed'));
      }
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        aria-busy={pending}
        className="inline-flex items-center gap-1 text-xs text-neutral-700 hover:text-brand-gold-text disabled:opacity-60 transition shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <History className="size-3.5" aria-hidden="true" />
        )}
        {t('restore')}
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>{t('restoreTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('restoreConfirm', { name: fileName })}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel
              render={
                <Button type="button" variant="ghost" className="h-10">
                  {tCommon('cancel')}
                </Button>
              }
            />
            <AlertDialogAction
              render={
                <Button
                  type="button"
                  onClick={confirmRestore}
                  disabled={pending}
                  className="h-10 bg-brand-gold hover:bg-brand-gold-dark text-brand-black"
                >
                  {t('restore')}
                </Button>
              }
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
