/**
 * Compute the position of a floating dropdown relative to its trigger button.
 *
 * The dropdown is rendered with position:fixed so it can escape `overflow:hidden`
 * ancestors (the cases table has overflow-x-auto). This function decides whether
 * to open the dropdown below or above the trigger based on viewport space.
 */

const DROPDOWN_MAX_HEIGHT_PX = 288; // matches Tailwind max-h-72
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
  const right = window.innerWidth - rect.right;

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
