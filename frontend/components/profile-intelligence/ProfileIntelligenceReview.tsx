"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  FileCheck2,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

type TrustState = "explicit" | "inferred" | "needs-review";

export interface ProfileIntelligenceData {
  name: string;
  currentRole: string;
  currentSalary: string;
  currency: string;
  experienceYears: string;
  workMode: string;
  currentLocation: string;
  preferredLocations: string[];
  skills: string[];
  frameworks: string[];
  languages: string[];
  cicdTools: string[];
  aiTools: string[];
  certifications: string[];
  resumeText: string;
}


interface PersistedFact {
  id: string;
  fact_type: string;
  value: { label?: string; value?: string | number };
  trust_state: "explicit" | "inferred" | "needs_review";
  source_type: string;
  review_status: "pending" | "approved" | "rejected";
}

interface IntelligenceResponse {
  coverage: {
    total_facts: number;
    approved_facts: number;
    needs_review: number;
    evidence_coverage_pct: number;
    review_coverage_pct: number;
  };
  facts: PersistedFact[];
  snapshots: Array<{ id: string; label: string; version: number; created_at?: string }>;
  variants: Array<{ id: string; name: string; status: string }>;
}

interface Props {
  profile: ProfileIntelligenceData;
  onEdit: () => void;
}

const trustStyles: Record<TrustState, { label: string; classes: string }> = {
  explicit: {
    label: "User provided",
    classes: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  },
  inferred: {
    label: "Inferred",
    classes: "border-indigo-500/25 bg-indigo-500/10 text-indigo-300",
  },
  "needs-review": {
    label: "Needs review",
    classes: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  },
};

function TrustBadge({ state }: { state: TrustState }) {
  const trust = trustStyles[state];
  return (
    <span className={"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold " + trust.classes}>
      {state === "explicit" ? <CheckCircle2 className="h-3 w-3" /> : state === "inferred" ? <Sparkles className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {trust.label}
    </span>
  );
}

function normalise(items: string[]) {
  return [...new Map(items.filter(Boolean).map((item) => [item.trim().toLocaleLowerCase(), item.trim()])).values()]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function score(profile: ProfileIntelligenceData) {
  const technicalFacts = normalise([
    ...profile.skills,
    ...profile.frameworks,
    ...profile.languages,
    ...profile.cicdTools,
    ...profile.aiTools,
  ]);
  const hasResume = Boolean(profile.resumeText.trim());
  const coreFields = [
    profile.name,
    profile.currentRole,
    profile.experienceYears,
    profile.currentLocation,
    profile.preferredLocations.length ? "yes" : "",
    profile.workMode !== "Any" ? profile.workMode : "",
    technicalFacts.length >= 3 ? "yes" : "",
    hasResume ? "yes" : "",
  ];
  const completeness = Math.round((coreFields.filter(Boolean).length / coreFields.length) * 100);
  const readiness = Math.min(100,
    (profile.currentRole.trim() ? 15 : 0) +
    (Number(profile.experienceYears) > 0 ? 15 : 0) +
    (profile.currentLocation.trim() ? 10 : 0) +
    (profile.preferredLocations.length > 0 || profile.workMode !== "Any" ? 10 : 0) +
    Math.min(25, technicalFacts.length * 2.5) +
    (hasResume ? 20 : 0) +
    (profile.certifications.length > 0 ? 5 : 0)
  );
  return { completeness, readiness: Math.round(readiness), technicalFacts, hasResume };
}

function Meter({ label, value, state, helper }: { label: string; value: number; state: TrustState; helper: string }) {
  const color = value >= 80 ? "#10b981" : value >= 55 ? "#6366f1" : "#f59e0b";
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-950/25 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-200">{label}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{helper}</p>
        </div>
        <TrustBadge state={state} />
      </div>
      <div className="flex items-end gap-3">
        <span className="text-3xl font-bold" style={{ color }}>{value}%</span>
        <div className="mb-1.5 h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: String(value) + "%", background: color }} />
        </div>
      </div>
    </div>
  );
}

function FactRow({ label, value, state = "explicit" }: { label: string; value: string; state?: TrustState }) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-slate-800/70 py-2.5 last:border-0 sm:flex-row sm:items-center">
      <span className="w-36 shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className={"min-w-0 flex-1 text-sm " + (value === "Not provided" ? "italic text-slate-600" : "text-slate-200")}>{value}</span>
      <TrustBadge state={state} />
    </div>
  );
}

