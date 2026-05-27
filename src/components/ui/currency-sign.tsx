/**
 * Small "₪" adornment used next to numeric inputs that hold amounts in
 * Israeli shekels. Subtle by design — secondary text colour, slightly
 * smaller than the input value, no background. Used via the `adornment`
 * prop on EditableField, and inline in the custom NumberCell variants in
 * the obligations/expenses tables.
 */
export function CurrencySign() {
  return (
    <span aria-hidden="true" className="text-xs text-neutral-500 font-medium">
      ₪
    </span>
  );
}
