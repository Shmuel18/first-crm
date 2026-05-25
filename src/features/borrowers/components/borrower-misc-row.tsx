'use client';

import { useMemo } from 'react';

import { useTranslations } from 'next-intl';

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
  hasForeign: boolean;
  onHasForeignChange: (next: boolean) => void;
  saveField: (
    field: EditableBorrowerField,
    value: string | null,
  ) => Promise<SaveFieldResult>;
};

/**
 * Dense merged row on a borrower card: children · age · foreign? · language
 * + address that takes the remaining width. Wraps on narrow screens.
 *
 * Carries the foreign-citizenship toggle but not the conditional details —
 * the parent owns hasForeign state so it can also gate
 * <BorrowerCitizenshipFields> on the same value.
 */
export function BorrowerMiscRow({
  borrower,
  ageLabel,
  hasForeign,
  onHasForeignChange,
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
      <CompactReadonly label={t('age')} value={ageLabel} />
      <CompactSelect
        label={tf('foreignCitizenship')}
        value={hasForeign ? 'yes' : 'no'}
        onChange={(v) => onHasForeignChange(v === 'yes')}
        options={[
          { value: 'no', label: tc('no') },
          { value: 'yes', label: tc('yes') },
        ]}
      />
      <CompactSelect
        label={tf('preferredLanguage')}
        value={borrower.preferred_language ?? ''}
        onChange={(v) => {
          void saveField('preferred_language', v || null);
        }}
        options={[{ value: '', label: tc('select') }, ...languageOptions]}
      />
      <div className="flex-1 min-w-[16rem]">
        <EditableField
          label={tf('address')}
          value={borrower.address}
          onSave={(v) => saveField('address', v)}
        />
      </div>
    </div>
  );
}
