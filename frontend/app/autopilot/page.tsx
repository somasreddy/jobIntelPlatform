"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  Zap, Play, Pause, Loader2,
  FileText, Mail, Settings,
  RefreshCw, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp,
  Eye, Radar,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AutopilotSettings {
  enabled: boolean;
  min_fit_score: number;
  max_per_day: number;
  exclude_companies: string[];
  require_approval: boolean;
}

interface QueueItem {
  id: string;
  job_id: string;
  job_title: string;
  job_org?: string;
  job_location?: string;
  fit_score: number;
  status: "pending" | "approved" | "skipped" | "applied" | "failed";
  has_resume: boolean;
  has_cover_letter: boolean;
  generated_resume?: string;
  generated_cover_letter?: string;
  created_at?: string;
}

interface QueueData {
  queue: QueueItem[];
  pending_count: number;
  approved_count: number;
  skipped_count: number;
}

function FitBadge({ score }: { score: number }) {
  const color = score >= 85 ? "#10b981" : score >= 70 ? "#3b82f6" : score >= 55 ? "#f59e0b" : "#6b7280";
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
      {score}% fit
    </span>
  );
}

function ExpandableText({ label, text }: { label: string; text?: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-[11px] transition-colors"
        style={{ color: "var(--accent-bright)" }}>
        <Eye className="w-3 h-3" />
        {open ? "Hide" : "View"} {label}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <pre className="mt-2 p-3 rounded-xl text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed overflow-auto max-h-40"
          style={{ background: "var(--bg-base)", border: "1px solid var(--border)" }}>
          {text}
        </pre>
      )}
    </div>
  );
}

