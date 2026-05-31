import { LoadingLogo } from '@/components/shared/loading-logo';

/**
 * Loading skeleton for the standalone simulator section (/simulators/*). The
 * mix / compare / scenario pages fetch regulatory thresholds + saved scenarios,
 * so a branded loader keeps the wait consistent with the rest of the app.
 */
export default function SimulatorsLoading() {
  return (
    <div className="relative mx-auto max-w-7xl">
      <LoadingLogo />
      <div className="space-y-6 animate-pulse" aria-hidden>
        <div className="h-8 w-64 rounded bg-neutral-200" />
        <div className="h-10 w-full max-w-md rounded-full bg-neutral-100" />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="h-96 rounded-xl bg-neutral-100" />
          <div className="h-96 rounded-xl bg-neutral-100" />
        </div>
      </div>
    </div>
  );
}
