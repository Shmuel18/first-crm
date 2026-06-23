'use client';

import { useState, type ReactNode } from 'react';

import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/ui/rich-text-editor';

type EmailLocale = 'he' | 'en';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Draft the dialog opens with; the advisor edits freely before sending.
   *  Plain text (newlines preserved) — converted to HTML to seed the editor. */
  initialSubject: string;
  initialBody: string;
  pending: boolean;
  /** Receives the edited subject, the body as sanitizable HTML, and the chosen
   *  email language (sets the branded shell's direction + footer language). */
  onSend: (subject: string, bodyHtml: string, locale: EmailLocale) => void;
  /** Optional extra fields rendered below the body (e.g. an attachments picker).
   *  Attachment state lives in the parent, which reads it in its own onSend. */
  extraFields?: ReactNode;
};

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Seed the rich editor from a plain-text draft, preserving line breaks. */
function plainTextToHtml(text: string): string {
  if (!text.trim()) return '';
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** True when the editor HTML carries no visible text (e.g. an empty <p>). */
function isHtmlEmpty(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '';
}

/**
 * Review-and-edit step for every advisor-initiated client email: shows the
 * prefilled subject + a rich-text body (bold, lists, links…), an email-language
 * toggle, and only then hands it to the feature's send action (which sanitizes
 * the HTML into the branded layout). Field state resets to the incoming draft
 * each time it opens, so a reopened dialog reflects the current context.
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
  const uiLocale: EmailLocale = useLocale() === 'en' ? 'en' : 'he';
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(() => plainTextToHtml(initialBody));
  const [locale, setLocale] = useState<EmailLocale>(uiLocale);

  // Re-seed the fields when a new draft comes in (render-phase state sync —
  // the React-sanctioned alternative to a useEffect on props).
  const [draftRef, setDraftRef] = useState({ initialSubject, initialBody });
  if (draftRef.initialSubject !== initialSubject || draftRef.initialBody !== initialBody) {
    setDraftRef({ initialSubject, initialBody });
    setSubject(initialSubject);
    setBody(plainTextToHtml(initialBody));
    setLocale(uiLocale);
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
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-600">{t('bodyLabel')}</span>
              <LanguageToggle
                value={locale}
                onChange={setLocale}
                labels={{ he: t('langHe'), en: t('langEn') }}
                ariaLabel={t('languageLabel')}
              />
            </div>
            <RichTextEditor
              value={body}
              onChange={setBody}
              enableLink
              dir={locale === 'he' ? 'rtl' : 'ltr'}
              minRows={9}
              placeholder={t('bodyPlaceholder')}
            />
          </div>
          {extraFields}
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={pending || !subject.trim() || isHtmlEmpty(body)}
            onClick={() => onSend(subject, body, locale)}
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

function LanguageToggle({
  value,
  onChange,
  labels,
  ariaLabel,
}: {
  value: EmailLocale;
  onChange: (next: EmailLocale) => void;
  labels: { he: string; en: string };
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex overflow-hidden rounded-md border border-neutral-200 text-xs"
    >
      {(['he', 'en'] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          aria-pressed={value === opt}
          onClick={() => onChange(opt)}
          className={`px-2.5 py-1 font-medium transition ${
            value === opt
              ? 'bg-brand-black text-white'
              : 'bg-white text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}
