"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Bell, X, CheckCheck, ExternalLink, Briefcase, CalendarClock,
  GraduationCap, TrendingUp, Zap, Trophy, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { durations, easings } from "@/lib/motion-tokens";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  action_url?: string;
  created_at: string;
}

// Visual language per notification `type` (see backend/api/notifications.py
// module docstring for the canonical list, incl. the `reminder`/`milestone`
// types added in this deepening pass). Falls back to a plain bell for any
// type not listed here, so unrecognized/future types never break rendering.
const TYPE_STYLE: Record<string, { icon: LucideIcon; color: string }> = {
  new_job_match: { icon: Briefcase, color: "#3b82f6" },
  interview_reminder: { icon: CalendarClock, color: "#f59e0b" },
  application_followup: { icon: CalendarClock, color: "#f59e0b" },
  reminder: { icon: CalendarClock, color: "#f59e0b" },
  skill_completed: { icon: GraduationCap, color: "#10b981" },
  health_score_change: { icon: TrendingUp, color: "#8b5cf6" },
  autopilot_approval: { icon: Zap, color: "#3b82f6" },
  milestone: { icon: Trophy, color: "#f59e0b" },
};

function typeStyle(type: string): { icon: LucideIcon; color: string } {
  return TYPE_STYLE[type] ?? { icon: Bell, color: "#64748b" };
}

export default function NotificationBell() {
  const { authHeader } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = useCallback(async () => {
    try {
      // Best-effort: materialize any due reminder/milestone notifications
      // from real data before listing (see POST /generate — idempotent, so
      // safe to call on every poll/open). Failure here must never block the
      // list fetch below.
      try {
        await fetch(`${API}/api/notifications/generate`, { method: "POST", headers: authHeader() });
      } catch { /* best-effort only */ }

      const res = await fetch(`${API}/api/notifications?limit=20`, { headers: authHeader() });
      if (!res.ok) return;
      const data = await res.json();
      const list: Notification[] = data.notifications ?? data ?? [];
      setNotifs(list);
      // Prefer the server's authoritative unread_count over recomputing from
      // `list`, which is capped at 20 — recomputing would undercount once
      // unread notifications exceed that page size.
      setUnread(typeof data.unread_count === "number" ? data.unread_count : list.filter(n => !n.is_read).length);
    } catch { /* offline */ }
  }, [authHeader]);

  // Poll every 60 s
  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markRead = async (id: string) => {
    try {
      await fetch(`${API}/api/notifications/${id}/read`, {
        method: "POST", headers: authHeader(),
      });
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    try {
      await fetch(`${API}/api/notifications/mark-all-read`, {
        method: "POST", headers: authHeader(),
      });
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnread(0);
    } catch { /* ignore */ }
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifs(); }}
        className="relative p-2 rounded-xl transition-colors"
        style={{
          background: open ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "transparent",
          border: "1px solid transparent",
          color: open ? "var(--accent-bright)" : "#64748b",
        }}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
            style={{ background: "var(--accent)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              maxHeight: "440px",
            }}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: durations.fast, ease: easings.easeOut }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <p className="text-sm font-semibold text-white">Notifications</p>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button onClick={markAllRead}
                    className="flex items-center gap-1 text-[11px] transition-colors"
                    style={{ color: "var(--accent-bright)" }}>
                    <CheckCheck className="w-3 h-3" /> Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <motion.div layout className="flex-1 overflow-y-auto" style={{ borderTop: "1px solid var(--border)" }}>
              {notifs.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  <p className="text-xs text-slate-500">No notifications yet</p>
                </div>
              ) : (
                notifs.map(n => {
                  const { icon: TypeIcon, color } = typeStyle(n.type);
                  const content = (
                    <>
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: `${color}22`, border: `1px solid ${color}44` }}
                      >
                        <TypeIcon className="w-3.5 h-3.5" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white leading-tight">{n.title}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                        <p className="text-[10px] text-slate-600 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {!n.is_read && (
                          <div className="w-2 h-2 rounded-full mt-1" style={{ background: "var(--accent)" }} />
                        )}
                        {n.action_url && <ExternalLink className="w-3 h-3 text-slate-500" />}
                      </div>
                    </>
                  );
                  const rowStyle = { background: n.is_read ? "transparent" : "color-mix(in srgb, var(--accent) 6%, transparent)" };
                  const rowClass = "px-4 py-3 flex gap-3 cursor-pointer transition-colors hover:bg-white/5";

                  return n.action_url ? (
                    <Link
                      key={n.id}
                      href={n.action_url}
                      className={rowClass}
                      style={rowStyle}
                      onClick={() => { if (!n.is_read) markRead(n.id); setOpen(false); }}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div
                      key={n.id}
                      className={rowClass}
                      style={rowStyle}
                      onClick={() => { if (!n.is_read) markRead(n.id); }}
                    >
                      {content}
                    </div>
                  );
                })
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
