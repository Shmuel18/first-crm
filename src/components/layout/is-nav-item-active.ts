/**
 * Single source of truth for nav active-state, shared by the desktop sidebar
 * and the mobile drawer so they never diverge for the same URL.
 *
 * Strict rule (`=== href` OR starts with `href + '/'`) rather than a loose
 * `startsWith(href)` because loose matching has two bugs:
 *   - `/cases` would match `/cases-x` (prefix without a path boundary), and
 *   - on a nested route like `/cases/[id]/simulators`, multiple items whose
 *     hrefs are prefixes of the path light up at once (cross-item
 *     over-highlight).
 * Requiring the boundary slash fixes both.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}
