'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Desktop keeps the old "/settings lands on profile" behavior. On mobile the
 * index IS the drill-in menu (the layout's nav), so no redirect there. The
 * viewport check has to run client-side — a server redirect can't know the
 * screen size, which is why the old unconditional redirect() was replaced.
 */
export function SettingsIndexRedirect(): null {
  const router = useRouter();

  useEffect(() => {
    // Same breakpoint as the shell's md: two-column switch.
    if (window.matchMedia('(min-width: 768px)').matches) {
      router.replace('/settings/profile');
    }
  }, [router]);

  return null;
}
