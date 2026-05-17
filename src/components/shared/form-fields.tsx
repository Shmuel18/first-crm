/**
 * Shared form primitives - used across case, borrower, bank, and other forms.
 * Each is small and pure (no business logic).
 */

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

export function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-neutral-700">
        {label}
        {required && <span className="text-red-500 ms-1">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', ...rest } = props;
  return (
    <select
      {...rest}
      className={`h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-[#C9A961] ${className}`}
    />
  );
}
