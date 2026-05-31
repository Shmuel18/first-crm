'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

/** Only reveal the mark once a load clearly outlasts a quick transition. */
const REVEAL_DELAY_MS = 450;

/**
 * Branded loading mark — shown ONLY on genuinely long waits. It stays hidden
 * for the first ~450ms, so fast navigations (the common case) show nothing but
 * the top progress bar. A logo that flashed on every quick transition reads as
 * a "splash on every click" and is worse than no loader; if the load outlasts
 * the delay, the mark fades in (breathing) as reassurance.
 *
 * Decorative (the skeletons carry their own role=status); renders as an
 * absolute overlay so its parent must be `relative`. Honors prefers-reduced-
 * motion via `.logo-loading` and `z-10` keeps it above the skeleton blocks.
 */
export function LoadingLogo(): React.ReactElement | null {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
    >
      <Image
        src="/logo-coin-square.png"
        alt=""
        width={512}
        height={512}
        className="logo-loading h-28 w-auto sm:h-36"
      />
    </div>
  );
}
