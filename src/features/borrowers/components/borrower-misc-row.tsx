'use client';

import { useMemo } from 'react';

import { useTranslations } from 'next-intl';

import { isSeniorAge } from '../domain/age';

import type { EditableBorrowerField } from '../actions/update-borrower-field';

import {
  CompactNumber,
  CompactReadonly,
  CompactSelect,
} from './borrower-compact-fields';
import { EditableField } from './editable-field';

import type { BorrowerRow } from '../types';

type SaveFieldResult = { ok: true } | { ok: false; message?: string };

type Props = {
  borrower: Pick<
    BorrowerRow,
    'children_count' | 'preferred_language' | 'address'
  >;
  ageLabel: string | null;
  saveField: (
    field: EditableBorrowerField,
    value: string | null,
  ) => Promise<SaveFieldResult>;
};

/**
 * Dense merged row on a borrower card: children · age · language · address.
 *
 * The "foreign citizenship?" toggle that used to live here moved into
 * <BorrowerCitizenshipQuestions> — two yes/no questions (additional
 * citizenships, foreign residence), each with a conditional country picker.
 */
export function BorrowerMiscRow({
  borrower,
  ageLabel,
  saveField,
}: Props) {
  const t = useTranslations('case.borrower');
  const tf = useTranslations('borrowerForm.fields');
  const tForm = useTranslations('borrowerForm');
  const tc = useTranslations('common');

  const languageOptions = useMemo(
    () =>
      (['he', 'en'] as const).map((v) => ({
        value: v,
        label: tForm(`preferredLanguages.${v}`),
      })),
    [tForm],
  );

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pb-3 border-b border-neutral-100 text-sm">
      <CompactNumber
        label={tf('childrenCount')}
        value={borrower.children_count}
        onSave={(v) => saveField('children_count', v === null ? null : String(v))}
      />
      <CompactReadonly
        label={t('age')}
        value={ageLabel}
        warning={isSeniorAge(ageLabel)}
        warningLabel={t('ageWarning')}
      />
      <CompactSelect
        label={tf('preferredLanguage')}
        value={borrower.preferred_language ?? ''}
        onChange={(v) => {
          void saveField('preferred_language', v || null);
        }}
        options={[{ value: '', label: tc('select') }, ...languageOptions]}
      />
      <div className="flex-1 min-w-[12rem] max-w-md">
        <EditableField
          label={tf('address')}
          value={borrower.address}
          onSave={(v) => saveField('address', v)}
        />
      </div>
    </div>
  );
}
