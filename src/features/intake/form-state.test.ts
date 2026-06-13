import { describe, expect, it } from 'vitest';

import { emptyIntakeState, PURPOSE_OTHER, toIntakePayload } from './form-state';

describe('toIntakePayload — purpose', () => {
  it('emits the stable enum key for a standard purpose (not the translated label)', () => {
    const state = { ...emptyIntakeState('he'), purpose: 'purchase' };
    const payload = toIntakePayload(state, 'he');
    expect(payload.purpose).toBe('purchase');
  });

  it('keeps the same value regardless of UI locale (language-neutral)', () => {
    const state = { ...emptyIntakeState('en'), purpose: 'refinance' };
    expect(toIntakePayload(state, 'en').purpose).toBe('refinance');
    expect(toIntakePayload(state, 'he').purpose).toBe('refinance');
  });

  it('emits the free-text value for the "other" purpose', () => {
    const state = {
      ...emptyIntakeState('he'),
      purpose: PURPOSE_OTHER,
      purpose_other: '  שיפוץ נכס מסחרי  ',
    };
    expect(toIntakePayload(state, 'he').purpose).toBe('שיפוץ נכס מסחרי');
  });

  it('emits an empty purpose when nothing is selected', () => {
    expect(toIntakePayload(emptyIntakeState('he'), 'he').purpose).toBe('');
  });
});
