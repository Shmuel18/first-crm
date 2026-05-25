import { CaseBlock } from './case-block';

type Props = {
  title: string;
  icon: React.ReactNode;
  fullWidth?: boolean;
  /** Number of pulsing rows in the body. Default 3. */
  rows?: number;
};

/**
 * Generic skeleton used as the <Suspense fallback> for streamed CaseBlock-
 * shaped sections. Matches the real block's outer chrome (header + title)
 * so the page doesn't reflow when content arrives.
 */
export function CaseBlockSkeleton({ title, icon, fullWidth, rows = 3 }: Props) {
  return (
    <CaseBlock title={title} icon={icon} fullWidth={fullWidth}>
      <div className="space-y-3 animate-pulse" aria-hidden>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-neutral-100" />
        ))}
      </div>
    </CaseBlock>
  );
}
