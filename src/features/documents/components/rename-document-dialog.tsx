'use client';

import { useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { callAction } from '@/lib/actions/call-action';

import { renameDocumentAction } from '../actions/rename-document';
import { documentDisplayName } from '../domain/document-name';
import { renameErrorKey } from '../domain/rename-error';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  caseId: string;
  fileName: string;
};

/**
 * Rename straight from a card, without opening the document first — the office
 * files a batch at a time and naming each one through the preview is four
 * clicks too many. Same action as the in-place editor in the preview, so both
 * paths rename Drive as well.
 */
export function RenameDocumentDialog({ open, onOpenChange, documentId, caseId, fileName }: Props) {
  const t = useTranslations('documents.rename');
  const [value, setValue] = useState(() => documentDisplayName(fileName));
  const [pending, startTransition] = useTransition();

  // Re-seed when the dialog is reused for a different document (render-phase
  // state sync — a shared dialog otherwise keeps the previous file's name).
  const [seed, setSeed] = useState(fileName);
  if (seed !== fileName) {
    setSeed(fileName);
    setValue(documentDisplayName(fileName));
  }

  const save = (): void => {
    const typed = value.trim();
    if (!typed) return;
    startTransition(async () => {
      const res = await callAction(() => renameDocumentAction({ documentId, caseId, name: typed }));
      if (!res.ok) {
        toast.error(t(renameErrorKey(res.error)));
        return;
      }
      toast.success(t('renamed'));
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('action')}</DialogTitle>
        </DialogHeader>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          disabled={pending}
          maxLength={200}
          aria-label={t('action')}
        />
        <DialogFooter>
          <Button
            type="button"
            onClick={save}
            disabled={pending || !value.trim()}
            className="bg-brand-gold font-semibold text-brand-black hover:bg-brand-gold-hover"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : t('save')}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
