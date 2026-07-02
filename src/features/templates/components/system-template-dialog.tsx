'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2, RotateCcw } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/shared/form-fields';

import { resetSystemEmailTemplateAction } from '../actions/reset-system-email-template';
import { updateSystemEmailTemplateAction } from '../actions/update-system-email-template';
import type { SystemEmailTemplateLocale } from '../domain/system-email-templates';
import type { SystemEmailTemplateSummary } from '../services/system-email-templates.service';
import { TEMPLATE_ACTION_INITIAL, type TemplateActionState } from '../types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: SystemEmailTemplateSummary | null;
  initialLocale: SystemEmailTemplateLocale;
};

export function SystemTemplateDialog({ open, onOpenChange, template, initialLocale }: Props) {
  const t = useTranslations('templates.automatic');
  const tc = useTranslations('common');
  const initialVersion = template?.versions[initialLocale];
  const [locale, setLocale] = useState<SystemEmailTemplateLocale>(initialLocale);
  const [state, formAction] = useActionState<TemplateActionState, FormData>(
    updateSystemEmailTemplateAction,
    TEMPLATE_ACTION_INITIAL,
  );
  const [resetPending, startReset] = useTransition();
  const [subject, setSubject] = useState(initialVersion?.subject ?? '');
  const [heading, setHeading] = useState(initialVersion?.heading ?? '');
  const [body, setBody] = useState(initialVersion?.body ?? '');
  const [ctaLabel, setCtaLabel] = useState(initialVersion?.ctaLabel ?? '');
  const [enabled, setEnabled] = useState(initialVersion?.isEnabled ?? true);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const version = template?.versions[locale];

  useEffect(() => {
    if (state.ok === true) {
      toast.success(t('saved'));
      onOpenChange(false);
    }
  }, [state, onOpenChange, t]);

  if (!template || !version) return null;
  const fieldErrors =
    state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};

  const insertVariable = (variable: string) => {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const next = `${body.slice(0, textarea.selectionStart)}{${variable}}${body.slice(textarea.selectionEnd)}`;
    setBody(next);
    requestAnimationFrame(() => {
      const cursor = textarea.selectionStart + variable.length + 2;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const selectLocale = (nextLocale: SystemEmailTemplateLocale) => {
    const nextVersion = template.versions[nextLocale];
    setLocale(nextLocale);
    setSubject(nextVersion.subject);
    setHeading(nextVersion.heading);
    setBody(nextVersion.body);
    setCtaLabel(nextVersion.ctaLabel);
    setEnabled(nextVersion.isEnabled);
  };

  const reset = () => {
    if (!window.confirm(t('resetConfirm'))) return;
    startReset(async () => {
      const result = await resetSystemEmailTemplateAction(template.key, locale);
      if (result.ok) {
        toast.success(t('resetDone'));
        onOpenChange(false);
      } else {
        toast.error(t('failed'));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('editTitle', { name: t(`names.${template.key}`) })}</DialogTitle>
        </DialogHeader>

        <div className="flex w-fit rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
          {(['he', 'en'] as const).map((language) => (
            <button
              key={language}
              type="button"
              onClick={() => selectLocale(language)}
              className={`h-8 rounded-md px-4 text-xs font-medium transition ${
                locale === language
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {t(`locales.${language}`)}
            </button>
          ))}
        </div>

        <form key={`${template.key}:${locale}`} action={formAction} className="space-y-5" noValidate>
          <input type="hidden" name="template_key" value={template.key} />
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="is_enabled" value={String(enabled)} />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <FormField label={t('fields.subject')} required error={fieldErrors.subject}>
                <Input
                  name="subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  maxLength={240}
                />
              </FormField>
              <FormField label={t('fields.heading')} required error={fieldErrors.heading}>
                <Input
                  name="heading"
                  value={heading}
                  onChange={(event) => setHeading(event.target.value)}
                  maxLength={240}
                />
              </FormField>
              <FormField label={t('fields.body')} required error={fieldErrors.body}>
                <Textarea
                  ref={bodyRef}
                  name="body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={9}
                  maxLength={6000}
                />
              </FormField>
              <FormField label={t('fields.cta')} required error={fieldErrors.cta_label}>
                <Input
                  name="cta_label"
                  value={ctaLabel}
                  onChange={(event) => setCtaLabel(event.target.value)}
                  maxLength={120}
                />
              </FormField>

              {template.variables.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs text-neutral-500">{t('variablesHint')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {template.variables.map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        onClick={() => insertVariable(variable)}
                        className="rounded-full border border-neutral-200 px-2 py-1 text-xs text-neutral-600 transition hover:border-brand-gold hover:bg-brand-gold-soft"
                      >
                        {`{${variable}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <label className="flex items-start gap-2 rounded-lg border border-neutral-200 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={template.critical}
                  onChange={(event) => setEnabled(event.target.checked)}
                  className="mt-0.5 size-4 accent-brand-gold"
                />
                <span>
                  <span className="block text-sm font-medium text-neutral-800">{t('sendEnabled')}</span>
                  <span className="block text-xs text-neutral-500">
                    {template.critical ? t('criticalHint') : t('sendEnabledHint')}
                  </span>
                </span>
              </label>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-neutral-600">{t('preview')}</p>
              <div
                dir={locale === 'he' ? 'rtl' : 'ltr'}
                className="overflow-hidden rounded-lg border border-neutral-200 bg-brand-gold-soft"
              >
                <div className="bg-brand-black px-5 py-5 text-center text-brand-gold">
                  <p className="text-[10px] tracking-[0.2em]">KAUFMAN</p>
                </div>
                <div className="bg-white px-5 py-6">
                  <p className="mb-3 text-base font-semibold text-neutral-950">{heading}</p>
                  <div className="whitespace-pre-wrap text-xs leading-6 text-neutral-600">{body}</div>
                  <div className="mt-5 inline-flex min-h-9 items-center rounded-full bg-brand-gold px-4 text-xs font-semibold text-brand-black">
                    {ctaLabel}
                  </div>
                </div>
                <div className="px-4 py-3 text-center text-[10px] text-neutral-500">
                  Kaufman Finance Group
                </div>
              </div>
              <p className="mt-2 truncate text-[11px] text-neutral-500">
                {t('subjectPreview')}: {subject}
              </p>
            </div>
          </div>

          {state.ok === false && (state.error === 'unknown' || state.error === 'unauthorized') && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t('failed')}
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={reset}
              disabled={!version.isCustomized || resetPending}
            >
              {resetPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              {t('reset')}
            </Button>
            <div className="flex gap-2">
              <SaveButton />
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tc('cancel')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  const t = useTranslations('templates.automatic');
  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-brand-gold font-semibold text-brand-black hover:bg-brand-gold-hover"
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {t('save')}
    </Button>
  );
}
