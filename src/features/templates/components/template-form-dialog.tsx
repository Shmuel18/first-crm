'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';

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
import { FormField, NativeSelect } from '@/components/shared/form-fields';

import { createTemplateAction } from '../actions/create-template';
import { updateTemplateAction } from '../actions/update-template';
import {
  TEMPLATE_ACTION_INITIAL,
  TEMPLATE_CHANNELS,
  TEMPLATE_VARIABLES,
  type MessageTemplate,
  type TemplateActionState,
} from '../types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  template: MessageTemplate | null;
};

export function TemplateFormDialog({ open, onOpenChange, mode, template }: Props) {
  const t = useTranslations('templates');
  const tc = useTranslations('common');
  const action = mode === 'create' ? createTemplateAction : updateTemplateAction;
  const [state, formAction] = useActionState<TemplateActionState, FormData>(
    action,
    TEMPLATE_ACTION_INITIAL,
  );
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state.ok === true) onOpenChange(false);
  }, [state, onOpenChange]);

  const fieldErrors =
    state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};

  // Insert a {variable} token at the cursor of the (uncontrolled) textarea.
  const insertVariable = (variable: string) => {
    const ta = bodyRef.current;
    if (!ta) return;
    ta.focus();
    ta.setRangeText(`{${variable}}`, ta.selectionStart, ta.selectionEnd, 'end');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t('form.create') : t('form.edit')}</DialogTitle>
        </DialogHeader>

        {/* Keyed by template id so switching template/new resets the uncontrolled fields. */}
        <form key={template?.id ?? 'new'} action={formAction} className="space-y-4" noValidate>
          {mode === 'edit' && template && (
            <input type="hidden" name="template_id" value={template.id} />
          )}

          <FormField label={t('fields.name')} required error={fieldErrors.name}>
            <Input
              name="name"
              defaultValue={template?.name ?? ''}
              placeholder={t('form.namePlaceholder')}
              autoFocus
              maxLength={120}
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('fields.channel')} error={fieldErrors.channel}>
              <NativeSelect name="channel" defaultValue={template?.channel ?? 'whatsapp'}>
                {TEMPLATE_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {t(`channels.${c}`)}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            <FormField label={t('fields.subject')} error={fieldErrors.subject}>
              <Input name="subject" defaultValue={template?.subject ?? ''} maxLength={200} />
            </FormField>
          </div>

          <FormField label={t('fields.body')} required error={fieldErrors.body}>
            <Textarea
              ref={bodyRef}
              name="body"
              defaultValue={template?.body ?? ''}
              placeholder={t('form.bodyPlaceholder')}
              rows={6}
              maxLength={4000}
            />
          </FormField>

          <div>
            <p className="text-xs text-neutral-500 mb-1.5">{t('variablesHint')}</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="inline-flex items-center px-2 py-1 rounded-full border border-neutral-200 text-xs text-neutral-600 hover:border-brand-gold hover:bg-brand-gold-soft transition"
                >
                  {t(`variables.${v}`)}
                </button>
              ))}
            </div>
          </div>

          {state.ok === false && (state.error === 'unknown' || state.error === 'unauthorized') && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {t('toast.failed')}
            </div>
          )}

          <DialogFooter>
            <SubmitButton mode={mode} />
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubmitButton({ mode }: { mode: 'create' | 'edit' }) {
  const { pending } = useFormStatus();
  const t = useTranslations('templates.submit');
  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-semibold"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : mode === 'create' ? t('create') : t('update')}
    </Button>
  );
}
