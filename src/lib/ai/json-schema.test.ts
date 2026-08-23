import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { toStructuredOutputSchema } from './json-schema';

/**
 * The API's Structured Outputs dialect requires additionalProperties:false on
 * every object and rejects numeric/string constraint keywords. These tests pin
 * the sanitizer so a future schema (Epic 1's classification, Epic 2's triage)
 * can't silently produce a 400-ing format.
 */

type Node = Record<string, unknown>;

function collectObjects(node: unknown, out: Node[] = []): Node[] {
  if (Array.isArray(node)) {
    node.forEach((n) => collectObjects(n, out));
    return out;
  }
  if (node === null || typeof node !== 'object') return out;
  const rec = node as Node;
  if (rec.type === 'object') out.push(rec);
  Object.values(rec).forEach((v) => collectObjects(v, out));
  return out;
}

describe('toStructuredOutputSchema', () => {
  const schema = z.object({
    doc_type: z.enum(['payslip', 'bank_statement', 'unknown']),
    confidence: z.number().min(0).max(1),
    period: z.string().nullable(),
    flags: z.array(z.enum(['stale', 'name_mismatch'])).max(10),
    borrower: z.object({
      name: z.string().min(1),
      matched: z.boolean(),
    }),
  });

  const out = toStructuredOutputSchema(schema);
  const json = JSON.stringify(out);

  it('every object node gets additionalProperties:false and full required', () => {
    const objects = collectObjects(out);
    expect(objects.length).toBeGreaterThanOrEqual(2); // root + borrower
    for (const obj of objects) {
      expect(obj.additionalProperties).toBe(false);
      const props = Object.keys((obj.properties ?? {}) as Node);
      expect(obj.required).toEqual(props);
    }
  });

  it('strips constraint keywords the API rejects', () => {
    for (const kw of ['"minimum"', '"maximum"', '"minLength"', '"maxItems"', '"$schema"']) {
      expect(json, `${kw} should be stripped`).not.toContain(kw);
    }
  });

  it('keeps the structure Zod still validates client-side', () => {
    // The stripped constraints stay enforced by safeParse — double validation.
    expect(schema.safeParse({
      doc_type: 'payslip',
      confidence: 2, // out of the stripped 0..1 range
      period: null,
      flags: [],
      borrower: { name: 'x', matched: true },
    }).success).toBe(false);
  });

  it('nullable fields survive as type unions (our .nullable() convention)', () => {
    expect(json).toContain('"null"');
  });
});
