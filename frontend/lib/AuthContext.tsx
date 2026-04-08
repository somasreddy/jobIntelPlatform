"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "ji_token";
const REFRESH_KEY = "ji_refresh";

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  authHeader: () => HeadersInit;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const storeTokens = (access: string, refresh: string) => {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    setToken(access);
  };

  const fetchMe = useCallback(async (accessToken: string) => {
    try {
      const res = await fetch(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser({ id: data.id, email: data.email, name: data.name ?? data.email });
      } else {
        // Try refresh
        const refresh = localStorage.getItem(REFRESH_KEY);
        if (refresh) {
          const r2 = await fetch(`${API}/api/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refresh }),
          });
          if (r2.ok) {
            const d2 = await r2.json();
            storeTokens(d2.access_token, d2.refresh_token ?? refresh);
            setUser({ id: d2.user_id, email: d2.email ?? "", name: d2.name ?? "" });
          } else {
            logout();
          }
        }
      }
    } catch { /* network failure — stay in demo mode */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      setToken(stored);
      fetchMe(stored);
    } else {
      setLoading(false);
    }
  }, [fetchMe]);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? "Invalid email or password");
    }
    const data = await res.json();
    storeTokens(data.access_token, data.refresh_token);
    setUser({ id: data.user_id, email, name: data.name ?? email });
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await fetch(`${API}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? "Registration failed");
    }
    const data = await res.json();
    storeTokens(data.access_token, data.refresh_token);
    setUser({ id: data.user_id, email, name });
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setToken(null);
    setUser(null);
  };

  const authHeader = (): HeadersInit => {
    const t = localStorage.getItem(TOKEN_KEY);
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, authHeader }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
