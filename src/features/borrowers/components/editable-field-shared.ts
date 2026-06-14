/**
 * Shared types + className constants for <EditableField> and its internal
 * renderControl. Kept in a TS-only file so both consumers can import
 * without pulling JSX-tree dependencies.
 */

export type SaveResult = { ok: true } | { ok: false; message?: string };

export type SelectOption = { value: string; label: string };

type CommonProps = {
  label: string;
  /** Current saved value. The component mirrors this into local state and
   *  rolls back to it when a save fails. */
  value: string | null | undefined;
  /** Async save. Should return ok/false; the parent is responsible for the
   *  optimistic UI of any DERIVED display (e.g. recomputed age). */
  onSave: (next: string | null) => Promise<SaveResult>;
  placeholder?: string;
  /** Suppress save attempts (e.g. while another action is pending). */
  disabled?: boolean;
  /** Icon / link rendered after the input (WhatsApp link, mailto, etc.). */
  adornment?: React.ReactNode;
  /** Override text direction. Defaults to auto for text, ltr for numeric. */
  dir?: 'ltr' | 'rtl' | 'auto';
  /** Extra classes appended to the input. Useful for text-end alignment
   *  (national_id digits should hug the label side of the box) without
   *  forking the EditableField API for every cosmetic tweak. */
  inputClassName?: string;
  /** Opt-in: render a numeric field with thousands separators (e.g. 7,000)
   *  at rest, reverting to raw digits while focused. Only takes effect for
   *  type='number'. Use for money / large counts — NOT for years or IDs,
   *  where grouping (2,024) would be wrong. */
  groupThousands?: boolean;
  /** When false, render the value read-only (plain text, no input/select) —
   *  e.g. for a user who can VIEW but not EDIT this case. Defaults to true.
   *  The interactive control is the affordance; gating it here keeps the UI
   *  honest instead of letting the user edit and then hit a server reject. */
  canEdit?: boolean;
};

export type FieldProps = CommonProps &
  (
    | { type?: 'text' | 'email' | 'tel' | 'date' | 'number'; options?: undefined; rows?: undefined }
    | { type: 'textarea'; options?: undefined; rows?: number }
    | { type: 'select' | 'tristate'; options: ReadonlyArray<SelectOption>; rows?: undefined }
  );

export const baseInputClass =
  'min-w-0 flex-1 h-9 px-2.5 rounded-md border border-neutral-200 bg-white text-sm text-neutral-900 ' +
  'shadow-xs focus:outline-none focus-visible:border-brand-gold-text focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed transition';

export const errorInputClass =
  'border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200';
