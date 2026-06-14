'use client';

import { useCallback, useEffect, useReducer } from 'react';

import type { CaseDraftBorrowerInput } from '../schemas/case-draft.schema';

/**
 * Blank borrower shape used by the initial state + by "+ הוסף לווה" clicks.
 * All optional fields are null so the controlled form inputs render empty.
 * role_in_case defaults to 'borrower' (the common case; user can toggle to
 * 'guarantor' from the misc row after the card opens).
 */
export const BLANK_BORROWER: CaseDraftBorrowerInput = {
  first_name: '',
  last_name: '',
  national_id: null,
  id_issue_date: null,
  id_expiry_date: null,
  gender: null,
  phone: null,
  landline_phone: null,
  email: null,
  preferred_language: null,
  birth_date: null,
  marital_status: null,
  children_count: null,
  relationship_in_case: null,
  address: null,
  city: null,
  citizenship: null,
  additional_citizenships: null,
  residency_type: null,
  foreign_residence_country: null,
  employment_status: null,
  employer_name: null,
  credit_rating: null,
  owns_other_property: null,
  related_to_sellers: null,
  notes: null,
  role_in_case: 'borrower',
};

/**
 * Deterministic tempId for the seeded first borrower. Using a fixed string
 * (instead of randomUUID()) prevents an SSR/hydration mismatch — the page
 * is a client component but still renders server-side for hydration. After
 * mount, new borrowers from the "add" button use real UUIDs.
 */
const INITIAL_TEMP_ID = 'initial-borrower';

/**
 * Client-side state for the /cases/new draft flow. The draft lives entirely
 * in this reducer until the user clicks save — the server action then takes
 * a JSON snapshot and commits everything atomically via the create_case_draft
 * RPC.
 *
 * `isDirty` flips true on the first mutation (any add / update / setRequest)
 * and registers a beforeunload warning. Pure navigation away with no
 * interaction stays quiet.
 *
 * Borrowers carry a client-side `tempId` for React keys + edit/remove
 * dispatch addressing — the server ignores it and assigns real UUIDs.
 */

export type DraftBorrower = CaseDraftBorrowerInput & {
  /** Client-only React key. Server discards this. */
  tempId: string;
};

type DraftState = {
  requestDetailsHtml: string;
  borrowers: DraftBorrower[];
  isDirty: boolean;
};

type Action =
  | { type: 'addBorrower'; borrower: CaseDraftBorrowerInput }
  | { type: 'updateBorrower'; tempId: string; borrower: CaseDraftBorrowerInput }
  | { type: 'removeBorrower'; tempId: string }
  | { type: 'setRequestDetails'; html: string };

const initialState: DraftState = {
  requestDetailsHtml: '',
  // Pre-seed one empty borrower so the page opens with a ready-to-type card
  // (the office's common case: phone rings, advisor wants to type a name
  // immediately). isDirty stays false — leaving without typing anything
  // shouldn't trigger the beforeunload warning.
  borrowers: [{ ...BLANK_BORROWER, tempId: INITIAL_TEMP_ID }],
  isDirty: false,
};

function makeTempId(): string {
  const cryptoObj = globalThis.crypto;
  if (typeof cryptoObj?.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }

  if (typeof cryptoObj?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join('-');
  }

  return `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function reducer(state: DraftState, action: Action): DraftState {
  switch (action.type) {
    case 'addBorrower':
      return {
        ...state,
        isDirty: true,
        borrowers: [...state.borrowers, { ...action.borrower, tempId: makeTempId() }],
      };
    case 'updateBorrower':
      return {
        ...state,
        isDirty: true,
        borrowers: state.borrowers.map((b) =>
          b.tempId === action.tempId ? { ...action.borrower, tempId: b.tempId } : b,
        ),
      };
    case 'removeBorrower':
      return {
        ...state,
        isDirty: true,
        borrowers: state.borrowers.filter((b) => b.tempId !== action.tempId),
      };
    case 'setRequestDetails':
      return { ...state, isDirty: true, requestDetailsHtml: action.html };
  }
}

export function useCaseDraftState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // beforeunload warning — only registered while there's something to lose.
  // Empty-deps re-evaluate would miss the toggle; we re-run when isDirty
  // flips so the listener attaches/detaches at exactly the right moment.
  useEffect(() => {
    if (!state.isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      // Modern browsers ignore the custom message but require either
      // preventDefault() OR setting returnValue. We do both for older
      // engines / WebKit quirks.
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.isDirty]);

  const addBorrower = useCallback((borrower: CaseDraftBorrowerInput) => {
    dispatch({ type: 'addBorrower', borrower });
  }, []);

  const updateBorrower = useCallback(
    (tempId: string, borrower: CaseDraftBorrowerInput) => {
      dispatch({ type: 'updateBorrower', tempId, borrower });
    },
    [],
  );

  const removeBorrower = useCallback((tempId: string) => {
    dispatch({ type: 'removeBorrower', tempId });
  }, []);

  const setRequestDetails = useCallback((html: string) => {
    dispatch({ type: 'setRequestDetails', html });
  }, []);

  return {
    state,
    addBorrower,
    updateBorrower,
    removeBorrower,
    setRequestDetails,
  };
}
