'use client';

import * as React from 'react';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';

import { cn } from '@/lib/utils';

function TooltipProvider({
  delay = 200,
  closeDelay = 0,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider delay={delay} closeDelay={closeDelay} {...props} />;
}

function TooltipRoot(props: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root {...props} />;
}

function TooltipTrigger(props: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger {...props} />;
}

function TooltipContent({
  side = 'bottom',
  // 10px clears the sticky action-bar's drop shadow (z-20). Anything tighter
  // tucks the tooltip's top edge under the shadow.
  sideOffset = 10,
  className,
  children,
  ...props
}: TooltipPrimitive.Popup.Props & {
  side?: TooltipPrimitive.Positioner.Props['side'];
  sideOffset?: TooltipPrimitive.Positioner.Props['sideOffset'];
}) {
  return (
    <TooltipPrimitive.Portal>
      {/* z-index MUST sit on the Positioner — it's the positioned (absolute)
          element. The Popup is position:static, where z-index is ignored, so
          a sticky action-bar (z-20) painted OVER the tooltip wherever the two
          overlapped (e.g. the topbar bell on case pages). z-[100] beats the
          action bars (z-20) and inline dropdowns (z-50). */}
      <TooltipPrimitive.Positioner side={side} sideOffset={sideOffset} className="z-[100]">
        <TooltipPrimitive.Popup
          className={cn(
            // text-sm not text-xs — Hebrew at xs is hard to read. No animation:
            // `tw-animate-css` keyframes don't reliably apply in Tailwind v4 and
            // were leaving the popup at opacity-0.
            'max-w-xs rounded-md bg-neutral-900 px-2.5 py-1.5 text-sm font-medium text-white shadow-lg pointer-events-none',
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

/**
 * Convenience wrapper: <Tooltip content="History">{trigger}</Tooltip>.
 * Renders the child unchanged when content is empty.
 */
function Tooltip({
  content,
  children,
  side,
}: {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: TooltipPrimitive.Positioner.Props['side'];
}) {
  if (!content) return children;
  return (
    <TooltipRoot>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipContent side={side}>{content}</TooltipContent>
    </TooltipRoot>
  );
}

export { Tooltip, TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent };
