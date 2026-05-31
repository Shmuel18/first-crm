import { LoadingLogo } from '@/components/shared/loading-logo';

/**
 * Loading skeleton for /cases/[id]. Mirrors the case-detail layout (sticky
 * action bar + 2-col block grid) with the brand mark breathing over it.
 * Replaces the generic (app)/loading.tsx during navigation into a case.
 */
export default function CaseDetailLoading() {
  return (
    <div className="relative -mt-6">
      <LoadingLogo />
      <div className="space-y-5 animate-pulse" aria-hidden>
        {/* Action bar shell */}
        <div className="bg-brand-gold-soft text-brand-black sticky top-[-1rem] sm:top-[-1.5rem] z-20 shadow-sm -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 border-b border-brand-gold/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="size-7 rounded-md bg-neutral-200" />
              <div className="h-5 w-48 rounded bg-neutral-200" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="size-8 rounded-md bg-neutral-200" />
              <div className="size-8 rounded-md bg-neutral-200" />
              <div className="size-8 rounded-md bg-neutral-200" />
            </div>
          </div>
        </div>

        {/* 2-col grid of block placeholders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <section
              key={i}
              className={[
                'bg-white border border-neutral-200 rounded-xl overflow-hidden',
                i === 0 || i === 5 ? 'md:col-span-2' : '',
              ].join(' ')}
            >
              <header className="px-5 py-3.5 bg-neutral-50/60 border-b border-neutral-100">
                <div className="h-5 w-40 rounded bg-neutral-200" />
              </header>
              <div className="p-5 space-y-3">
                <div className="h-10 rounded-lg bg-neutral-100" />
                <div className="h-10 rounded-lg bg-neutral-100" />
                <div className="h-10 rounded-lg bg-neutral-100" />
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
