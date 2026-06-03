import {
  closestCorners,
  getFirstCollision,
  KeyboardCode,
  type DroppableContainer,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';

const DIRECTIONS: string[] = [
  KeyboardCode.Down,
  KeyboardCode.Right,
  KeyboardCode.Up,
  KeyboardCode.Left,
];

/**
 * Keyboard coordinate getter for the status board (A11Y-1 follow-up).
 *
 * The dnd-kit default nudges the dragged card 25px per arrow press, which is
 * unusable on a wide multi-column board — crossing a column takes a dozen
 * presses. This snaps the card to the *adjacent column* in a single press: it
 * keeps only the droppables that lie in the pressed direction, picks the closest
 * one, and returns a point inside it.
 *
 * Direction is resolved from on-screen geometry, so it works for the responsive
 * layout (1 col mobile → 2x2 md → 4 cols xl) and in both LTR and RTL.
 *
 * Adapted from dnd-kit's multipleContainers keyboard example.
 */
export const boardCoordinateGetter: KeyboardCoordinateGetter = (
  event,
  { context: { active, droppableRects, droppableContainers, collisionRect } },
) => {
  if (!DIRECTIONS.includes(event.code)) return undefined;
  event.preventDefault();
  if (!active || !collisionRect) return undefined;

  // Keep only the columns that sit in the pressed direction relative to the card.
  const candidates: DroppableContainer[] = [];
  droppableContainers.getEnabled().forEach((entry) => {
    if (!entry || entry.disabled) return;
    const rect = droppableRects.get(entry.id);
    if (!rect) return;

    switch (event.code) {
      case KeyboardCode.Down:
        if (collisionRect.top < rect.top) candidates.push(entry);
        break;
      case KeyboardCode.Up:
        if (collisionRect.top > rect.top) candidates.push(entry);
        break;
      case KeyboardCode.Right:
        if (collisionRect.left + collisionRect.width <= rect.left) candidates.push(entry);
        break;
      case KeyboardCode.Left:
        if (collisionRect.left >= rect.left + rect.width) candidates.push(entry);
        break;
    }
  });

  const collisions = closestCorners({
    active,
    collisionRect,
    droppableRects,
    droppableContainers: candidates,
    pointerCoordinates: null,
  });
  const closestId = getFirstCollision(collisions, 'id');
  if (closestId == null) return undefined;

  const targetRect = droppableRects.get(closestId);
  if (!targetRect) return undefined;

  // Aim near the top of the target column so the drop lands regardless of how
  // tall the column's content is (dead-center misses on short columns).
  return {
    x: targetRect.left + targetRect.width / 2,
    y: targetRect.top + Math.min(48, targetRect.height / 2),
  };
};
