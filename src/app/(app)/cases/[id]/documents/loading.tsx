import { LoadingLogo } from '@/components/shared/loading-logo';

/**
 * Loading skeleton for /cases/[id]/documents. The documents page does a Drive
 * sync + 4-way fetch before rendering, so navigation here can take a beat —
 * action bar shell + folder-grid placeholder with the brand mark over it.
 */
export default function CaseDocumentsLoading() {
  return (
    <div className="relative">
      <LoadingLogo />
      <div className="animate-pulse" aria-hidden>
        {/* Sticky action bar */}
        <div className="bg-brand-gold-soft text-brand-black sticky top-[-1rem] sm:top-[-1.5rem] z-20 shadow-sm -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 border-b border-brand-gold/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="size-7 rounded-md bg-neutral-200" />
              <div className="h-5 w-56 rounded bg-neutral-200" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-9 w-24 rounded-lg bg-neutral-200" />
              <div className="h-9 w-9 rounded-md bg-neutral-200" />
            </div>
          </div>
        </div>

        {/* Folder grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="border border-neutral-200 rounded-xl bg-white p-4 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-neutral-100" />
                <div className="h-4 w-32 rounded bg-neutral-100" />
              </div>
              <div className="h-8 rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
