import { describe, expect, it } from 'vitest';

import { buildLeadMetadata, parseLeadDetails, type LeadMetadataInput } from './lead-details';

const bareInput: LeadMetadataInput = {
  firstName: 'משה',
  lastName: 'כהן',
  phone: '0501234567',
  email: null,
  nationalId: '123456782',
  purpose: null,
  propertyValue: null,
  requestedMortgage: null,
  equity: null,
  monthlyIncome: null,
  followUpDate: null,
  notes: null,
};

describe('buildLeadMetadata', () => {
  it('returns empty metadata for a bare lead (no payload → keeps the simple convert path)', () => {
    expect(buildLeadMetadata(bareInput)).toEqual({});
  });

  it('stores follow-up without a payload when only the follow-up date is set', () => {
    expect(buildLeadMetadata({ ...bareInput, followUpDate: '2026-07-20' })).toEqual({
      follow_up_date: '2026-07-20',
    });
  });

  it('builds an intake-shaped payload (borrower lifted from contact fields) when financials are present', () => {
    const meta = buildLeadMetadata({
      ...bareInput,
      purpose: 'רכישת דירה ראשונה',
      propertyValue: 1_800_000,
      requestedMortgage: 1_200_000,
      equity: 600_000,
      monthlyIncome: 18_000,
      followUpDate: '2026-07-20',
      notes: 'התקשר בשבוע הבא',
    });

    expect(meta).toEqual({
      follow_up_date: '2026-07-20',
      payload: {
        purpose: 'רכישת דירה ראשונה',
        property_value: 1_800_000,
        requested_mortgage_amount: 1_200_000,
        equity: 600_000,
        request_details: 'התקשר בשבוע הבא',
        borrowers: [
          {
            first_name: 'משה',
            last_name: 'כהן',
            phone: '0501234567',
            national_id: '123456782',
            monthly_income: 18_000,
          },
        ],
      },
    });
  });
});

describe('parseLeadDetails', () => {
  it('round-trips a manual enriched lead built by buildLeadMetadata', () => {
    const meta = buildLeadMetadata({
      ...bareInput,
      email: 'a@b.co',
      propertyValue: 1_800_000,
      monthlyIncome: 18_000,
      followUpDate: '2026-07-20',
    });
    const d = parseLeadDetails(meta);

    expect(d.hasExtra).toBe(true);
    expect(d.followUpDate).toBe('2026-07-20');
    expect(d.property?.propertyValue).toBe(1_800_000);
    expect(d.borrowers).toHaveLength(1);
    expect(d.borrowers[0]).toMatchObject({ name: 'משה כהן', monthlyIncome: 18_000, email: 'a@b.co' });
  });

  it('parses a web-intake payload with numeric-string money and multiple borrowers', () => {
    const d = parseLeadDetails({
      source: 'public_intake',
      payload: {
        property_value: '2300000',
        equity: '600000',
        request_details: 'צריכים משכנתא',
        borrowers: [
          { first_name: 'דוד', last_name: 'לוי', phone: '0500000000' },
          { first_name: 'שרה', last_name: 'לוי' },
        ],
      },
    });

    expect(d.source).toBe('questionnaire');
    expect(d.property?.propertyValue).toBe(2_300_000);
    expect(d.property?.equity).toBe(600_000);
    expect(d.story).toBe('צריכים משכנתא');
    expect(d.borrowers.map((b) => b.name)).toEqual(['דוד לוי', 'שרה לוי']);
  });

  it('reports no extra for a bare/empty metadata', () => {
    expect(parseLeadDetails({}).hasExtra).toBe(false);
    expect(parseLeadDetails(null).hasExtra).toBe(false);
  });
});
