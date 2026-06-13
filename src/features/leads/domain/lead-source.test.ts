import { describe, expect, it } from 'vitest';

import { leadSource } from './lead-source';

describe('leadSource', () => {
  it('classifies a landing contact-form lead as "contact" (metadata.source = web_contact)', () => {
    expect(leadSource({ source: 'web_contact' })).toBe('contact');
    expect(leadSource({ source: 'web_contact', payload: {} })).toBe('contact');
  });

  it('classifies a /check questionnaire lead as "questionnaire" (metadata.source = public_intake)', () => {
    expect(leadSource({ source: 'public_intake' })).toBe('questionnaire');
  });

  it('classifies a staff-created lead with no public source as "manual"', () => {
    expect(leadSource(null)).toBe('manual');
    expect(leadSource(undefined)).toBe('manual');
    expect(leadSource({})).toBe('manual');
    expect(leadSource({ source: null })).toBe('manual');
    expect(leadSource({ source: 'something_else' })).toBe('manual');
  });

  it('does NOT rely on the old payload.form_type marker (no producer ever wrote it)', () => {
    // A historical lead that only had payload.form_type and no source is "manual"
    // now — the robust signal is the RPC-set metadata.source.
    expect(leadSource({ payload: { form_type: 'contact' } })).toBe('manual');
  });
});
