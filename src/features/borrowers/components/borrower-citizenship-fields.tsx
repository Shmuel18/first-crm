'use client';

import { useTranslations } from 'next-intl';

import type { EditableBorrowerField } from '../actions/update-borrower-field';

import { FieldGroup } from './borrower-compact-fields';
import { EditableField } from './editable-field';

import type { BorrowerRow } from '../types';

type SaveFieldResult = { ok: true } | { ok: false; message?: string };

type Props = {
  borrower: Pick<
    BorrowerRow,
    'citizenship' | 'additional_citizenships' | 'residency_type'
  >;
  saveField: (
    field: EditableBorrowerField,
    value: string | null,
  ) => Promise<SaveFieldResult>;
  residencyOptions: ReadonlyArray<{ value: string; label: string }>;
};

/**
 * Conditional citizenship details for a borrower card. Rendered by the
 * parent only when `hasForeign === true` (so the parent owns the toggle
 * state and the auto-reveal-from-existing-data logic). 3-col layout that
 * matches the rest of the card sections.
 */
export function BorrowerCitizenshipFields({ borrower, saveField, residencyOptions }: Props) {
  const tf = useTranslations('borrowerForm.fields');

  return (
    <FieldGroup cols={3}>
      <EditableField
        label={tf('citizenship')}
        value={borrower.citizenship}
        onSave={(v) => saveField('citizenship', v)}
        placeholder={tf('citizenshipPlaceholder')}
      />
      <EditableField
        label={tf('additionalCitizenships')}
        value={borrower.additional_citizenships}
        onSave={(v) => saveField('additional_citizenships', v)}
        placeholder={tf('additionalCitizenshipsPlaceholder')}
      />
      <EditableField
        type="select"
        label={tf('residency')}
        value={borrower.residency_type}
        options={residencyOptions}
        onSave={(v) => saveField('residency_type', v)}
      />
    </FieldGroup>
  );
}