function FactGroup({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="card px-4 py-3.5">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
        <Icon className="h-4 w-4 text-indigo-400" /> {title}
      </h3>
      {children}
    </section>
  );
}

function EvidenceTags({ label, items }: { label: string; items: string[] }) {
  const values = normalise(items);
  return (
    <div className="flex flex-col gap-2 border-b border-slate-800/70 py-3 last:border-0 sm:flex-row sm:items-start">
      <div className="w-36 shrink-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <div className="mt-1.5"><TrustBadge state="needs-review" /></div>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {values.length ? values.map((item) => (
          <span key={item} className="rounded-full border border-slate-700 bg-slate-800/70 px-2 py-1 text-[11px] font-medium text-slate-300">{item}</span>
        )) : <span className="text-sm italic text-slate-600">Not provided</span>}
      </div>
    </div>
  );
}

export default function ProfileIntelligenceReview({ profile, onEdit }: Props) {
  const summary = score(profile);
  const [intelligence, setIntelligence] = useState<IntelligenceResponse | null>(null);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";

  const refreshIntelligence = useCallback(async () => {
    if (!apiBase) return;
    const token = window.localStorage.getItem("ji_token");
    if (!token) return;
    try {
      const response = await fetch(apiBase + "/api/profile/intelligence", {
        headers: { Authorization: "Bearer " + token },
      });
      if (response.ok) setIntelligence(await response.json());
    } catch {
      // The source profile remains usable while the API is offline.
    }
  }, [apiBase]);

  useEffect(() => {
    void refreshIntelligence();
  }, [refreshIntelligence]);

  const reviewFact = async (factId: string, reviewStatus: "approved" | "rejected") => {
    const token = window.localStorage.getItem("ji_token");
    if (!apiBase || !token) return;
    setEvidenceBusy(true);
    try {
      const response = await fetch(apiBase + "/api/profile/intelligence/facts/" + factId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ review_status: reviewStatus }),
      });
      if (response.ok) await refreshIntelligence();
    } finally {
      setEvidenceBusy(false);
    }
  };

  const captureSnapshot = async () => {
    const token = window.localStorage.getItem("ji_token");
    if (!apiBase || !token) return;
    setEvidenceBusy(true);
    try {
      const response = await fetch(apiBase + "/api/profile/intelligence/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ label: "Reviewed profile", kind: "base" }),
      });
      if (response.ok) await refreshIntelligence();
    } finally {
      setEvidenceBusy(false);
    }
  };

  const salary = Number(profile.currentSalary) > 0
    ? profile.currency + " " + Number(profile.currentSalary).toLocaleString()
    : "Not provided";
  const gaps = [
    !summary.hasResume ? "Add a resume as source material for role-specific analysis." : "",
    summary.technicalFacts.length < 3 ? "Add at least three skills you can support with real work examples." : "",
    profile.preferredLocations.length === 0 && profile.workMode === "Any" ? "Clarify location or work-mode preferences to improve filtering." : "",
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden p-0">
        <div className="border-b border-slate-700/60 bg-gradient-to-r from-indigo-500/10 via-cyan-500/5 to-transparent px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-400">
                <ShieldCheck className="h-4 w-4" /> Profile Intelligence
              </div>
              <h2 className="text-xl font-bold text-white">Evidence review</h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">Review what the platform knows before it is used for matching or resume tailoring.</p>
            </div>
            <button type="button" onClick={onEdit} className="btn-secondary shrink-0 px-3 py-2 text-xs">Edit source profile</button>
          </div>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2">
          <Meter label="Profile completeness" value={summary.completeness} state="explicit" helper="Coverage of core fields used by search and matching." />
          <Meter label="Market-readiness coverage" value={summary.readiness} state="inferred" helper="An evidence-coverage signal, not a hiring or salary prediction." />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2 px-1 text-[11px] text-slate-500">
        <span className="mr-1">Trust labels:</span>
        <TrustBadge state="explicit" /><TrustBadge state="inferred" /><TrustBadge state="needs-review" />
      </div>
      {intelligence && (
        <section className="card px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Persisted evidence ledger</h3>
              <p className="mt-1 text-xs text-slate-400">
                {intelligence.coverage.approved_facts} of {intelligence.coverage.total_facts} facts approved
                {" ? "}{intelligence.coverage.needs_review} need review
                {" ? "}{intelligence.snapshots.length} immutable snapshots
              </p>
            </div>
            <button type="button" onClick={captureSnapshot} disabled={evidenceBusy} className="btn-secondary px-3 py-2 text-xs">
              Capture snapshot
            </button>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: intelligence.coverage.review_coverage_pct + "%" }} />
          </div>
          {intelligence.facts.some((fact) => fact.review_status === "pending") && (
            <div className="mt-4 space-y-2">
              {intelligence.facts.filter((fact) => fact.review_status === "pending").slice(0, 6).map((fact) => (
                <div key={fact.id} className="flex flex-col gap-2 rounded-lg border border-slate-700/60 bg-slate-950/30 p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{fact.fact_type.replaceAll("_", " ")}</p>
                    <p className="truncate text-sm text-slate-200">{String(fact.value.label ?? fact.value.value ?? "Evidence fact")}</p>
                    <p className="text-[10px] text-slate-500">Source: {fact.source_type}</p>
                  </div>
                  <TrustBadge state={fact.trust_state === "needs_review" ? "needs-review" : fact.trust_state} />
                  <div className="flex gap-1.5">
                    <button type="button" disabled={evidenceBusy} onClick={() => reviewFact(fact.id, "approved")} className="rounded-lg border border-emerald-500/25 px-2 py-1 text-[10px] font-semibold text-emerald-300">Approve</button>
                    <button type="button" disabled={evidenceBusy} onClick={() => reviewFact(fact.id, "rejected")} className="rounded-lg border border-rose-500/25 px-2 py-1 text-[10px] font-semibold text-rose-300">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}



      <div className="grid gap-4 lg:grid-cols-2">
        <FactGroup title="Identity & career" icon={UserRound}>
          <FactRow label="Name" value={profile.name || "Not provided"} />
          <FactRow label="Current role" value={profile.currentRole || "Not provided"} />
          <FactRow label="Experience" value={Number(profile.experienceYears) > 0 ? profile.experienceYears + " years" : "Not provided"} />
          <FactRow label="Current salary" value={salary} />
        </FactGroup>
        <FactGroup title="Work preferences" icon={MapPin}>
          <FactRow label="Current location" value={profile.currentLocation || "Not provided"} />
          <FactRow label="Work mode" value={profile.workMode || "Any"} />
          <FactRow label="Target locations" value={normalise(profile.preferredLocations).join(", ") || "Not provided"} />
        </FactGroup>
      </div>

      <FactGroup title="Normalised capability facts" icon={BriefcaseBusiness}>
        <EvidenceTags label="Skills" items={profile.skills} />
        <EvidenceTags label="Frameworks" items={profile.frameworks} />
        <EvidenceTags label="Languages" items={profile.languages} />
        <EvidenceTags label="CI/CD & DevOps" items={profile.cicdTools} />
        <EvidenceTags label="AI tools" items={profile.aiTools} />
        <EvidenceTags label="Certifications" items={profile.certifications} />
        <p className="pt-2 text-[11px] leading-relaxed text-slate-500">Capability claims need review because the current profile does not store field-level project, employment, or credential evidence.</p>
      </FactGroup>

      <section className="card px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-2"><FileCheck2 className="h-4 w-4 text-cyan-300" /></div>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-white">Truthful tailoring guardrail</h3><TrustBadge state="explicit" /></div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">Tailoring may reorganise or clarify supported facts. It must not invent employers, dates, degrees, certifications, skills, responsibilities, or measurable outcomes. Review every generated claim before applying.</p>
          </div>
        </div>
      </section>

      {gaps.length > 0 && <section className="card border-amber-500/20 px-4 py-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><AlertTriangle className="h-4 w-4 text-amber-400" /> Evidence gaps to review</h3>
        <ul className="mt-3 space-y-2">
          {gaps.map((gap) => <li key={gap} className="flex items-start gap-2 text-xs text-slate-400"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />{gap}</li>)}
        </ul>
      </section>}
    </div>
  );
}
