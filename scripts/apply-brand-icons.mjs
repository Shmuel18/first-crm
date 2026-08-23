// Build-time brand icon swap. The favicon (src/app/icon.png), apple touch
// icon, and PWA icons (public/icons/*) are referenced by static files that
// cannot read runtime config — sw.js hardcodes /icons/icon-192.png and
// badge-96.png, and Next's icon file-convention is a literal file. So when
// NEXT_PUBLIC_BRAND names a brand that ships its own icon set under
// public/brands/<key>/icons/, this script copies it over the canonical
// paths before `next build`.
//
// Runs as part of `npm run build` (see package.json). In CI/Docker the
// checkout is ephemeral so the overwrite is harmless; in a local working
// tree building with a non-default brand will dirty git status — restore
// with `git checkout -- src/app/*.png public/icons` afterwards.
import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const brand = process.env.NEXT_PUBLIC_BRAND;
if (!brand || brand === 'kaufman') {
  console.log('[brand-icons] default brand — keeping checked-in icons');
  process.exit(0);
}

const srcDir = path.join('public', 'brands', brand, 'icons');
if (!existsSync(srcDir)) {
  console.warn(`[brand-icons] ${srcDir} missing — keeping default icons`);
  process.exit(0);
}

const MAP = [
  ['icon.png', path.join('src', 'app', 'icon.png')],
  ['apple-icon.png', path.join('src', 'app', 'apple-icon.png')],
  ['icon-192.png', path.join('public', 'icons', 'icon-192.png')],
  ['icon-512.png', path.join('public', 'icons', 'icon-512.png')],
  ['icon-maskable-512.png', path.join('public', 'icons', 'icon-maskable-512.png')],
  ['badge-96.png', path.join('public', 'icons', 'badge-96.png')],
];

for (const [from, to] of MAP) {
  const src = path.join(srcDir, from);
  if (!existsSync(src)) {
    console.warn(`[brand-icons] ${src} missing — keeping default for ${to}`);
    continue;
  }
  copyFileSync(src, to);
  console.log(`[brand-icons] ${src} -> ${to}`);
}
console.log(`[brand-icons] applied brand: ${brand}`);
