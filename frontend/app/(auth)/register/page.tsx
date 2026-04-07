"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { Zap, Mail, Lock, User, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordStrength = (p: string) => {
    if (p.length === 0) return null;
    if (p.length < 6) return { label: "Too short", color: "text-rose-400", pct: 25 };
    if (p.length < 10 || !/[0-9]/.test(p)) return { label: "Fair", color: "text-amber-400", pct: 50 };
    if (!/[A-Z]/.test(p) || !/[^a-zA-Z0-9]/.test(p)) return { label: "Good", color: "text-cyan-400", pct: 75 };
    return { label: "Strong", color: "text-emerald-400", pct: 100 };
  };
  const strength = passwordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) { setError("All fields are required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    setError("");
    try {
      await register(name, email, password);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
        <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
        <p className="text-sm text-slate-400">Your AI-powered career command center awaits</p>
      </div>

      {/* Benefits */}
      <div className="flex justify-center gap-6 mb-6">
        {["Saved profile", "Job history", "Story bank"].map(b => (
          <div key={b} className="flex items-center gap-1.5 text-xs text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            {b}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="card p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                className="input-field w-full pl-10"
                placeholder="Jane Smith"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
          </div>

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
                placeholder="Min. 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {strength && (
              <div className="mt-1.5">
                <div className="h-1 rounded-full bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${strength.pct}%`,
                      background: strength.pct === 100 ? "#10b981" : strength.pct >= 75 ? "#06b6d4" : strength.pct >= 50 ? "#f59e0b" : "#f43f5e",
                    }}
                  />
                </div>
                <p className={`text-[10px] mt-0.5 ${strength.color}`}>{strength.label}</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                className="input-field w-full pl-10"
                placeholder="Repeat password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
              {confirm && password && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {confirm === password
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : <AlertCircle className="w-4 h-4 text-rose-400" />}
                </div>
              )}
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
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating account…</> : "Create Account"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium transition-colors" style={{ color: "var(--accent-bright)" }}>
              Sign in
            </Link>
          </p>
        </div>

        <div className="mt-6 pt-4 border-t border-white/10 text-center">
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Continue in demo mode →
          </Link>
        </div>
      </div>
    </div>
  );
}
