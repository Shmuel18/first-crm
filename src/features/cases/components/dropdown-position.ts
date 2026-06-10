/**
 * Compute the position of a floating dropdown relative to its trigger button.
 *
 * The dropdown is rendered with position:fixed so it can escape `overflow:hidden`
 * ancestors (the cases table has overflow-x-auto). This function decides whether
 * to open the dropdown below or above the trigger based on viewport space.
 */

const DROPDOWN_MAX_HEIGHT_PX = 288; // matches Tailwind max-h-72
// Widest panel anchored by this helper (the date editor's w-64 = 256px) plus
// breathing room. Used to keep the panel's far edge on-screen on narrow
// (mobile-card) viewports; on desktop the viewport dwarfs it, so it's a no-op.
const DROPDOWN_EST_WIDTH_PX = 272;
const GAP_PX = 4;
const SAFETY_MARGIN_PX = 16;

export type DropdownPosition =
  | { top: number; right: number }
  | { bottom: number; right: number };

export function calcDropdownPos(trigger: HTMLElement | null): DropdownPosition | null {
  if (!trigger) return null;
  const rect = trigger.getBoundingClientRect();

  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  // Anchor to the trigger's right edge, but never so far right that the
  // panel's left edge would leave the viewport (clamps only on narrow screens).
  const right = Math.max(
    GAP_PX,
    Math.min(window.innerWidth - rect.right, window.innerWidth - DROPDOWN_EST_WIDTH_PX),
  );

  // If there's not enough room below AND there's more room above, open upward.
  if (
    spaceBelow < DROPDOWN_MAX_HEIGHT_PX + SAFETY_MARGIN_PX &&
    spaceAbove > spaceBelow
  ) {
    return {
      bottom: window.innerHeight - rect.top + GAP_PX,
      right,
    };
  }

  return {
    top: rect.bottom + GAP_PX,
    right,
  };
}
