import { describe, expect, it } from 'vitest';

import { buildContactMessage, defaultFieldsFor, type ContactCaseDetails } from './contact-message';

const details: ContactCaseDetails = {
  clientName: 'כהן משה',
  nationalId: '123456782',
  phone: '050-1234567',
  city: 'ירושלים',
  gushHelka: null,
  propertyValue: '₪2,000,000',
  loanAmount: '₪1,000,000',
  bank: 'לאומי',
};
const labels = {
  clientName: 'לקוח',
  nationalId: 'ת"ז',
  phone: 'טלפון',
  city: 'עיר',
  gushHelka: 'גוש/חלקה',
  propertyValue: 'שווי',
  loanAmount: 'הלוואה',
  bank: 'בנק',
};

describe('buildContactMessage', () => {
  it('lists only chosen fields that have a value, in a fixed order', () => {
    const text = buildContactMessage({
      greeting: 'שלום',
      intro: 'פרטי התיק:',
      closing: 'תודה',
      fields: ['bank', 'clientName', 'gushHelka'],
      details,
      labels,
    });
    expect(text).toBe('שלום\n\nפרטי התיק:\n\nלקוח: כהן משה\nבנק: לאומי\n\nתודה');
  });
});

describe('defaultFieldsFor', () => {
  it('leaves the national id out for an appraiser', () => {
    expect(defaultFieldsFor('appraiser')).not.toContain('nationalId');
    expect(defaultFieldsFor('lawyer')).toContain('nationalId');
  });
});
