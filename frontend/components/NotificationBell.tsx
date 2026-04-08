"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, X, CheckCheck, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

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

export default function NotificationBell() {
  const { authHeader } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/notifications?limit=20`, { headers: authHeader() });
      if (!res.ok) return;
      const data = await res.json();
      const list: Notification[] = data.notifications ?? data ?? [];
      setNotifs(list);
      setUnread(list.filter(n => !n.is_read).length);
    } catch { /* offline */ }
  }, [authHeader]);

  // Poll every 60 s
  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            maxHeight: "440px",
          }}
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
          <div className="flex-1 overflow-y-auto" style={{ borderTop: "1px solid var(--border)" }}>
            {notifs.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-xs text-slate-500">No notifications yet</p>
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  className="px-4 py-3 flex gap-3 cursor-pointer transition-colors hover:bg-white/5"
                  style={{ background: n.is_read ? "transparent" : "color-mix(in srgb, var(--accent) 6%, transparent)" }}
                  onClick={() => { if (!n.is_read) markRead(n.id); }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white leading-tight">{n.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-slate-600 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {!n.is_read && (
                      <div className="w-2 h-2 rounded-full mt-1" style={{ background: "var(--accent)" }} />
                    )}
                    {n.action_url && (
                      <Link href={n.action_url} onClick={() => setOpen(false)}>
                        <ExternalLink className="w-3 h-3 text-slate-500 hover:text-white" />
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
