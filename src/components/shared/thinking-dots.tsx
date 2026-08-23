/**
 * Three gold dots that bounce in sequence — a lightweight "writing" cue shown
 * while the assistant produces an answer (ai-v2-spec.md §7.2). Purely
 * presentational, so it stays a server component even though its callers are
 * client components. Shared by the case-briefing dialog and the assistant
 * bubble so the cue looks identical everywhere.
 */
export function ThinkingDots() {
  return (
    <span className="inline-flex gap-1" aria-hidden="true">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 rounded-full bg-brand-gold-dark motion-safe:animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
