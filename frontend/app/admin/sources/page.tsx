"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Database, RefreshCw, Search, ShieldCheck } from "lucide-react";

type Source = {
  id: string;
  name: string;
  type: string;
  priority: number;
  parser_version: string;
  cadence_minutes: number;
  health_score: number;
  failure_rate: number;
  status: "healthy" | "degraded" | "unhealthy" | "disabled" | "assist_only";
  enabled?: boolean;
  last_checked_at: string;
  site?: string;
  source_group?: string;
  regions?: string[];
  region_count?: number;
  coverage_count?: number;
};
type SnapshotSummary = {
  registered: number;
  ingestion_connectors?: number;
  enabled_connectors?: number;
  healthy: number;
  degraded: number;
  assist_only: number;
  average_health: number;
  search_catalogs?: number;
  search_sites?: number;
  enabled_search_sites?: number;
  search_regions?: number;
  regions?: string[];
};
type Snapshot = {
  generated_at: string;
  persistence?: string;
  summary: SnapshotSummary;
  policy: { authoritative_types: string[]; search_results_are_job_truth: boolean; search_role: string };
  sources: Source[];
  connectors?: Source[];
  search_coverage?: Source[];
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function SourceHealthPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    setError(false);
    const token = localStorage.getItem("ji_token");
    fetch(`${API}/api/admin/source-health`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (response) => {
        if (!response.ok) throw new Error("source health unavailable");
        setSnapshot(await response.json());
      })
      .catch(() => setError(true));
  }, []);
  useEffect(() => load(), [load]);
  const [actionMessage, setActionMessage] = useState("");
  const adminAction = async (path: string, method: "PATCH" | "POST", body?: object) => {
    const token = localStorage.getItem("ji_token");
    setActionMessage("");
    const response = await fetch(API + "/api/admin/source-health" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      setActionMessage(detail.detail || "Admin action failed");
      return;
    }
    setActionMessage("Action queued and recorded in the audit log.");
    load();
  };

  const connectors = snapshot
    ? snapshot.connectors ?? snapshot.sources.filter((source) => source.type !== "search_seed")
    : [];
  const searchCoverage = snapshot
    ? snapshot.search_coverage ?? snapshot.sources.filter((source) => source.type === "search_seed")
    : [];
  const searchSiteCount = snapshot?.summary.search_sites
    ?? searchCoverage.reduce((total, source) => total + (source.coverage_count ?? 1), 0);
  const searchRegions = snapshot?.summary.regions
    ?? [...new Set(searchCoverage.flatMap((source) => source.regions ?? []))].sort();
  const enabledSearchSiteCount = snapshot?.summary.enabled_search_sites
    ?? searchCoverage.filter((source) => source.enabled !== false).reduce((total, source) => total + (source.coverage_count ?? 1), 0);

  return (
    <main className="md:ml-64 xl:mr-72 px-4 md:px-8 pt-20 md:pt-8 pb-12 min-h-screen">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-400">Operations</p>
          <h1 className="text-2xl font-bold text-white mt-1">Source Health</h1>
          <p className="text-sm text-slate-400 mt-1">Registry, parser versions, crawl posture, and source reliability.</p>
        </div>
        <button onClick={load} className="btn-primary px-4 py-2 text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4" />Refresh</button>
      </div>
      {actionMessage && <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-200">{actionMessage}</div>}

      {error && <div className="card border-rose-500/30 text-sm text-rose-300">Source-health API is unavailable. No operational state has been inferred.</div>}
      {!snapshot && !error && <div className="card h-40 animate-pulse" />}

      {snapshot && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
            {[
              { label: "Connectors", value: snapshot.summary.ingestion_connectors ?? connectors.length, icon: Database },
              { label: "Healthy", value: snapshot.summary.healthy, icon: CheckCircle2 },
              { label: "Degraded", value: snapshot.summary.degraded, icon: AlertTriangle },
              { label: "Search sites", value: searchSiteCount, icon: Search },
              { label: "Regions", value: snapshot.summary.search_regions ?? searchRegions.length, icon: ShieldCheck },
              { label: "Avg health", value: `${snapshot.summary.average_health}%`, icon: Activity },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="card p-4"><Icon className="w-4 h-4 text-cyan-400 mb-3" /><p className="text-2xl font-bold text-white">{value}</p><p className="text-xs text-slate-500">{label}</p></div>
            ))}
          </div>

          <div className="card mb-5 flex items-start gap-3 border-cyan-500/20">
            <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0" />
            <div><p className="text-sm font-semibold text-white">Authoritative-source policy active</p><p className="text-xs text-slate-400 mt-1">Search results are never jobs of record. Search is used for {snapshot.policy.search_role}.</p></div>
          </div>

          <div className="mb-3">
            <h2 className="text-base font-semibold text-white">Ingestion connectors</h2>
            <p className="text-xs text-slate-500 mt-1">Sources that fetch and parse canonical job records.</p>
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-left min-w-[980px]">
              <thead><tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="p-4">Source</th><th className="p-4">Type</th><th className="p-4">Priority</th><th className="p-4">Parser</th><th className="p-4">Cadence</th><th className="p-4">Health</th><th className="p-4">Failures</th><th className="p-4">State</th><th className="p-4">Controls</th>
              </tr></thead>
              <tbody>{connectors.map((source) => (
                <tr key={source.id} className="border-b border-white/5 text-sm">
                  <td className="p-4 font-medium text-white">{source.name}</td><td className="p-4 text-slate-400">{source.type}</td><td className="p-4 text-slate-300">{source.priority}</td><td className="p-4 font-mono text-xs text-slate-400">{source.parser_version}</td><td className="p-4 text-slate-400">{source.cadence_minutes}m</td><td className="p-4 text-white">{source.health_score}%</td><td className="p-4 text-slate-400">{source.failure_rate}%</td>
                  <td className="p-4"><span className={`text-xs px-2 py-1 rounded-full ${source.status === "healthy" ? "bg-emerald-500/10 text-emerald-300" : source.status === "degraded" ? "bg-amber-500/10 text-amber-300" : "bg-slate-500/10 text-slate-300"}`}>{source.status.replace("_", " ")}</span></td>
                  <td className="p-4">
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => adminAction("/sources/" + source.id, "PATCH", { enabled: source.enabled === false })}
                        className="rounded-lg border border-slate-600 px-2 py-1 text-[10px] font-semibold text-slate-300"
                      >
                        {source.enabled === false ? "Enable" : "Disable"}
                      </button>
                      <button
                        type="button"
                        disabled={source.enabled === false}
                        onClick={() => adminAction("/sources/" + source.id + "/rerun", "POST")}
                        className="rounded-lg border border-cyan-500/25 px-2 py-1 text-[10px] font-semibold text-cyan-300 disabled:opacity-40"
                      >
                        Rerun
                      </button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="mt-8 mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Search coverage</h2>
              <p className="text-xs text-slate-500 mt-1">Discovery seeds expand career-endpoint coverage; they never create jobs of record.</p>
            </div>
            <div className="flex gap-2 text-[10px] text-slate-400"><span className="rounded-full border border-slate-700 px-2 py-1">{enabledSearchSiteCount} enabled / {searchSiteCount} sites</span><span className="rounded-full border border-slate-700 px-2 py-1">{searchRegions.length} regions</span></div>
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-left min-w-[760px]">
              <thead><tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-500"><th className="p-4">Catalog / site</th><th className="p-4">Group</th><th className="p-4">Regions</th><th className="p-4">Coverage</th><th className="p-4">State</th><th className="p-4">Control</th></tr></thead>
              <tbody>
                {searchCoverage.map((source) => (
                  <tr key={source.id} className="border-b border-white/5 text-sm">
                    <td className="p-4"><div className="font-medium text-white">{source.name}</div><div className="mt-1 max-w-xs truncate font-mono text-[10px] text-slate-500">{source.site}</div></td>
                    <td className="p-4 text-slate-400">{(source.source_group ?? "job_board").replace("_", " ")}</td>
                    <td className="p-4"><div className="flex max-w-sm flex-wrap gap-1">{(source.regions ?? ["GLOBAL"]).map((region) => <span key={region} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">{region}</span>)}</div></td>
                    <td className="p-4 text-slate-300">{source.coverage_count ?? 1} {(source.coverage_count ?? 1) === 1 ? "site" : "sites"}</td>
                    <td className="p-4"><span className={"text-xs px-2 py-1 rounded-full " + (source.status === "disabled" ? "bg-slate-500/10 text-slate-400" : "bg-indigo-500/10 text-indigo-300")}>{source.status.replace("_", " ")}</span></td>
                    <td className="p-4">
                      <button type="button" onClick={() => adminAction("/sources/" + source.id, "PATCH", { enabled: source.enabled === false })} className="rounded-lg border border-slate-600 px-2 py-1 text-[10px] font-semibold text-slate-300">{source.enabled === false ? "Enable" : "Disable"}</button>
                    </td>
                  </tr>
                ))}
                {searchCoverage.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-xs text-slate-500">No search coverage seeds are registered.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-600 mt-3">Snapshot generated {new Date(snapshot.generated_at).toLocaleString()} ? Runtime projection; durable run history is defined in the enterprise migration.</p>
        </>
      )}
    </main>
  );
}
