"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { Zap, Mail, Lock, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Email and password are required"); return; }
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
          style={{ background: "linear-gradient(135deg, var(--accent-deep), var(--accent), var(--accent-secondary))", boxShadow: "0 8px 24px -6px var(--glow-accent)" }}
        >
          <Zap className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
        <p className="text-sm text-slate-400">Sign in to your JobIntel AI account</p>
      </div>

      {/* Card */}
      <div className="card p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                className="input-field w-full pl-10"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                className="input-field w-full pl-10"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-rose-400 p-3 rounded-xl" style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)" }}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base font-semibold"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</> : "Sign In"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-sm text-slate-500">
            No account?{" "}
            <Link href="/register" className="font-medium transition-colors" style={{ color: "var(--accent-bright)" }}>
              Create one free
            </Link>
          </p>
        </div>

        <div className="mt-6 pt-4 border-t border-white/10 text-center">
          <p className="text-xs text-slate-500 mb-2">Or continue without an account</p>
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Use in demo mode →
          </Link>
        </div>
      </div>
    </div>
  );
}
