import type { DriveFolderNode } from '../types';

/**
 * Build a safe root-to-current breadcrumb from stable Drive folder ids.
 *
 * The persisted tree is external metadata, so a missing parent, a moved node,
 * or a cycle must not leak a breadcrumb outside the selected root. In those
 * cases the UI falls back to the selected root, matching FolderDetail's safe
 * navigation fallback.
 */
export function driveFolderBreadcrumb(
  root: DriveFolderNode,
  currentFolderId: string,
  nodes: ReadonlyArray<DriveFolderNode>,
): DriveFolderNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  byId.set(root.id, root);

  let current = byId.get(currentFolderId);
  if (!current) return [root];

  const reversed: DriveFolderNode[] = [];
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current.id)) return [root];
    visited.add(current.id);
    reversed.push(current);
    if (current.id === root.id) return reversed.reverse();
    current = byId.get(current.parentId);
  }

  return [root];
}
