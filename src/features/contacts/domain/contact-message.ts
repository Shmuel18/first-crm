import type { ContactKind } from '../types';

/** The case details a professional may need, in display order. */
export const CONTACT_MESSAGE_FIELDS = [
  'clientName',
  'nationalId',
  'phone',
  'city',
  'gushHelka',
  'propertyValue',
  'loanAmount',
  'bank',
] as const;
export type ContactMessageField = (typeof CONTACT_MESSAGE_FIELDS)[number];

/** Already-formatted values (money in ₪, names joined); null = not on the case. */
export type ContactCaseDetails = Record<ContactMessageField, string | null>;

/**
 * What each professional usually needs. An appraiser visits the property; a
 * lawyer and an insurance agent work on the client's identity and the loan.
 * The advisor can tick more or fewer in the dialog.
 */
export function defaultFieldsFor(kind: ContactKind): ContactMessageField[] {
  switch (kind) {
    case 'appraiser':
      return ['clientName', 'phone', 'city', 'gushHelka', 'propertyValue', 'bank'];
    case 'lawyer':
      return ['clientName', 'nationalId', 'phone', 'city', 'gushHelka', 'propertyValue', 'loanAmount', 'bank'];
    case 'insurance_agent':
      return ['clientName', 'nationalId', 'phone', 'city', 'propertyValue', 'loanAmount', 'bank'];
  }
}

/**
 * Plain-text message: greeting, intro, one "label: value" line per chosen
 * field that has a value, closing. Labels and wording come from i18n.
 */
export function buildContactMessage(parts: {
  greeting: string;
  intro: string;
  closing: string;
  fields: ReadonlyArray<ContactMessageField>;
  details: ContactCaseDetails;
  labels: Record<ContactMessageField, string>;
}): string {
  const lines = CONTACT_MESSAGE_FIELDS.filter((f) => parts.fields.includes(f)).flatMap((f) => {
    const value = parts.details[f]?.trim();
    return value ? [`${parts.labels[f]}: ${value}`] : [];
  });
  return [parts.greeting, '', parts.intro, '', ...lines, '', parts.closing].join('\n');
}
