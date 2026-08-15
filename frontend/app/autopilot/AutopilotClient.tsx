"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/lib/AuthContext";
import {
  Zap, Play, Pause, Loader2,
  FileText, Mail, Settings,
  RefreshCw, ThumbsUp, ThumbsDown, ChevronDown,
  Eye, Radar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import AnimatedStat from "@/components/AnimatedStat";
import { durations, easings } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";
import AutopilotSkeleton from "./AutopilotSkeleton";

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
  const tone =
    score >= 85 ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
    : score >= 70 ? "border-indigo-400/30 bg-indigo-500/10 text-indigo-300"
    : score >= 55 ? "border-amber-400/30 bg-amber-500/10 text-amber-300"
    : "border-slate-500/30 bg-slate-500/10 text-slate-300";
  return (
    <Badge variant="outline" className={cn("rounded-lg px-2 py-0.5 text-[11px] font-bold", tone)}>
      {score}% fit
    </Badge>
  );
}

function ExpandableText({ label, text }: { label: string; text?: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-[11px] transition-colors hover:brightness-125"
        style={{ color: "var(--accent-bright)" }}
      >
        <Eye className="w-3 h-3" />
        {open ? "Hide" : "View"} {label}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: durations.fast, ease: easings.easeOut }}
          className="inline-flex"
        >
          <ChevronDown className="w-3 h-3" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: durations.base, ease: easings.smooth }}
            className="overflow-hidden"
          >
            <pre
              className="mt-2 p-3 rounded-xl text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed overflow-auto max-h-40"
              style={{ background: "var(--bg-base)", border: "1px solid var(--border)" }}
            >
              {text}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AutopilotClient() {
  const { authHeader } = useAuth();
  const [settings, setSettings] = useState<AutopilotSettings | null>(null);
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
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
    Promise.allSettled([loadSettings(), loadQueue()]).finally(() => setLoading(false));
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

  if (loading) return <AutopilotSkeleton />;

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
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }} className="inline-flex">
                  <Button
                    type="button"
                    onClick={() => setShowSettings(o => !o)}
                    aria-label="Autopilot settings"
                    className="h-auto p-2 rounded-xl"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "#94a3b8" }}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>Autopilot settings</TooltipContent>
            </Tooltip>
            <motion.div whileTap={{ scale: 0.97 }} className="inline-flex">
              <Button
                type="button"
                onClick={runScan}
                disabled={scanning || !settings?.enabled}
                className="btn-primary h-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              >
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {scanning ? "Scanning…" : "Run Scan"}
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Master toggle */}
        <Card
          style={{
            background: settings?.enabled
              ? "color-mix(in srgb, var(--accent) 10%, var(--bg-card))"
              : undefined,
            borderColor: settings?.enabled ? "var(--border-hover)" : undefined,
          }}
        >
          <CardContent className="flex items-center justify-between gap-4 pt-6">
            <div className="flex items-center gap-3">
              <motion.div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: settings?.enabled ? "var(--accent)" : "var(--bg-elevated)" }}
                animate={{ scale: settings?.enabled ? 1 : 0.92 }}
                transition={{ duration: durations.fast, ease: easings.smooth }}
              >
                {settings?.enabled
                  ? <Play className="w-5 h-5 text-white" />
                  : <Pause className="w-5 h-5 text-slate-400" />
                }
              </motion.div>
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
            <Switch
              checked={!!settings?.enabled}
              onCheckedChange={toggleEnabled}
              disabled={saving}
              aria-label="Toggle Autopilot"
            />
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Pending Approval", value: queueData?.pending_count ?? 0, color: "#f59e0b" },
            { label: "Approved", value: queueData?.approved_count ?? 0, color: "#10b981" },
            { label: "Skipped", value: queueData?.skipped_count ?? 0, color: "#6b7280" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="text-center pt-6">
                <AnimatedStat value={s.value} className="text-2xl font-bold block" style={{ color: s.color }} />
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
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
              <AnimatePresence initial={false} mode="popLayout">
                {section.items.map(item => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: durations.base, ease: easings.outQuint }}
                  >
                    <Card>
                      <CardContent className="pt-6">
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
                          {section.showActions ? (
                            <div className="flex gap-2 shrink-0">
                              <motion.div whileTap={{ scale: 0.94 }} className="inline-flex">
                                <Button
                                  type="button"
                                  onClick={() => actionItem(item.id, "approve")}
                                  className="h-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                                  style={{ background: "#10b98120", color: "#10b981", border: "1px solid #10b98133" }}
                                >
                                  <ThumbsUp className="w-3.5 h-3.5" /> Approve
                                </Button>
                              </motion.div>
                              <motion.div whileTap={{ scale: 0.94 }} className="inline-flex">
                                <Button
                                  type="button"
                                  onClick={() => actionItem(item.id, "skip")}
                                  className="h-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                                  style={{ background: "var(--bg-elevated)", color: "#94a3b8", border: "1px solid var(--border)" }}
                                >
                                  <ThumbsDown className="w-3.5 h-3.5" /> Skip
                                </Button>
                              </motion.div>
                            </div>
                          ) : (
                            <Badge
                              className="rounded-lg px-2 py-1 text-xs shrink-0 border-transparent"
                              style={{
                                background: item.status === "approved" ? "#10b98120" : "var(--bg-elevated)",
                                color: item.status === "approved" ? "#10b981" : "#6b7280",
                              }}
                            >
                              {item.status}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}

        {/* Empty state */}
        {(!queueData || queueData.queue.length === 0) && (
          <EmptyState
            icon={Zap}
            title="No items in queue"
            description={
              settings?.enabled
                ? 'Click "Run Scan" to find matching jobs.'
                : 'Enable Autopilot and click "Run Scan" to get started.'
            }
            className="py-16"
          >
            <motion.div whileTap={{ scale: 0.97 }} className="inline-flex">
              <Button
                type="button"
                onClick={runScan}
                disabled={scanning || !settings?.enabled}
                className="btn-primary h-auto px-6 py-2.5 rounded-xl text-sm font-semibold"
              >
                {scanning ? "Scanning…" : "Run Scan Now"}
              </Button>
            </motion.div>
          </EmptyState>
        )}
      </div>

      {/* Settings dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Autopilot Settings</DialogTitle>
            <DialogDescription>
              Configure which jobs Autopilot queues for your review, and how many it prepares per day.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="autopilot-min-fit" className="text-xs text-slate-400 mb-1 block">Minimum Fit Score</label>
                <input id="autopilot-min-fit" type="number" min={50} max={99}
                  value={settingsForm.min_fit_score}
                  onChange={e => setSettingsForm(p => ({ ...p, min_fit_score: Number(e.target.value) }))}
                  className="input-field w-full" />
              </div>
              <div>
                <label htmlFor="autopilot-max-per-day" className="text-xs text-slate-400 mb-1 block">Max Applications / Day</label>
                <input id="autopilot-max-per-day" type="number" min={1} max={20}
                  value={settingsForm.max_per_day}
                  onChange={e => setSettingsForm(p => ({ ...p, max_per_day: Number(e.target.value) }))}
                  className="input-field w-full" />
              </div>
            </div>
            <div>
              <label htmlFor="autopilot-exclude" className="text-xs text-slate-400 mb-1 block">Exclude Companies (comma-separated)</label>
              <input id="autopilot-exclude" type="text" placeholder="Google, Amazon, Meta"
                value={settingsForm.exclude_companies}
                onChange={e => setSettingsForm(p => ({ ...p, exclude_companies: e.target.value }))}
                className="input-field w-full" />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl p-3"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
              <label htmlFor="autopilot-require-approval" className="text-xs text-slate-300 cursor-pointer">
                Require my approval before applying
              </label>
              <Switch
                id="autopilot-require-approval"
                checked={settingsForm.require_approval}
                onCheckedChange={checked => setSettingsForm(p => ({ ...p, require_approval: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setShowSettings(false)} className="btn-secondary h-auto px-4 py-2 rounded-xl text-xs">
              Cancel
            </Button>
            <Button type="button" onClick={saveSettings} disabled={saving} className="btn-primary h-auto px-4 py-2 rounded-xl text-xs font-semibold">
              {saving ? "Saving…" : "Save Settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
