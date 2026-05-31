import { LoadingLogo } from '@/components/shared/loading-logo';

/**
 * New-case route skeleton. Exists so /cases/new does NOT inherit the dashboard
 * table skeleton from ../loading.tsx — this matches the new-case form's shape
 * (an action bar + a couple of block cards) instead, with the brand mark
 * breathing over it.
 */
export default function NewCaseLoading() {
  return (
    <div className="relative">
      <LoadingLogo />
      <div className="space-y-5 animate-pulse" aria-hidden>
        <div className="h-12 w-full rounded-xl bg-neutral-100" />
        <div className="h-44 w-full rounded-xl border border-neutral-200 bg-white" />
        <div className="h-44 w-full rounded-xl border border-neutral-200 bg-white" />
      </div>
    </div>
  );
}
