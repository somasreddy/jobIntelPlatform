"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

// The standard shadcn Sonner wrapper reads next-themes' light/dark mode
// (`const { theme = "system" } = useTheme()`), but this app has no
// next-themes provider and no light mode at all: `@/components/ThemeProvider`
// only switches between four dark color variants (executive/graphite/
// pacific/ember — see `frontend/lib/theme.ts`), every one of them a dark
// palette. So there is no real "light vs dark" signal to read here; forcing
// theme="dark" is the honest reflection of the app's actual (dark-only)
// design rather than fabricating a light/dark switch that doesn't exist.
// If a real light mode is ever added, wire this back up to that provider.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
