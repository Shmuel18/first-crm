'use client';

import { useTranslations } from 'next-intl';

import { CurrencySign } from '@/components/ui/currency-sign';

import { FieldGroup } from '@/features/borrowers/components/borrower-compact-fields';
import { EditableField } from '@/features/borrowers/components/editable-field';

import { TransactionPurposePicker } from './transaction-purpose-picker';

type CaseTypeOption = { id: string; key: string; name_he: string };

export type PropertyFieldValues = {
  case_type_primary_id: string | null;
  case_type_other_text: string | null;
  city: string | null;
  gush_helka: string | null;
  property_value: number | null;
  requested_mortgage_amount: number | null;
};

type SaveResult = { ok: true } | { ok: false; message?: string };
type PropertyField = 'city' | 'gush_helka' | 'property_value' | 'requested_mortgage_amount';

/**
 * The four property/transaction fields (purpose · city · value · loan) shared
 * by the primary property (saves to cases.*) and each additional property
 * (saves to case_properties.*). Presentational — the parent supplies values +
 * the two save callbacks.
 */
export function PropertyFields({
  values,
  caseTypes,
  otherCaseTypeId,
  onSaveField,
  onSavePurpose,
  canEdit = true,
}: {
  values: PropertyFieldValues;
  caseTypes: ReadonlyArray<CaseTypeOption>;
  otherCaseTypeId: string | null;
  onSaveField: (field: PropertyField, value: string | null) => Promise<SaveResult>;
  onSavePurpose: (primary: string | null, other: string | null) => Promise<void>;
  /** When false, render all property fields read-only. */
  canEdit?: boolean;
}) {
  const tf = useTranslations('case.fields');

  return (
    <FieldGroup cols={4}>
      <TransactionPurposePicker
        label={tf('transactionPurpose')}
        placeholderSelect={tf('transactionPurposeSelect')}
        placeholderOther={tf('transactionPurposeOtherPlaceholder')}
        revertLabel={tf('transactionPurposeRevert')}
        primaryId={values.case_type_primary_id}
        otherText={values.case_type_other_text}
        options={caseTypes}
        otherId={otherCaseTypeId}
        onChange={onSavePurpose}
        canEdit={canEdit}
      />
      <EditableField
        label={tf('city')}
        value={values.city}
        onSave={(v) => onSaveField('city', v)}
        canEdit={canEdit}
      />
      <EditableField
        label={tf('gushHelka')}
        value={values.gush_helka}
        onSave={(v) => onSaveField('gush_helka', v)}
        canEdit={canEdit}
      />
      <EditableField
        type="number"
        label={tf('propertyValue')}
        value={values.property_value == null ? null : String(values.property_value)}
        onSave={(v) => onSaveField('property_value', v)}
        dir="ltr"
        adornment={<CurrencySign />}
        groupThousands
        canEdit={canEdit}
      />
      <EditableField
        type="number"
        label={tf('requestedMortgageAmount')}
        value={
          values.requested_mortgage_amount == null
            ? null
            : String(values.requested_mortgage_amount)
        }
        onSave={(v) => onSaveField('requested_mortgage_amount', v)}
        dir="ltr"
        adornment={<CurrencySign />}
        groupThousands
        canEdit={canEdit}
      />
    </FieldGroup>
  );
}
