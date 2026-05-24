'use client';

import { useState, useTransition } from 'react';

import { Loader2, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { sendDocumentRequestAction } from '../actions/send-document-request';

export function SendDocRequestButton({ caseId, title }: { caseId: string; title: string }) {
  const t = useTranslations('documents.request');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const send = () => {
    startTransition(async () => {
      const res = await sendDocumentRequestAction(caseId);
      if (res.ok) {
        toast.success(t('sent'));
        setOpen(false);
        return;
      }
      const key =
        res.error === 'no_email'
          ? 'noEmail'
          : res.error === 'not_configured'
            ? 'notConfigured'
            : res.error === 'unauthorized'
              ? 'unauthorized'
              : 'failed';
      toast.error(t(key));
      if (res.error !== 'unknown') setOpen(false);
    });
  };

  return (
    <>
      <button
        type="button"
        aria-label={title}
        onClick={() => setOpen(true)}
        className="flex size-8 items-center justify-center rounded-md text-neutral-700 transition hover:bg-white hover:text-[#A88840] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/50"
      >
        <MessageSquare className="size-3.5" aria-hidden="true" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-600">{t('confirm')}</p>
          <DialogFooter>
            <Button
              type="button"
              disabled={isPending}
              onClick={send}
              className="bg-[#C9A961] font-semibold text-[#0A0A0A] hover:bg-[#E8D5A2]"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : t('send')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
