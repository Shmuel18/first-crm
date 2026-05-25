import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Font } from '@react-pdf/renderer';

/**
 * Register Hebrew-capable fonts so react-pdf can render Hebrew glyphs.
 *
 * react-pdf only ships Latin (Helvetica / Times / Courier) by default — any
 * Hebrew text would render as boxes without an explicit Font.register.
 *
 * We self-host Heebo from /public/fonts/. Earlier versions pulled it from
 * fonts.gstatic.com but Google rotates those hashed paths and we hit a 404
 * (Failed to fetch font from .../NGS6v5_NC0k9P9lVj0pewC4.ttf: 404 Not Found).
 * Reading the .ttf off disk is offline-safe and removes a network hop from
 * every render.
 *
 * Note: process.cwd() points at the project root in `next dev` and at the
 * deployment root on Vercel. Files in /public/ ship to disk on Vercel
 * functions, so this works in both environments.
 */
let registered = false;

export function ensureHebrewFontRegistered(): void {
  if (registered) return;
  const ttfPath = path.join(process.cwd(), 'public', 'fonts', 'heebo-regular.ttf');
  // Encode as a base64 data URL. react-pdf's Font.register branches on src
  // by string prefix:
  //   - "data:..." → decode base64 inline
  //   - "http..."  → fetch over network
  //   - otherwise  → treat as filesystem path
  //
  // Passing a raw Buffer fails because internal code calls
  // `src.substring(0, 5) === 'data:'` to detect data URLs ("dataUrl.substring
  // is not a function" if src is Buffer). Passing a Windows path like
  // `C:\Users\...\heebo-regular.ttf` is also fragile (the colon trips some
  // URL-detection heuristics). A base64 data URL is unambiguous and
  // guaranteed string-typed.
  //
  // Size cost: 122 KB ttf → ~163 KB base64 string, held in memory once per
  // process. Negligible.
  const ttf = readFileSync(ttfPath);
  const dataUrl = `data:font/ttf;base64,${ttf.toString('base64')}`;
  Font.register({
    family: 'Heebo',
    fonts: [
      { src: dataUrl, fontWeight: 400 },
      // No separate SemiBold .ttf yet — Regular renders both weights. If we
      // want true 600 weight, drop a heebo-semibold.ttf next to this and
      // point the second entry at it.
      { src: dataUrl, fontWeight: 600 },
    ],
  });
  // Don't hyphenate Hebrew text — react-pdf's default English hyphenator
  // mangles RTL strings.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
