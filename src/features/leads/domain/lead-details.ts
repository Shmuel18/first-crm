import { leadSource, type LeadSource } from './lead-source';

/**
 * A lead's `metadata` is a JSONB blob. Web-intake leads (mig 151) carry the full
 * questionnaire under `metadata.payload` (intake shape); manual leads now write the
 * same shape from the create form (buildLeadMetadata below), so ONE parser + one
 * renderer serve both — and the convert RPC's rich path (mig 152) imports either.
 * This module is the single place that reads/writes that shape.
 */

export type LeadBorrowerDetail = {
  name: string;
  phone: string | null;
  email: string | null;
  nationalId: string | null;
  birthDate: string | null;
  childrenCount: number | null;
  address: string | null;
  city: string | null;
  citizenship: string | null;
  employerName: string | null;
  monthlyIncome: number | null;
  employmentStartDate: string | null;
};

export type LeadProperty = {
  purpose: string | null;
  propertyCity: string | null;
  propertyValue: number | null;
  requestedMortgage: number | null;
  equity: number | null;
};

export type LeadDetails = {
  source: LeadSource;
  followUpDate: string | null;
  property: LeadProperty | null;
  story: string | null;
  borrowers: LeadBorrowerDetail[];
  /** True when there is anything beyond the basic lead columns to show. */
  hasExtra: boolean;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** Money/number fields survive as JSON numbers OR numeric strings — accept both. */
function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function int(v: unknown): number | null {
  const n = num(v);
  return n == null ? null : Math.trunc(n);
}

/** Normalize a lead's `metadata` into a flat, display-ready structure. */
export function parseLeadDetails(metadata: unknown): LeadDetails {
  const source = leadSource(metadata);
  const meta = asRecord(metadata);
  const followUpDate = str(meta?.follow_up_date);
  const payload = asRecord(meta?.payload);

  let property: LeadProperty | null = null;
  let story: string | null = null;
  const borrowers: LeadBorrowerDetail[] = [];

  if (payload) {
    const p: LeadProperty = {
      purpose: str(payload.purpose),
      propertyCity: str(payload.property_city),
      propertyValue: num(payload.property_value),
      requestedMortgage: num(payload.requested_mortgage_amount),
      equity: num(payload.equity),
    };
    if (p.purpose || p.propertyCity || p.propertyValue != null || p.requestedMortgage != null || p.equity != null) {
      property = p;
    }
    story = str(payload.request_details);

    const arr = Array.isArray(payload.borrowers) ? payload.borrowers : [];
    for (const raw of arr) {
      const b = asRecord(raw);
      if (!b) continue;
      const name = [str(b.first_name), str(b.last_name)].filter(Boolean).join(' ').trim();
      borrowers.push({
        name: name || '—',
        phone: str(b.phone),
        email: str(b.email),
        nationalId: str(b.national_id),
        birthDate: str(b.birth_date),
        childrenCount: int(b.children_count),
        address: str(b.address),
        city: str(b.city),
        citizenship: str(b.citizenship),
        employerName: str(b.employer_name),
        monthlyIncome: num(b.monthly_income),
        employmentStartDate: str(b.employment_start_date),
      });
    }
  }

  const hasExtra = Boolean(followUpDate || property || story || borrowers.length > 0);
  return { source, followUpDate, property, story, borrowers, hasExtra };
}

export type LeadMetadataInput = {
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  nationalId: string | null;
  purpose: string | null;
  propertyValue: number | null;
  requestedMortgage: number | null;
  equity: number | null;
  monthlyIncome: number | null;
  followUpDate: string | null;
  notes: string | null;
};

/**
 * Build a manual lead's `metadata` in the intake shape. The financial/property
 * fields (+ a single borrower lifted from the contact fields) go under `payload`
 * ONLY when at least one financial field was filled — so a bare name+phone lead
 * keeps an empty metadata and the SIMPLE convert path (unchanged behaviour). When
 * financials ARE present, the convert rich path (mig 152) imports them to the case.
 */
export function buildLeadMetadata(i: LeadMetadataInput): Record<string, unknown> {
  const hasFinancial =
    i.purpose != null ||
    i.propertyValue != null ||
    i.requestedMortgage != null ||
    i.equity != null ||
    i.monthlyIncome != null;

  const meta: Record<string, unknown> = {};
  if (i.followUpDate) meta.follow_up_date = i.followUpDate;

  if (hasFinancial) {
    const borrower: Record<string, unknown> = { first_name: i.firstName };
    if (i.lastName) borrower.last_name = i.lastName;
    if (i.phone) borrower.phone = i.phone;
    if (i.email) borrower.email = i.email;
    if (i.nationalId) borrower.national_id = i.nationalId;
    if (i.monthlyIncome != null) borrower.monthly_income = i.monthlyIncome;

    const payload: Record<string, unknown> = { borrowers: [borrower] };
    if (i.purpose) payload.purpose = i.purpose;
    if (i.propertyValue != null) payload.property_value = i.propertyValue;
    if (i.requestedMortgage != null) payload.requested_mortgage_amount = i.requestedMortgage;
    if (i.equity != null) payload.equity = i.equity;
    if (i.notes) payload.request_details = i.notes;

    meta.payload = payload;
  }

  return meta;
}
