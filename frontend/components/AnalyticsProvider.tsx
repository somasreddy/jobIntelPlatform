"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPageView, identifyUser } from "@/lib/analytics";
import { useAuth } from "@/lib/AuthContext";

/**
 * Tracks page views on route change and identifies users on login.
 * Mount once in the root layout.
 */
export default function AnalyticsProvider() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Page views
  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  // User identity
  useEffect(() => {
    if (user?.id) {
      identifyUser(user.id, { email: user.email, name: user.name });
    }
  }, [user?.id, user?.email, user?.name]);

  return null;
}
