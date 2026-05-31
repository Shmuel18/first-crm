import { LoadingLogo } from '@/components/shared/loading-logo';

/**
 * Dashboard loading skeleton. Shown the instant you navigate to /cases, while
 * the (data-heavy) server render streams — so navigation reads as immediate
 * feedback in the page's own shape, not a frozen old page. Mirrors the real
 * layout (greeting + view pills, search bar, toolbar, table rows) so the swap
 * to content is seamless, with the brand mark breathing over it as a focal
 * point. `animate-pulse` is a Tailwind core utility (reliable, unlike
 * tw-animate-css).
 *
 * Scoped to the dashboard: /cases/[id] and /cases/[id]/documents have their own
 * loading.tsx, and /cases/new has one too, so none inherit this table shape.
 */
export default function CasesLoading() {
  return (
    <div className="relative">
      <LoadingLogo />
      <div className="space-y-5 animate-pulse" aria-hidden>
        {/* Welcome banner: view pills (start) + greeting & date (end). */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-2 pt-1">
            <div className="h-8 w-28 rounded-full bg-neutral-200" />
            <div className="h-8 w-20 rounded-full bg-neutral-100" />
            <div className="h-8 w-20 rounded-full bg-neutral-100" />
          </div>
          <div className="space-y-2">
            <div className="ms-auto h-6 w-44 rounded bg-neutral-200" />
            <div className="ms-auto h-3 w-28 rounded bg-neutral-100" />
          </div>
        </div>

        {/* Search bar. */}
        <div className="h-12 w-full rounded-xl bg-neutral-100" />

        {/* Toolbar: export + view toggle (start), filters (end). */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <div className="h-8 w-24 rounded-lg bg-neutral-100" />
            <div className="h-8 w-20 rounded-lg bg-neutral-100" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-28 rounded-lg bg-neutral-100" />
            <div className="h-8 w-28 rounded-lg bg-neutral-100" />
            <div className="h-8 w-28 rounded-lg bg-neutral-100" />
          </div>
        </div>

        {/* Cases table rows. */}
        <div className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex h-14 items-center gap-4 px-4">
              <div className="h-3 w-5 rounded bg-neutral-100" />
              <div className="h-4 w-40 rounded bg-neutral-200" />
              <div className="h-3 w-24 rounded bg-neutral-100" />
              <div className="h-6 w-24 rounded-full bg-neutral-100" />
              <div className="h-4 w-28 rounded bg-neutral-100" />
              <div className="ms-auto h-3 w-32 rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
