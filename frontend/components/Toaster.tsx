"use client";

import { Toaster as SonnerToaster } from "@/components/ui/sonner";

// Single global toast host — mounted once in `app/layout.tsx`. Everywhere
// else, import `toast` directly from the "sonner" package and call
// `toast.success(...)` / `toast.error(...)` / etc.; nothing needs to be
// imported from this file to fire a toast.
//
// Position: bottom-right, clear of the fixed left Navbar sidebar and the
// right-hand ProfileSidebar drawer.
//
// Theme: `@/components/ui/sonner` already hardcodes theme="dark" (see the
// comment there) because this app's ThemeProvider (`frontend/lib/theme.ts`)
// only switches between four dark color variants (executive/graphite/
// pacific/ember) — there is no actual light mode to wire a theme prop to.
export default function Toaster() {
  return <SonnerToaster position="bottom-right" richColors />;
}
