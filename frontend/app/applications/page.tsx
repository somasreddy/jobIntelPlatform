"use client";
import Navbar from "@/components/Navbar";
import { mockApplications, mockJobs } from "@/lib/mockData";
import { ApplicationStatus, Application } from "@/lib/types";
import { Building2, Calendar, ArrowUpRight, Bell, BellOff, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { getSavedJobIds } from "@/lib/profile";

const COLUMNS: { id: ApplicationStatus; title: string; color: string }[] = [
  { id: "Saved", title: "Saved", color: "text-slate-400" },
  { id: "Applied", title: "Applied", color: "text-indigo-400" },
  { id: "Assessment", title: "Assessment", color: "text-amber-400" },
  { id: "Interview", title: "Interview", color: "text-cyan-400" },
  { id: "Offer", title: "Offer", color: "text-emerald-400" },
  { id: "Rejected", title: "Rejected", color: "text-rose-400" },
];

const FOLLOWUP_STORAGE_KEY = "trackerFollowUpDates";

function loadFollowUpDates(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(FOLLOWUP_STORAGE_KEY) || "{}"); }
  catch { return {}; }
}

function saveFollowUpDate(appId: string, date: string) {
  const current = loadFollowUpDates();
  current[appId] = date;
  localStorage.setItem(FOLLOWUP_STORAGE_KEY, JSON.stringify(current));
}

function removeFollowUpDate(appId: string) {
  const current = loadFollowUpDates();
  delete current[appId];
  localStorage.setItem(FOLLOWUP_STORAGE_KEY, JSON.stringify(current));
}

export default function TrackerPage() {
  const [apps, setApps] = useState<Application[]>(mockApplications);
  const [followUpDates, setFollowUpDates] = useState<Record<string, string>>({});
  const [editingFollowUp, setEditingFollowUp] = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    // Load follow-up dates from localStorage
    setFollowUpDates(loadFollowUpDates());

    // Load saved job IDs from localStorage and inject into Saved column
    const savedIds = getSavedJobIds();
    const existingJobIds = new Set(mockApplications.map(a => a.jobId));
    const savedApps: Application[] = savedIds
      .filter(id => !existingJobIds.has(id))
      .map(id => {
        const job = mockJobs.find(j => j.id === id);
        if (!job) return null;
        return {
          id: `saved-${id}`,
          jobId: id,
          job,
          status: "Saved" as ApplicationStatus,
          dateApplied: new Date().toISOString().split("T")[0],
        };
      })
      .filter(Boolean) as Application[];

    const merged = [...mockApplications, ...savedApps];

    // Fetch from API if available
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) { setApps(merged); return; }
    fetch(`${apiUrl}/api/applications/`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setApps(data);
        else setApps(merged);
      })
      .catch(() => setApps(merged));
  }, []);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("applicationId", id);
  };

  const handleDrop = (e: React.DragEvent, status: ApplicationStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("applicationId");
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) {
      fetch(`${apiUrl}/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).catch(() => {});
    }
  };

  const handleSetFollowUp = (appId: string, date: string) => {
    const updated = { ...followUpDates, [appId]: date };
    setFollowUpDates(updated);
    saveFollowUpDate(appId, date);
    setEditingFollowUp(null);
  };

  const handleClearFollowUp = (appId: string) => {
    const updated = { ...followUpDates };
    delete updated[appId];
    setFollowUpDates(updated);
    removeFollowUpDate(appId);
  };

  const overdueCount = Object.entries(followUpDates).filter(([, d]) => d < today).length;

  return (
    <div className="flex min-h-screen bg-transparent">
      <Navbar />
      <main className="ml-64 flex-1 px-8 py-8 flex flex-col h-screen overflow-hidden">
        <div className="mb-6 shrink-0 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Application Tracker</h1>
            <p className="text-slate-400 text-sm mt-1">
              Drag and drop to track your progress. Saved jobs auto-populate from your bookmarks.
            </p>
          </div>
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{overdueCount} overdue follow-up{overdueCount > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {/* Kanban Board */}
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const colApps = apps.filter(a => a.status === col.id);
            return (
              <div
                key={col.id}
                className="kanban-col flex flex-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-sm font-semibold ${col.color}`}>
                    {col.title} <span className="text-slate-500 font-normal">({colApps.length})</span>
                  </h3>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {colApps.map((app) => {
                    const followUp = followUpDates[app.id] ?? app.followUpDate;
                    const isOverdue = followUp && followUp < today;
                    const isDueToday = followUp && followUp === today;

                    return (
                      <div
                        key={app.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, app.id)}
                        className="bg-[#263348] border border-[#334155] hover:border-indigo-500/40 rounded-xl p-3 cursor-grab active:cursor-grabbing transition-colors"
                      >
                        <h4 className="text-sm font-semibold text-white mb-1 leading-tight w-full hover:text-indigo-300">
                          {app.job.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
                          <Building2 className="w-3.5 h-3.5" />
                          <span className="truncate">{app.job.organization}</span>
                        </div>

                        {/* Follow-up reminder */}
                        {followUp && (
                          <div className={`rounded px-2 py-1.5 flex items-center justify-between text-[11px] mb-2 border ${
                            isOverdue
                              ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                              : isDueToday
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                              : "bg-[#0f172a] border-slate-700 text-slate-400"
                          }`}>
                            <div className="flex items-center gap-1.5">
                              <Bell className="w-3 h-3" />
                              {isOverdue ? "Overdue: " : isDueToday ? "Today: " : "Follow up: "}
                              {new Date(followUp + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </div>
                            <button onClick={() => handleClearFollowUp(app.id)} className="opacity-60 hover:opacity-100 transition-opacity ml-1">
                              <BellOff className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Set follow-up */}
                        {editingFollowUp === app.id ? (
                          <div className="mb-2 flex gap-1">
                            <input
                              type="date"
                              min={today}
                              defaultValue={followUp ?? ""}
                              className="flex-1 bg-[#0f172a] border border-slate-600 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500"
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setEditingFollowUp(null);
                              }}
                              onChange={(e) => {
                                if (e.target.value) handleSetFollowUp(app.id, e.target.value);
                              }}
                            />
                            <button onClick={() => setEditingFollowUp(null)} className="text-slate-500 hover:text-slate-300 text-[11px] px-1">✕</button>
                          </div>
                        ) : (
                          !followUp && col.id !== "Saved" && col.id !== "Rejected" && col.id !== "Offer" && (
                            <button
                              onClick={() => setEditingFollowUp(app.id)}
                              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-indigo-400 mb-2 transition-colors"
                            >
                              <Bell className="w-3 h-3" /> Set follow-up
                            </button>
                          )
                        )}

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-600/50">
                          <span className="text-[10px] text-slate-500">
                            {col.id === "Saved" ? "Bookmarked" : `Applied ${new Date(app.dateApplied + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                          </span>
                          <Link href={`/jobs/${app.jobId}`} className="text-indigo-400 hover:text-indigo-300 text-[10px] flex items-center gap-0.5">
                            View Job <ArrowUpRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}

                  {colApps.length === 0 && (
                    <div className="flex items-center justify-center h-20 text-slate-600 text-xs text-center border border-dashed border-slate-700/50 rounded-xl">
                      Drop here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
