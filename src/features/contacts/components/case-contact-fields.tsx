'use client';

import { useTranslations } from 'next-intl';

import type { SaveResult } from '@/features/borrowers/components/editable-field';

import type { ContactCaseDetails } from '../domain/contact-message';
import type { ContactKind, ProfessionalContact } from '../types';

import { ContactField } from './contact-field';

/** The case column each professional's name lives in. */
type NameColumn = 'insurance_agent_name' | 'appraiser_name' | 'lawyer_name';

const FIELDS: ReadonlyArray<{ kind: ContactKind; column: NameColumn; labelKey: string }> = [
  { kind: 'insurance_agent', column: 'insurance_agent_name', labelKey: 'insuranceAgent' },
  { kind: 'appraiser', column: 'appraiser_name', labelKey: 'appraiser' },
  { kind: 'lawyer', column: 'lawyer_name', labelKey: 'lawyer' },
];

export type CaseContactsContext = {
  contacts: ReadonlyArray<ProfessionalContact>;
  details: ContactCaseDetails;
};

type Props = {
  caseId: string;
  values: Record<NameColumn, string | null>;
  onSave: (column: NameColumn, next: string | null) => Promise<SaveResult>;
  canEdit: boolean;
  context: CaseContactsContext;
};

/** The admin block's insurance-agent / appraiser / lawyer cells, directory-aware. */
export function CaseContactFields({ caseId, values, onSave, canEdit, context }: Props) {
  const tFields = useTranslations('case.fields');
  return (
    <>
      {FIELDS.map(({ kind, column, labelKey }) => (
        <ContactField
          key={column}
          caseId={caseId}
          kind={kind}
          label={tFields(labelKey)}
          value={values[column]}
          onSave={(v) => onSave(column, v)}
          canEdit={canEdit}
          contacts={context.contacts}
          details={context.details}
        />
      ))}
    </>
  );
}
