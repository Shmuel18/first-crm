import { ArrowLeft, ArrowRight } from 'lucide-react';

/**
 * Direction-aware back arrow. In a Hebrew/RTL page "back" points right;
 * in English/LTR it points left. Use this anywhere you'd normally hard-code
 * `<ArrowRight />` for a Back button.
 *
 * Renders on the server based on the document `dir` set by the layout -
 * which is set from the locale cookie in `app/layout.tsx`. CSS-only flips
 * (rtl:rotate-180 on a single Arrow icon) would also work but tie the
 * visual direction to the page's writing direction rather than to the
 * `back` semantic, so this component is more correct.
 */
export function BackArrow({
  locale,
  className,
}: {
  locale: 'he' | 'en';
  className?: string;
}) {
  const Icon = locale === 'he' ? ArrowRight : ArrowLeft;
  return <Icon className={className} aria-hidden />;
}
