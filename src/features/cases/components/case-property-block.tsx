'use client';

import { useMemo, useState } from 'react';

import { Home } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { updateCaseFieldAction } from '../actions/update-case-field';
import {
  isEditableCaseField,
  type EditableCaseField,
} from '../domain/editable-case-fields';

import { CaseAdditionalProperties } from './case-additional-properties';
import { CaseBlock } from './case-block';
import { PropertyFields } from './property-fields';

import type { CaseProperty } from '../services/case-properties.service';
import type { CaseRow } from '../types';

/**
 * Inline-editable property/transaction block. The PRIMARY property lives on
 * cases.* (and feeds the bank PDF / LTV calc / simulator). Below it, the
 * additional-properties section (case_properties, migration 156) lets the
 * office record several properties for one client — informational only.
 */

type CaseTypeOption = { id: string; key: string; name_he: string };

type LocalCase = Pick<
  CaseRow,
  | 'case_type_primary_id'
  | 'case_type_other_text'
  | 'city'
  | 'gush_helka'
  | 'property_value'
  | 'requested_mortgage_amount'
>;

type Props = {
  caseId: string;
  initial: LocalCase;
  caseTypes: ReadonlyArray<CaseTypeOption>;
  additionalProperties: ReadonlyArray<CaseProperty>;
  /** When false, render the property block read-only. */
  canEdit?: boolean;
};

export function CasePropertyBlock({
  caseId,
  initial,
  caseTypes,
  additionalProperties,
  canEdit = true,
}: Props) {
  const t = useTranslations('case');

  const [localCase, setLocalCase] = useState<LocalCase>(initial);

  const otherCaseTypeId = useMemo(
    () => caseTypes.find((ct) => ct.key === 'other')?.id ?? null,
    [caseTypes],
  );

  // Save bridge for the primary property's city / value / loan fields → cases.*.
  const saveField = async (
    field: EditableCaseField,
    value: string | null,
  ): Promise<{ ok: true } | { ok: false; message?: string }> => {
    if (!isEditableCaseField(field)) return { ok: false };
    const key = field as keyof LocalCase;
    const prev = localCase[key];
    const coerced: unknown =
      field === 'property_value' || field === 'requested_mortgage_amount'
        ? value === null || value === ''
          ? null
          : Number(value)
        : value;

    setLocalCase((c) => ({ ...c, [key]: coerced as never }));
    const result = await updateCaseFieldAction(caseId, field, value);
    if (!result.ok) {
      setLocalCase((c) => ({ ...c, [key]: prev as never }));
      return { ok: false, message: result.message };
    }
    return { ok: true };
  };

  // Dual-write for the primary purpose field (primaryId + otherText) → cases.*.
  const savePurpose = async (
    nextPrimary: string | null,
    nextOther: string | null,
  ): Promise<void> => {
    const prevPrimary = localCase.case_type_primary_id;
    const prevOther = localCase.case_type_other_text;
    if (nextPrimary === prevPrimary && nextOther === prevOther) return;

    setLocalCase((c) => ({
      ...c,
      case_type_primary_id: nextPrimary,
      case_type_other_text: nextOther,
    }));
    const r1 = await updateCaseFieldAction(caseId, 'case_type_primary_id', nextPrimary);
    if (!r1.ok) {
      setLocalCase((c) => ({
        ...c,
        case_type_primary_id: prevPrimary,
        case_type_other_text: prevOther,
      }));
      return;
    }
    const r2 = await updateCaseFieldAction(caseId, 'case_type_other_text', nextOther);
    if (!r2.ok) {
      setLocalCase((c) => ({
        ...c,
        case_type_primary_id: prevPrimary,
        case_type_other_text: prevOther,
      }));
    }
  };

  return (
    <CaseBlock title={t('blocks.property')} icon={<Home />} fullWidth blockKey="property">
      <PropertyFields
        values={localCase}
        caseTypes={caseTypes}
        otherCaseTypeId={otherCaseTypeId}
        onSaveField={saveField}
        onSavePurpose={savePurpose}
        canEdit={canEdit}
      />
      <CaseAdditionalProperties
        caseId={caseId}
        initial={additionalProperties}
        caseTypes={caseTypes}
        otherCaseTypeId={otherCaseTypeId}
        canEdit={canEdit}
      />
    </CaseBlock>
  );
}
