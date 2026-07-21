"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";

export type DiscoveryFilterState = {
  sourceQuality: "all" | "high" | "known";
  freshnessHours: number | null;
  verification: "all" | "VERIFIED" | "PENDING" | "UNVERIFIED";
  minConfidence: number;
  salaryOnly: boolean;
};

export const DEFAULT_DISCOVERY_FILTERS: DiscoveryFilterState = {
  sourceQuality: "all",
  freshnessHours: null,
  verification: "all",
  minConfidence: 0,
  salaryOnly: false,
};

type Props = {
  value: DiscoveryFilterState;
  onChange: (next: DiscoveryFilterState) => void;
  resultCount: number;
  totalCount: number;
};

export default function DiscoveryFilters({ value, onChange, resultCount, totalCount }: Props) {
  const update = <K extends keyof DiscoveryFilterState>(key: K, next: DiscoveryFilterState[K]) => onChange({ ...value, [key]: next });
  const activeCount = [value.sourceQuality !== "all", value.freshnessHours !== null, value.verification !== "all", value.minConfidence > 0, value.salaryOnly].filter(Boolean).length;

  return (
    <section className="card mb-6 px-4 py-4" aria-label="Result quality filters">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-indigo-300" />
          <div>
            <h2 className="text-sm font-semibold text-white">Trust and quality filters</h2>
            <p className="text-xs text-slate-500">Narrow the loaded results without running a new search.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="font-medium text-slate-300">{resultCount} of {totalCount} shown</span>
          {activeCount > 0 && (
            <button type="button" onClick={() => onChange(DEFAULT_DISCOVERY_FILTERS)} className="inline-flex items-center gap-1 text-indigo-300 transition-colors hover:text-indigo-200">
              <RotateCcw className="h-3 w-3" /> Clear {activeCount}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <FilterSelect label="Source quality" value={value.sourceQuality} onChange={(next) => update("sourceQuality", next as DiscoveryFilterState["sourceQuality"])} options={[["all", "All sources"], ["known", "Known sources+"], ["high", "Direct / ATS only"]]} />
        <FilterSelect label="Freshness" value={value.freshnessHours?.toString() ?? "all"} onChange={(next) => update("freshnessHours", next === "all" ? null : Number(next))} options={[["all", "Any date"], ["24", "Last 24 hours"], ["72", "Last 3 days"], ["168", "Last 7 days"]]} />
        <FilterSelect label="Verification" value={value.verification} onChange={(next) => update("verification", next as DiscoveryFilterState["verification"])} options={[["all", "Any status"], ["VERIFIED", "Verified"], ["PENDING", "Pending review"], ["UNVERIFIED", "Unverified"]]} />
        <FilterSelect label="Minimum confidence" value={value.minConfidence.toString()} onChange={(next) => update("minConfidence", Number(next))} options={[["0", "Any confidence"], ["50", "50%+"], ["70", "70%+"], ["85", "85%+"]]} />
        <label className="flex min-h-[42px] cursor-pointer items-center gap-2 self-end rounded-xl border border-slate-700/70 bg-slate-900/40 px-3 text-sm text-slate-300 transition-colors hover:border-slate-600">
          <input type="checkbox" checked={value.salaryOnly} onChange={(event) => update("salaryOnly", event.target.checked)} className="h-4 w-4 accent-indigo-500" />
          Salary disclosed
        </label>
      </div>
      {value.minConfidence > 0 && <p className="mt-2 text-[11px] text-slate-500">When extraction confidence is unavailable, a clearly marked estimate based on verification, provenance, and recency is used.</p>}
    </section>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <select className="input min-h-[42px]" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}
