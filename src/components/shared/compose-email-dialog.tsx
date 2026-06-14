'use client';

import { useState, type ReactNode } from 'react';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Draft the dialog opens with; the advisor edits freely before sending. */
  initialSubject: string;
  initialBody: string;
  pending: boolean;
  onSend: (subject: string, body: string) => void;
  /** Optional extra fields rendered below the body (e.g. an attachments picker).
   *  Attachment state lives in the parent, which reads it in its own onSend. */
  extraFields?: ReactNode;
};

/**
 * Review-and-edit step for every advisor-initiated client email: shows the
 * prefilled subject + body, lets the advisor adjust the text, and only then
 * hands it to the feature's send action (which wraps it in the branded
 * layout). Field state resets to the incoming draft each time it opens, so a
 * reopened dialog reflects the current context instead of a stale edit.
 */
export function ComposeEmailDialog({
  open,
  onOpenChange,
  title,
  initialSubject,
  initialBody,
  pending,
  onSend,
  extraFields,
}: Props) {
  const t = useTranslations('composeEmail');
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);

  // Re-seed the fields when a new draft comes in (render-phase state sync —
  // the React-sanctioned alternative to a useEffect on props).
  const [draftRef, setDraftRef] = useState({ initialSubject, initialBody });
  if (draftRef.initialSubject !== initialSubject || draftRef.initialBody !== initialBody) {
    setDraftRef({ initialSubject, initialBody });
    setSubject(initialSubject);
    setBody(initialBody);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-neutral-600">{t('hint')}</p>
        <div className="space-y-3">
          <div>
            <label
              htmlFor="compose-email-subject"
              className="mb-1 block text-xs font-medium text-neutral-600"
            >
              {t('subjectLabel')}
            </label>
            <Input
              id="compose-email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
            />
          </div>
          <div>
            <label
              htmlFor="compose-email-body"
              className="mb-1 block text-xs font-medium text-neutral-600"
            >
              {t('bodyLabel')}
            </label>
            <Textarea
              id="compose-email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              maxLength={5000}
              className="text-sm leading-relaxed"
            />
          </div>
          {extraFields}
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={pending || !subject.trim() || !body.trim()}
            onClick={() => onSend(subject, body)}
            className="bg-brand-gold font-semibold text-brand-black hover:bg-brand-gold-hover"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : t('send')}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
