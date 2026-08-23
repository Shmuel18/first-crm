/**
 * Client helper: fetch a single-case answer from /api/ai/case-answer and
 * DRAIN it fully before returning — the answer appears at once (the user's
 * explicit preference over a typewriter effect); the "typing" dots cover the
 * wait. Shared by the assistant bubble and the dashboard NL bar.
 */
export type CaseAnswerResult =
  | { ok: true; text: string; label: string | null }
  | { ok: false; status: number };

export async function fetchCaseAnswer(input: {
  caseId: string;
  question: string;
  briefing: boolean;
}): Promise<CaseAnswerResult> {
  try {
    const res = await fetch('/api/ai/case-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok || !res.body) return { ok: false, status: res.status };

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    const rawLabel = res.headers.get('x-case-label');
    return {
      ok: true,
      text: text.trim(),
      label: rawLabel ? safeDecode(rawLabel) : null,
    };
  } catch {
    return { ok: false, status: 0 };
  }
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
