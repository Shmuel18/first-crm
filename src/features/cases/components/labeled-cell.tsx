/**
 * Wrap a non-EditableField cell (e.g. EditableStatusCell, EditableBankCell)
 * so its label aligns visually with the EditableField rows next to it in
 * the same FieldGroup. Same 6rem label column + flex-1 content column.
 */
export function LabeledCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="grid grid-cols-[6rem_1fr] items-center gap-2 text-sm">
      <span className="text-neutral-500 truncate">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">{children}</div>
    </div>
  );
}
