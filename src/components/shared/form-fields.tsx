/**
 * Shared form primitives - used across case, borrower, bank, and other forms.
 * Each is small and pure (no business logic).
 */

import { Children, cloneElement, isValidElement, useId } from 'react';
import type { ReactNode } from 'react';

import { Label } from '@/components/ui/label';

export function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900 mb-3">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

// Props we may inject onto the first child input/select/textarea so the label
// and any error message become programmatically associated with it.
type InputLikeProps = {
  id?: string;
  required?: boolean;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-describedby'?: string;
};

export function FormField({
  label,
  required,
  error,
  children,
  htmlFor,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  /** Pass when the actual input is nested inside a wrapper element. */
  htmlFor?: string;
}) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  const errorId = error ? `${id}-error` : undefined;

  // Inject id + a11y attrs onto the first React element child so screen readers
  // hear "<label>, invalid, <error>" when focused. Consumers that wrap the
  // input in a div should pass `htmlFor` explicitly.
  const childArray = Children.toArray(children);
  const firstValidIndex = childArray.findIndex((c) => isValidElement<InputLikeProps>(c));
  const enhancedChildren = childArray.map((child, idx) => {
    if (idx === firstValidIndex && isValidElement<InputLikeProps>(child)) {
      const existing = child.props['aria-describedby'];
      const describedBy = [existing, errorId].filter(Boolean).join(' ') || undefined;
      return cloneElement(child, {
        id: child.props.id ?? id,
        required: required ?? child.props.required,
        'aria-invalid': error ? 'true' : child.props['aria-invalid'],
        'aria-describedby': describedBy,
      });
    }
    return child;
  });

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-neutral-700">
        {label}
        {required && (
          <span aria-hidden="true" className="text-red-600 ms-1">
            *
          </span>
        )}
      </Label>
      {enhancedChildren}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', ...rest } = props;
  return (
    <select
      {...rest}
      className={`h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm shadow-xs focus:outline-none focus-visible:border-[#A88840] focus-visible:ring-2 focus-visible:ring-[#A88840]/40 disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    />
  );
}
