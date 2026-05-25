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
      <TooltipPrimitive.Positioner side={side} sideOffset={sideOffset}>
        <TooltipPrimitive.Popup
          className={cn(
            // z-[100] beats the case-action-bar (z-20) and any inline dropdown
            // (z-50). text-sm not text-xs — Hebrew at xs is hard to read.
            // No animation: `tw-animate-css` keyframes don't reliably apply in
            // Tailwind v4 and were leaving the popup at opacity-0.
            'z-[100] max-w-xs rounded-md bg-neutral-900 px-2.5 py-1.5 text-sm font-medium text-white shadow-lg pointer-events-none',
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
