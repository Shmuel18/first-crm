import Image from 'next/image';

/**
 * Branded focal point for loading screens: the Kaufman building mark gently
 * "breathing" (scale + opacity + a soft gold glow — see `.logo-loading` in
 * globals.css) centered over the skeleton. Decorative only; the skeletons
 * carry their own `role="status"` announcement for assistive tech. Honors
 * `prefers-reduced-motion` (the animation is dropped there).
 *
 * Renders as an absolute overlay, so its parent must be `relative`.
 */
export function LoadingLogo(): React.ReactElement {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <Image
        src="/logo-coin-square.png"
        alt=""
        width={512}
        height={512}
        className="logo-loading h-16 w-auto"
      />
    </div>
  );
}
