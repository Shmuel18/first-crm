/**
 * Per-navigation transition wrapper. A `template.tsx` (unlike `layout.tsx`) is
 * remounted on every route change, so the `animate-page-enter` fade+rise runs
 * each time you move between pages — while the persistent Topbar/Sidebar in the
 * layout stay put. Keeps the chrome stable and makes content swaps feel smooth.
 *
 * The animation lives in globals.css (hand-rolled @keyframes, reduced-motion
 * aware) so it's reliable under Tailwind v4 and leaves no lingering transform
 * that could break sticky headers.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-enter">{children}</div>;
}
