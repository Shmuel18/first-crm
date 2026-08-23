import { describe, expect, it } from 'vitest';

import { stripJsonFence, withSchemaInstruction } from './bridge-format';

/**
 * The bridge's two pure helpers carry the load-bearing correctness of the
 * subscription transport: folding the schema into the prompt (no native
 * structured outputs over the bridge) and undoing a model that fences its
 * JSON. The HTTP round-trip itself is validated live by the bridge's own
 * /selftest on the demo host.
 */
describe('withSchemaInstruction', () => {
  it('appends the JSON schema and a JSON-only directive to the system prompt', () => {
    const out = withSchemaInstruction('base prompt', { type: 'object', properties: {} });
    expect(out).toContain('base prompt');
    expect(out).toContain('"type":"object"');
    expect(out).toContain('JSON'); // the directive line
  });
});

describe('stripJsonFence', () => {
  it('passes bare JSON through untouched', () => {
    expect(stripJsonFence('{"a":1}')).toBe('{"a":1}');
  });
  it('strips a ```json fence', () => {
    expect(stripJsonFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it('strips a bare ``` fence', () => {
    expect(stripJsonFence('```\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it('trims surrounding whitespace', () => {
    expect(stripJsonFence('  \n{"a":1}\n  ')).toBe('{"a":1}');
  });
  it('leaves an internal backtick alone', () => {
    expect(stripJsonFence('{"code":"`x`"}')).toBe('{"code":"`x`"}');
  });
});
