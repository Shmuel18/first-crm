export type SiblingNav = {
  /** 1-based position of the current document among its siblings. */
  position: number;
  total: number;
  prevId: string | null;
  nextId: string | null;
};

/**
 * Where a previewed document sits among the documents of the folder it was
 * opened from, in the folder's own display order. Null when it is not in the
 * list (deleted meanwhile) or is the only one — nothing to step to.
 */
export function siblingNav(ids: ReadonlyArray<string>, currentId: string): SiblingNav | null {
  const index = ids.indexOf(currentId);
  if (index === -1 || ids.length < 2) return null;
  return {
    position: index + 1,
    total: ids.length,
    prevId: ids[index - 1] ?? null,
    nextId: ids[index + 1] ?? null,
  };
}
