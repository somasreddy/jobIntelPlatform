"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type SwitchProps = Omit<
  React.ComponentProps<"button">,
  "onChange" | "type" | "children"
> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

/**
 * Hand-authored, dependency-free Switch matching shadcn/ui's visual and API
 * conventions (`data-slot`, `data-state`, `checked` / `onCheckedChange`,
 * `size-*` thumb). `@radix-ui/react-switch` isn't installed in this project
 * yet, so this implements the same interaction model directly on a native
 * `<button role="switch">`, which already gives correct keyboard (Space /
 * Enter activate any button) and screen-reader (`aria-checked`) behavior
 * with no extra JS wiring. Supports both controlled (`checked` +
 * `onCheckedChange`) and uncontrolled (`defaultChecked`) usage, same as the
 * real Radix primitive, so call sites don't need to change if
 * `@radix-ui/react-switch` is added later and this gets swapped for the
 * upstream implementation.
 */
function Switch({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  ...props
}: SwitchProps) {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked ?? false);
  const isControlled = checked !== undefined;
  const isChecked = isControlled ? checked : internalChecked;

  const handleClick = () => {
    if (disabled) return;
    const next = !isChecked;
    if (!isControlled) setInternalChecked(next);
    onCheckedChange?.(next);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      data-slot="switch"
      data-state={isChecked ? "checked" : "unchecked"}
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        "peer inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        isChecked ? "bg-primary" : "bg-input",
        className
      )}
      {...props}
    >
      <span
        data-slot="switch-thumb"
        data-state={isChecked ? "checked" : "unchecked"}
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-white shadow-sm ring-0 transition-transform",
          isChecked ? "translate-x-[calc(100%-2px)]" : "translate-x-0"
        )}
      />
    </button>
  );
}

export { Switch };
