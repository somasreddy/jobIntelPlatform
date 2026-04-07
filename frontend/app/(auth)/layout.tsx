import type { ReactNode } from "react";
import ThemeProvider from "@/components/ThemeProvider";
import { ProfileProvider } from "@/lib/ProfileContext";
import { AuthProvider } from "@/lib/AuthContext";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProfileProvider>
          <div className="min-h-screen flex items-center justify-center p-4" style={{ position: "relative", zIndex: 1 }}>
            {children}
          </div>
        </ProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
