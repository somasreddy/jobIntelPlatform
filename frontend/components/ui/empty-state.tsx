import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
}

export interface EmptyStateProps {
  /** Icon rendered inside the accent circle above the title. */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Simple declarative CTA (renders a Link if `href` is set, otherwise a button). */
  action?: EmptyStateAction;
  /** Full custom action area — takes precedence over `action` when provided. */
  children?: React.ReactNode;
  /** Drop the surrounding card background/border, e.g. when nesting inside a section that already has one. */
  bordered?: boolean;
  /** `lg` for full-page placeholders (404s, empty routes); `default` for in-card empty states. */
  size?: "default" | "lg";
  className?: string;
}

/**
 * Reusable empty-state primitive matching the Command Center dashboard's
 * existing inline empty states (frontend/app/page.tsx) — same tokens
 * (--bg-elevated, --border, --accent-bright, btn-primary) generalized
 * behind props so modules don't hand-roll their own.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  children,
  bordered = true,
  size = "default",
  className,
}: EmptyStateProps) {
  const isLarge = size === "lg";

  return (
    <div
      className={cn(
        "rounded-lg flex flex-col items-center text-center",
        isLarge ? "gap-4 p-10 sm:p-14" : "gap-3 p-6 sm:p-8",
        className
      )}
      style={
        bordered
          ? { background: "var(--bg-elevated)", border: "1px solid var(--border)" }
          : undefined
      }
    >
      {Icon && (
        <div
          className={cn(
            "rounded-full flex items-center justify-center shrink-0",
            isLarge ? "w-16 h-16" : "w-12 h-12"
          )}
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <Icon className={isLarge ? "w-7 h-7" : "w-5 h-5"} style={{ color: "var(--accent-bright)" }} />
        </div>
      )}

      <div className="space-y-1.5 max-w-sm">
        <p className={cn("font-semibold text-white", isLarge ? "text-lg" : "text-sm")}>{title}</p>
        {description && (
          <p className={cn("text-slate-400 leading-relaxed", isLarge ? "text-sm" : "text-xs")}>
            {description}
          </p>
        )}
      </div>

      {children ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-3">{children}</div>
      ) : action ? (
        <div className="mt-1">
          {action.href ? (
            <Link href={action.href} className="btn-primary inline-flex items-center justify-center gap-2 text-sm">
              {action.label}
              {action.icon && <action.icon className="w-4 h-4" />}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="btn-primary inline-flex items-center justify-center gap-2 text-sm"
            >
              {action.label}
              {action.icon && <action.icon className="w-4 h-4" />}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
