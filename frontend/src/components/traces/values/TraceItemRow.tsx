import { cn } from "@/lib/utils";

import type { ReactNode } from "react";

type TraceItemRowProps = {
  itemId: string;
  focused: boolean;
  onFocusItem?: (itemId: string) => void;
  className: string;
  children: ReactNode;
};

/** Item rows become focus entry points when the debugger supplies a handler. */
export function TraceItemRow({
  itemId,
  focused,
  onFocusItem,
  className,
  children,
}: TraceItemRowProps) {
  const classes = cn(
    className,
    focused && "border-accent-cyan/70 bg-accent-cyan/10",
    onFocusItem &&
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
  );
  if (!onFocusItem) {
    return (
      <div className={classes} data-focused={focused || undefined}>
        {children}
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-label={`Trace this result ${itemId}`}
      data-focused={focused || undefined}
      onClick={() => onFocusItem(itemId)}
      className={classes}
    >
      {children}
    </button>
  );
}
