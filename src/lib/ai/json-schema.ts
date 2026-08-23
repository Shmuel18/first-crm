import { z } from 'zod';

/**
 * Zod → JSON Schema for the API's Structured Outputs (ai-v2-spec.md §1.1).
 *
 * Zod stays the single source of truth: the SAME schema constrains the model
 * (via output_config.format) and validates the response (safeParse). The API
 * has a restricted JSON Schema dialect, so after z.toJSONSchema we:
 *   1. force `additionalProperties: false` on every object (required by the API),
 *   2. pin `required` to ALL properties — optionality is expressed with
 *      `.nullable()`, never `.optional()`, in AI output schemas,
 *   3. strip constraint keywords the API rejects (min/max/pattern/…) — our
 *      safeParse still enforces them client-side, so nothing is lost.
 */
export function toStructuredOutputSchema(schema: z.ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { target: 'draft-2020-12' });
  return sanitizeNode(raw) as Record<string, unknown>;
}

const STRIPPED_KEYWORDS = [
  '$schema',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'pattern',
  'minItems',
  'maxItems',
] as const;

const NESTED_KEYS = ['properties', '$defs', 'definitions'] as const;
const CHILD_KEYS = ['items', 'additionalItems', 'not'] as const;
const LIST_KEYS = ['anyOf', 'allOf', 'oneOf', 'prefixItems'] as const;

function sanitizeNode(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizeNode);
  if (node === null || typeof node !== 'object') return node;

  const out: Record<string, unknown> = { ...(node as Record<string, unknown>) };
  for (const key of STRIPPED_KEYWORDS) delete out[key];

  for (const key of NESTED_KEYS) {
    const map = out[key];
    if (map && typeof map === 'object' && !Array.isArray(map)) {
      out[key] = Object.fromEntries(
        Object.entries(map as Record<string, unknown>).map(([k, v]) => [k, sanitizeNode(v)]),
      );
    }
  }
  for (const key of CHILD_KEYS) if (key in out) out[key] = sanitizeNode(out[key]);
  for (const key of LIST_KEYS) {
    const list = out[key];
    if (Array.isArray(list)) out[key] = list.map(sanitizeNode);
  }

  if (out.type === 'object') {
    out.additionalProperties = false;
    const props = out.properties;
    if (props && typeof props === 'object' && !Array.isArray(props)) {
      out.required = Object.keys(props as Record<string, unknown>);
    }
  }
  return out;
}
