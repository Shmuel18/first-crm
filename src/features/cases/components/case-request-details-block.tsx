'use client';

import { useRef, useState } from 'react';

import dynamic from 'next/dynamic';

import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { updateCaseFieldAction } from '../actions/update-case-field';

import { CaseBlock } from './case-block';

// Lazy-load TipTap (~370KB) — same pattern as the draft block. Idle
// until the user actually opens this block.
const RichTextEditor = dynamic(
  () => import('@/components/ui/rich-text-editor').then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-400"
        style={{ minHeight: '15rem' }}
      />
    ),
  },
);

type Props = {
  caseId: string;
  initialHtml: string | null;
  /** When false, render the request details read-only (no editor toolbar). */
  canEdit?: boolean;
};

/**
 * Inline-editable rich-text block for cases.request_details on the case
 * detail page. Save-on-blur, mirroring the short-note pattern — no
 * explicit save button.
 */
export function CaseRequestDetailsBlock({ caseId, initialHtml, canEdit = true }: Props) {
  const t = useTranslations('case');
  const tForm = useTranslations('case.form.fields');
  const tc = useTranslations('common');

  const [html, setHtml] = useState<string>(initialHtml ?? '');
  const [savedHtml, setSavedHtml] = useState<string>(initialHtml ?? '');
  const savedHtmlRef = useRef(savedHtml);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef<string | null>(null);

  const [initialRef, setInitialRef] = useState<string>(initialHtml ?? '');
  if ((initialHtml ?? '') !== initialRef) {
    const nextInitial = initialHtml ?? '';
    setInitialRef(nextInitial);
    setHtml(nextInitial);
    setSavedHtml(nextInitial);
  }

  const handleBlur = async (next: string): Promise<void> => {
    // TipTap returns "<p></p>" for an empty editor — treat that as null
    // so the empty state and DB shape stay consistent with the rest of
    // the schema (cases.request_details is nullable).
    const normalised = next === '<p></p>' ? '' : next;
    if (savedHtmlRef.current !== savedHtml) {
      savedHtmlRef.current = savedHtml;
      pendingSaveRef.current = null;
    }
    if (normalised === savedHtmlRef.current) return;

    pendingSaveRef.current = normalised;
    if (isSavingRef.current) return;

    isSavingRef.current = true;
    while (pendingSaveRef.current !== null) {
      const nextHtml = pendingSaveRef.current;
      pendingSaveRef.current = null;

      const previousHtml = savedHtmlRef.current;
      if (nextHtml === previousHtml) continue;

      const result = await updateCaseFieldAction(
        caseId,
        'request_details',
        nextHtml || null,
        previousHtml === '' ? null : previousHtml,
      );
      if (result.ok) {
        savedHtmlRef.current = nextHtml;
        setSavedHtml(nextHtml);
        continue;
      }

      pendingSaveRef.current = null;
      setHtml(previousHtml);
      toast.error(result.error === 'conflict' ? tc('changedElsewhere') : tc('saveFailed'));
      break;
    }
    isSavingRef.current = false;
  };

  return (
    <CaseBlock title={t('blocks.requestDetails')} icon={<FileText />} fullWidth blockKey="requestDetails">
      <RichTextEditor
        value={html}
        onChange={setHtml}
        onBlur={handleBlur}
        placeholder={tForm('requestDetailsPlaceholder')}
        minRows={8}
        editable={canEdit}
      />
    </CaseBlock>
  );
}
