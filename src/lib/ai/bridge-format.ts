/**
 * Pure formatting helpers for the AI bridge transport — no I/O, no server-only
 * imports, so they unit-test without the fetch/env chain. Used by bridge.ts.
 */

/**
 * Fold the JSON schema into the system prompt for the bridge path (the bridge
 * has no native structured outputs). One place for both the instruction and
 * the fence-strip that undoes a model wrapping its JSON in ```json.
 */
export function withSchemaInstruction(system: string, schema: Record<string, unknown>): string {
  return [
    system,
    '',
    'החזר אך ורק אובייקט JSON תקין התואם ל-JSON Schema הבא. בלי טקסט לפני או אחרי, בלי code fences:',
    JSON.stringify(schema),
  ].join('\n');
}

/** Strip an accidental ```json … ``` fence before JSON.parse. */
export function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return (fenced ? fenced[1]! : trimmed).trim();
}
