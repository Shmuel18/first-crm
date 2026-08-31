'use client';

import { useState } from 'react';

import { Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { callAction } from '@/lib/actions/call-action';
import { cn } from '@/lib/utils';

import { saveAgreementTemplateAction } from '../actions/save-agreement-template';
import { DEFAULT_AGREEMENT_TEXT } from '../domain/agreement-text';

import type { AgreementDocument, AgreementLanguage } from '../domain/agreement-text';

type Props = {
  initial: Record<AgreementLanguage, AgreementDocument>;
};

const LANGUAGES: AgreementLanguage[] = ['he', 'en'];
/** Placeholders the office may use; listed in the UI so they are discoverable. */
const PLACEHOLDERS = [
  'clientName',
  'clientNationalId',
  'officeName',
  'officeRepresentative',
  'officeCrmDomain',
  'feePercent',
  'feeAdvance',
  'feeEstimateSentence',
];

/**
 * Settings → Engagement agreement. Edits the wording per language; each save
 * writes only the language being edited. Already-sent agreements keep the text
 * they were sent with (each row snapshots it), so editing here is safe.
 */
export function AgreementTemplateEditor({ initial }: Props) {
  const t = useTranslations('agreements.template');
  const [language, setLanguage] = useState<AgreementLanguage>('he');
  const [docs, setDocs] = useState<Record<AgreementLanguage, AgreementDocument>>(initial);
  const [pending, setPending] = useState(false);

  const doc = docs[language];
  const rtl = language === 'he';

  const update = (next: AgreementDocument): void => setDocs((d) => ({ ...d, [language]: next }));

  const save = async (): Promise<void> => {
    if (pending) return;
    setPending(true);
    const res = await callAction(() => saveAgreementTemplateAction({ language, document: doc }));
    setPending(false);
    if (!res.ok) {
      toast.error(t(`errors.${res.error}`));
      return;
    }
    toast.success(t('saved'));
  };

  const resetToDefault = (): void => {
    update(structuredClone(DEFAULT_AGREEMENT_TEXT[language]));
    toast.info(t('resetHint'));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border border-neutral-200">
          {LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLanguage(l)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition',
                language === l
                  ? 'bg-brand-gold text-brand-black'
                  : 'bg-white text-neutral-600 hover:bg-neutral-50',
              )}
            >
              {t(`languages.${l}`)}
            </button>
          ))}
        </div>
        <div className="ms-auto flex items-center gap-2">
          <button
            type="button"
            onClick={resetToDefault}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {t('reset')}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 text-sm font-bold text-brand-black transition hover:bg-brand-gold-hover disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            {t('save')}
          </button>
        </div>
      </div>

      <p className="rounded-lg bg-brand-gold-soft px-3 py-2 text-xs leading-5 text-neutral-700">
        {t('placeholdersHelp')}{' '}
        {PLACEHOLDERS.map((p) => (
          <code key={p} className="mx-0.5 rounded bg-white/70 px-1 py-0.5 font-mono text-[11px]">
            {`{{${p}}}`}
          </code>
        ))}
      </p>

      <div className="grid gap-1.5">
        <Label htmlFor="agreement-title">{t('docTitle')}</Label>
        <Input
          id="agreement-title"
          dir={rtl ? 'rtl' : 'ltr'}
          value={doc.title}
          onChange={(e) => update({ ...doc, title: e.target.value })}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="agreement-preamble">{t('preamble')}</Label>
        <Textarea
          id="agreement-preamble"
          dir={rtl ? 'rtl' : 'ltr'}
          rows={3}
          value={doc.preamble}
          onChange={(e) => update({ ...doc, preamble: e.target.value })}
        />
      </div>

      {doc.sections.map((section, si) => (
        <fieldset key={si} className="rounded-xl border border-neutral-200 p-4">
          <legend className="px-2 text-xs font-semibold text-brand-gold-text">
            {t('section', { number: si + 1 })}
          </legend>
          <div className="grid gap-3">
            <div className="flex items-end gap-2">
              <div className="grid flex-1 gap-1.5">
                <Label htmlFor={`sec-title-${si}`}>{t('sectionTitle')}</Label>
                <Input
                  id={`sec-title-${si}`}
                  dir={rtl ? 'rtl' : 'ltr'}
                  value={section.title}
                  onChange={(e) => {
                    const sections = [...doc.sections];
                    sections[si] = { ...section, title: e.target.value };
                    update({ ...doc, sections });
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  update({ ...doc, sections: doc.sections.filter((_, i) => i !== si) })
                }
                disabled={doc.sections.length <= 1}
                aria-label={t('removeSection')}
                className="rounded-lg border border-neutral-200 p-2 text-neutral-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>

            {section.paragraphs.map((p, pi) => (
              <div key={pi} className="flex items-start gap-2">
                <Textarea
                  dir={rtl ? 'rtl' : 'ltr'}
                  rows={3}
                  className="flex-1"
                  aria-label={t('paragraph', { number: pi + 1 })}
                  value={p}
                  onChange={(e) => {
                    const paragraphs = [...section.paragraphs];
                    paragraphs[pi] = e.target.value;
                    const sections = [...doc.sections];
                    sections[si] = { ...section, paragraphs };
                    update({ ...doc, sections });
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const paragraphs = section.paragraphs.filter((_, i) => i !== pi);
                    const sections = [...doc.sections];
                    sections[si] = { ...section, paragraphs };
                    update({ ...doc, sections });
                  }}
                  disabled={section.paragraphs.length <= 1}
                  aria-label={t('removeParagraph')}
                  className="mt-1 rounded-lg border border-neutral-200 p-2 text-neutral-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                const sections = [...doc.sections];
                sections[si] = { ...section, paragraphs: [...section.paragraphs, ''] };
                update({ ...doc, sections });
              }}
              className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-brand-gold-text transition hover:underline"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              {t('addParagraph')}
            </button>
          </div>
        </fieldset>
      ))}

      <button
        type="button"
        onClick={() =>
          update({ ...doc, sections: [...doc.sections, { title: '', paragraphs: [''] }] })
        }
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
      >
        <Plus className="size-4" aria-hidden="true" />
        {t('addSection')}
      </button>
    </div>
  );
}