export default function AutopilotPage() {
  const { authHeader } = useAuth();
  const [settings, setSettings] = useState<AutopilotSettings | null>(null);
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    min_fit_score: 75, max_per_day: 5, exclude_companies: "", require_approval: true,
  });

  const h = useCallback(() => ({ ...authHeader(), "Content-Type": "application/json" }), [authHeader]);

  const loadSettings = useCallback(async () => {
    const res = await fetch(`${API}/api/autopilot/settings`, { headers: h() });
    if (res.ok) {
      const s = await res.json();
      setSettings(s);
      setSettingsForm({
        min_fit_score: s.min_fit_score,
        max_per_day: s.max_per_day,
        exclude_companies: (s.exclude_companies || []).join(", "),
        require_approval: s.require_approval,
      });
    }
  }, [h]);

  const loadQueue = useCallback(async () => {
    const res = await fetch(`${API}/api/autopilot/queue`, { headers: h() });
    if (res.ok) setQueueData(await res.json());
  }, [h]);

  useEffect(() => {
    loadSettings();
    loadQueue();
  }, [loadSettings, loadQueue]);

  const toggleEnabled = async () => {
    if (!settings) return;
    const newEnabled = !settings.enabled;
    setSaving(true);
    const res = await fetch(`${API}/api/autopilot/settings`, {
      method: "PUT", headers: h(),
      body: JSON.stringify({ enabled: newEnabled }),
    });
    if (res.ok) setSettings(await res.json());
    setSaving(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    const res = await fetch(`${API}/api/autopilot/settings`, {
      method: "PUT", headers: h(),
      body: JSON.stringify({
        min_fit_score: settingsForm.min_fit_score,
        max_per_day: settingsForm.max_per_day,
        exclude_companies: settingsForm.exclude_companies
          .split(",").map(s => s.trim()).filter(Boolean),
        require_approval: settingsForm.require_approval,
      }),
    });
    if (res.ok) {
      setSettings(await res.json());
      setShowSettings(false);
    }
    setSaving(false);
  };

  const runScan = async () => {
    setScanning(true);
    const res = await fetch(`${API}/api/autopilot/scan`, { method: "POST", headers: h() });
    if (res.ok) {
      await loadQueue();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || "Scan failed");
    }
    setScanning(false);
  };

  const actionItem = async (itemId: string, action: "approve" | "skip") => {
    const res = await fetch(`${API}/api/autopilot/queue/${itemId}/action`, {
      method: "POST", headers: h(),
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      setQueueData(prev => {
        if (!prev) return prev;
        const newQueue = prev.queue.map(i =>
          i.id === itemId ? { ...i, status: action === "approve" ? "approved" as const : "skipped" as const } : i
        );
        return {
          ...prev,
          queue: newQueue,
          pending_count: newQueue.filter(i => i.status === "pending").length,
          approved_count: newQueue.filter(i => i.status === "approved").length,
          skipped_count: newQueue.filter(i => i.status === "skipped").length,
        };
      });
    }
  };

  const pending = queueData?.queue.filter(i => i.status === "pending") ?? [];
  const approved = queueData?.queue.filter(i => i.status === "approved") ?? [];
  const skipped = queueData?.queue.filter(i => i.status === "skipped") ?? [];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, var(--accent-deep), var(--accent))" }}>
                <Radar className="w-5 h-5 text-white" />
              </div>
              Autopilot
            </h1>
            <p className="text-sm text-slate-400 mt-1">AI scans jobs, prepares applications, awaits your approval</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(o => !o)}
              className="p-2 rounded-xl transition-all"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "#94a3b8" }}>
              <Settings className="w-4 h-4" />
            </button>
            <button onClick={runScan} disabled={scanning || !settings?.enabled}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              style={{ background: "var(--accent)", color: "white" }}>
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {scanning ? "Scanning…" : "Run Scan"}
            </button>
          </div>
        </div>

        {/* Master toggle */}
        <div className="rounded-2xl p-5 flex items-center justify-between"
          style={{
            background: settings?.enabled
              ? "color-mix(in srgb, var(--accent) 10%, var(--bg-card))"
              : "var(--bg-card)",
            border: `1px solid ${settings?.enabled ? "var(--border-hover)" : "var(--border)"}`,
          }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: settings?.enabled ? "var(--accent)" : "var(--bg-elevated)" }}>
              {settings?.enabled
                ? <Play className="w-5 h-5 text-white" />
                : <Pause className="w-5 h-5 text-slate-400" />
              }
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Autopilot is {settings?.enabled ? "active" : "paused"}
              </p>
              <p className="text-xs text-slate-400">
                {settings?.enabled
                  ? `Targeting ≥${settings.min_fit_score}% fit · max ${settings.max_per_day}/day`
                  : "Enable to start scanning jobs automatically"
                }
              </p>
            </div>
          </div>
          <button onClick={toggleEnabled} disabled={saving}
            className="relative w-12 h-6 rounded-full transition-all"
            style={{ background: settings?.enabled ? "var(--accent)" : "var(--border)" }}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${settings?.enabled ? "left-6" : "left-0.5"}`} />
          </button>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="rounded-2xl p-5 space-y-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold text-white">Autopilot Settings</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Minimum Fit Score</label>
                <input type="number" min={50} max={99}
                  value={settingsForm.min_fit_score}
                  onChange={e => setSettingsForm(p => ({ ...p, min_fit_score: Number(e.target.value) }))}
                  className="input-field w-full" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Max Applications / Day</label>
                <input type="number" min={1} max={20}
                  value={settingsForm.max_per_day}
                  onChange={e => setSettingsForm(p => ({ ...p, max_per_day: Number(e.target.value) }))}
                  className="input-field w-full" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Exclude Companies (comma-separated)</label>
              <input type="text" placeholder="Google, Amazon, Meta"
                value={settingsForm.exclude_companies}
                onChange={e => setSettingsForm(p => ({ ...p, exclude_companies: e.target.value }))}
                className="input-field w-full" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox"
                checked={settingsForm.require_approval}
                onChange={e => setSettingsForm(p => ({ ...p, require_approval: e.target.checked }))} />
              <span className="text-xs text-slate-300">Require my approval before applying</span>
            </label>
            <div className="flex gap-2 pt-2">
              <button onClick={saveSettings} disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-semibold"
                style={{ background: "var(--accent)", color: "white" }}>
                {saving ? "Saving…" : "Save Settings"}
              </button>
              <button onClick={() => setShowSettings(false)}
                className="px-4 py-2 rounded-xl text-xs"
                style={{ background: "var(--bg-elevated)", color: "#94a3b8" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Pending Approval", value: queueData?.pending_count ?? 0, color: "#f59e0b" },
            { label: "Approved", value: queueData?.approved_count ?? 0, color: "#10b981" },
            { label: "Skipped", value: queueData?.skipped_count ?? 0, color: "#6b7280" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4 text-center"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Queue sections */}
        {[
          { label: "Pending Approval", items: pending, showActions: true },
          { label: "Approved", items: approved, showActions: false },
          { label: "Skipped", items: skipped, showActions: false },
        ].map(section => section.items.length > 0 && (
          <div key={section.label}>
            <h2 className="text-sm font-semibold text-white mb-3">{section.label}</h2>
            <div className="space-y-3">
              {section.items.map(item => (
                <div key={item.id} className="rounded-2xl p-4"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white">{item.job_title}</p>
                        <FitBadge score={item.fit_score} />
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {item.job_org}{item.job_location ? ` · ${item.job_location}` : ""}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        {item.has_resume && (
                          <span className="flex items-center gap-1 text-[10px] text-slate-400">
                            <FileText className="w-3 h-3" style={{ color: "var(--accent-bright)" }} />
                            Resume ready
                          </span>
                        )}
                        {item.has_cover_letter && (
                          <span className="flex items-center gap-1 text-[10px] text-slate-400">
                            <Mail className="w-3 h-3" style={{ color: "var(--accent-bright)" }} />
                            Cover letter ready
                          </span>
                        )}
                      </div>
                      <ExpandableText label="resume" text={item.generated_resume} />
                      <ExpandableText label="cover letter" text={item.generated_cover_letter} />
                    </div>
                    {section.showActions && (
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => actionItem(item.id, "approve")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                          style={{ background: "#10b98120", color: "#10b981", border: "1px solid #10b98133" }}>
                          <ThumbsUp className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button onClick={() => actionItem(item.id, "skip")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                          style={{ background: "var(--bg-elevated)", color: "#94a3b8", border: "1px solid var(--border)" }}>
                          <ThumbsDown className="w-3.5 h-3.5" /> Skip
                        </button>
                      </div>
                    )}
                    {!section.showActions && (
                      <span className="text-xs px-2 py-1 rounded-lg shrink-0"
                        style={{
                          background: item.status === "approved" ? "#10b98120" : "var(--bg-elevated)",
                          color: item.status === "approved" ? "#10b981" : "#6b7280",
                        }}>
                        {item.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Empty state */}
        {(!queueData || queueData.queue.length === 0) && (
          <div className="text-center py-16 rounded-2xl"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <Zap className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-sm font-semibold text-white mb-1">No items in queue</p>
            <p className="text-xs text-slate-400 mb-4">
              {settings?.enabled
                ? "Click \"Run Scan\" to find matching jobs."
                : "Enable Autopilot and click \"Run Scan\" to get started."
              }
            </p>
            <button onClick={runScan} disabled={scanning || !settings?.enabled}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: "var(--accent)", color: "white" }}>
              {scanning ? "Scanning…" : "Run Scan Now"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
