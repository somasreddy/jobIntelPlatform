"use client";
import Navbar from "@/components/Navbar";
import { mockApplications } from "@/lib/mockData";
import { ApplicationStatus } from "@/lib/types";
import { Building2, Calendar, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

const COLUMNS: { id: ApplicationStatus; title: string; color: string }[] = [
  { id: "Saved", title: "Saved", color: "text-slate-400" },
  { id: "Applied", title: "Applied", color: "text-indigo-400" },
  { id: "Assessment", title: "Assessment", color: "text-amber-400" },
  { id: "Interview", title: "Interview", color: "text-cyan-400" },
  { id: "Offer", title: "Offer", color: "text-emerald-400" },
  { id: "Rejected", title: "Rejected", color: "text-rose-400" },
];

export default function TrackerPage() {
  const [apps, setApps] = useState(mockApplications);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;
    fetch(`${apiUrl}/api/applications/`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setApps(data);
      })
      .catch(() => {});
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

  return (
    <div className="flex min-h-screen bg-transparent">
      <Navbar />
      <main className="ml-64 flex-1 px-8 py-8 flex flex-col h-screen overflow-hidden">
        <div className="mb-6 shrink-0">
          <h1 className="text-2xl font-bold text-white">Application Tracker</h1>
          <p className="text-slate-400 text-sm mt-1">
            Drag and drop to track your progress across active job applications.
          </p>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <div
              key={col.id}
              className="kanban-col flex flex-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-sm font-semibold ${col.color}`}>
                  {col.title} <span className="text-slate-500 font-normal">({apps.filter(a => a.status === col.id).length})</span>
                </h3>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {apps
                  .filter((a) => a.status === col.id)
                  .map((app) => (
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
                      
                      {app.followUpDate && (
                        <div className="bg-[#0f172a] rounded px-2 py-1.5 flex items-center gap-1.5 text-[11px] text-amber-400 mb-2 border border-slate-700">
                          <Calendar className="w-3 h-3" />
                          Follow up: {new Date(app.followUpDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-600/50">
                        <span className="text-[10px] text-slate-500">
                          Applied {new Date(app.dateApplied).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        <Link href={`/jobs/${app.jobId}`} className="text-indigo-400 hover:text-indigo-300 text-[10px] flex items-center gap-0.5">
                          View Job <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
