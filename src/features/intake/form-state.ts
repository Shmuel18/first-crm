/**
 * Client-side draft state for the public intake wizard. Every field is a string
 * (what an <input> yields); tri-state yes/no selects use '' | 'yes' | 'no'. The
 * Zod layer (intake.schema.ts) coerces strings → number/null on submit, so the
 * wizard never has to. `toIntakePayload` is the single conversion point.
 */

export type BorrowerDraft = {
  first_name: string;
  last_name: string;
  national_id: string;
  birth_date: string;
  gender: string;
  marital_status: string;
  children_count: string;
  phone: string;
  email: string;
  preferred_language: string;
  address: string;
  city: string;
  citizenship: string;
  residency_type: string;
  foreign_residence_country: string;
  related_to_sellers: string;
  employment_status: string;
  employer_name: string;
  monthly_income: string;
  employment_start_date: string;
};

export type SetTop = <K extends keyof IntakeFormState>(
  key: K,
  value: IntakeFormState[K],
) => void;
export type SetBorrower = (index: number, key: keyof BorrowerDraft, value: string) => void;

export type IntakeFormState = {
  purpose: string;
  property_city: string;
  property_value: string;
  requested_mortgage_amount: string;
  equity: string;
  owns_other_property: string;
  borrowers: BorrowerDraft[];
  request_details: string;
  consent: boolean;
  /** Honeypot — must stay empty; a filled value flags a bot server-side. */
  website: string;
};

export function emptyBorrower(): BorrowerDraft {
  return {
    first_name: '',
    last_name: '',
    national_id: '',
    birth_date: '',
    gender: '',
    marital_status: '',
    children_count: '',
    phone: '',
    email: '',
    preferred_language: '',
    address: '',
    city: '',
    citizenship: '',
    residency_type: '',
    foreign_residence_country: '',
    related_to_sellers: '',
    employment_status: '',
    employer_name: '',
    monthly_income: '',
    employment_start_date: '',
  };
}

export function emptyIntakeState(locale: string): IntakeFormState {
  const borrower = emptyBorrower();
  borrower.preferred_language = locale;
  return {
    purpose: '',
    property_city: '',
    property_value: '',
    requested_mortgage_amount: '',
    equity: '',
    owns_other_property: '',
    borrowers: [borrower],
    request_details: '',
    consent: false,
    website: '',
  };
}

const INCOME_FIELDS = new Set([
  'employment_status',
  'employer_name',
  'monthly_income',
  'employment_start_date',
]);

/** Which wizard step (1-5) owns a Zod error key, so we can jump the user to it. */
export function stepForErrorKey(key: string): number {
  if (key === 'purpose' || key === 'property_city') return 1;
  if (key.startsWith('borrowers.')) {
    const field = key.split('.')[2] ?? '';
    return INCOME_FIELDS.has(field) ? 4 : 2;
  }
  if (
    key === 'property_value' ||
    key === 'requested_mortgage_amount' ||
    key === 'equity' ||
    key === 'owns_other_property'
  ) {
    return 3;
  }
  return 5; // request_details, consent, anything else
}

const triToBool = (v: string): boolean | null =>
  v === 'yes' ? true : v === 'no' ? false : null;

/** Serialize the draft into the object the server action validates. */
export function toIntakePayload(state: IntakeFormState, locale: string): Record<string, unknown> {
  return {
    purpose: state.purpose,
    property_city: state.property_city,
    property_value: state.property_value,
    requested_mortgage_amount: state.requested_mortgage_amount,
    equity: state.equity,
    owns_other_property: triToBool(state.owns_other_property),
    borrowers: state.borrowers.map((b) => ({
      ...b,
      related_to_sellers: triToBool(b.related_to_sellers),
    })),
    request_details: state.request_details,
    locale,
    consent: state.consent,
    website: state.website,
  };
}
