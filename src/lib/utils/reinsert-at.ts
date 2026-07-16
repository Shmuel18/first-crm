/** Re-insert `item` at its original `index` (clamped to the current length) —
 *  the rollback for an optimistic delete whose server call failed. */
export function reinsertAt<T>(list: ReadonlyArray<T>, index: number, item: T): T[] {
  const next = [...list];
  next.splice(Math.min(index, next.length), 0, item);
  return next;
}
