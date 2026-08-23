import { describe, expect, it } from 'vitest';

import {
  DEFAULT_AI_FEATURES,
  isAiFeatureActive,
  isAiFeatureVisible,
  parseAiFeatures,
  resolveAiMode,
} from './flags';
import { AI_FEATURES } from './types';

/**
 * The kill-switch contract (ai-v2-spec.md §0.1): ANY malformed, partial or
 * missing flag value must degrade to OFF — never to enabled. These tests are
 * the executable form of that contract.
 */
describe('parseAiFeatures — fails closed on every malformed input', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'yes please'],
    ['a number', 7],
    ['an array', ['auto']],
    ['empty object (the DB default)', {}],
    ['enabled as a string', { enabled: 'true' }],
    ['modes as a string', { enabled: true, modes: 'auto' }],
  ])('%s → everything off', (_label, raw) => {
    const parsed = parseAiFeatures(raw);
    for (const feature of AI_FEATURES) {
      expect(resolveAiMode(parsed, feature)).toBe('off');
    }
  });

  it('a bogus mode value degrades that feature to off, not the whole object', () => {
    const parsed = parseAiFeatures({
      enabled: true,
      modes: { doc_classification: 'YOLO', email_triage: 'shadow' },
    });
    expect(resolveAiMode(parsed, 'doc_classification')).toBe('off');
    expect(resolveAiMode(parsed, 'email_triage')).toBe('shadow');
  });

  it('missing features default to off while present ones are kept', () => {
    const parsed = parseAiFeatures({ enabled: true, modes: { nl_queries: 'auto' } });
    expect(resolveAiMode(parsed, 'nl_queries')).toBe('auto');
    expect(resolveAiMode(parsed, 'case_briefing')).toBe('off');
  });
});

describe('resolveAiMode — the master switch overrides everything', () => {
  it('enabled=false zeroes even an explicit auto', () => {
    const parsed = parseAiFeatures({ enabled: false, modes: { doc_classification: 'auto' } });
    expect(resolveAiMode(parsed, 'doc_classification')).toBe('off');
    expect(isAiFeatureActive(parsed, 'doc_classification')).toBe(false);
  });

  it('enabled=true passes the per-feature mode through', () => {
    const parsed = parseAiFeatures({ enabled: true, modes: { doc_classification: 'suggest' } });
    expect(resolveAiMode(parsed, 'doc_classification')).toBe('suggest');
  });
});

describe('visibility tiers', () => {
  it('shadow is active but not visible; suggest and auto are both', () => {
    const shadow = parseAiFeatures({ enabled: true, modes: { email_triage: 'shadow' } });
    expect(isAiFeatureActive(shadow, 'email_triage')).toBe(true);
    expect(isAiFeatureVisible(shadow, 'email_triage')).toBe(false);

    const suggest = parseAiFeatures({ enabled: true, modes: { email_triage: 'suggest' } });
    expect(isAiFeatureVisible(suggest, 'email_triage')).toBe(true);

    const auto = parseAiFeatures({ enabled: true, modes: { email_triage: 'auto' } });
    expect(isAiFeatureVisible(auto, 'email_triage')).toBe(true);
  });
});

describe('DEFAULT_AI_FEATURES', () => {
  it('ships fully off', () => {
    expect(DEFAULT_AI_FEATURES.enabled).toBe(false);
    for (const feature of AI_FEATURES) {
      expect(DEFAULT_AI_FEATURES.modes[feature]).toBe('off');
    }
  });
});
