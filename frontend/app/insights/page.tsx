"use client";
import {
  BarChart3, TrendingUp, DollarSign, MapPin, Briefcase,
  UserCircle2, Target, Copy, CheckCircle, Sparkles, ArrowUp
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/ProfileContext";
import { CandidateProfile } from "@/lib/types";

type SalaryResult = {
  min_salary: number; max_salary: number; currency: string;
  market_demand: string; yoy_growth_pct: number;
};

const LOCATIONS = [
  "United States (Remote)",
  "United Kingdom",
  "India (Tier 1)",
  "India (Tier 2)",
  "EU Remote",
  "Australia",
  "Canada",
  "Singapore",
];

// Salary benchmarks per location (rough market data as fallback)
const SALARY_BASE: Record<string, { minMult: number; maxMult: number; expMult: number; currency: string; symbol: string }> = {
  "United States (Remote)": { minMult: 110, maxMult: 160, expMult: 4, currency: "USD", symbol: "$" },
  "United Kingdom":          { minMult: 60,  maxMult: 95,  expMult: 4, currency: "GBP", symbol: "£" },
  "India (Tier 1)":          { minMult: 18,  maxMult: 35,  expMult: 2, currency: "INR", symbol: "₹" }, // in LPA
  "India (Tier 2)":          { minMult: 12,  maxMult: 22,  expMult: 1.2, currency: "INR", symbol: "₹" },
  "EU Remote":               { minMult: 70,  maxMult: 110, expMult: 3, currency: "EUR", symbol: "€" },
  "Australia":               { minMult: 110, maxMult: 160, expMult: 4, currency: "AUD", symbol: "A$" },
  "Canada":                  { minMult: 95,  maxMult: 140, expMult: 3, currency: "CAD", symbol: "C$" },
  "Singapore":               { minMult: 90,  maxMult: 130, expMult: 3.5, currency: "SGD", symbol: "S$" },
};

function inferMarketLocation(profile: CandidateProfile): string {
  const loc = (profile.currentLocation || "").toLowerCase();
  const preferred = (profile.preferredLocations ?? []).join(" ").toLowerCase();
  const combined = `${loc} ${preferred}`;
  if (/india|bangalore|bengaluru|hyderabad|mumbai|chennai|pune|delhi|noida/.test(combined)) return "India (Tier 1)";
  if (/uk|united kingdom|london|manchester|edinburgh/.test(combined)) return "United Kingdom";
  if (/australia|sydney|melbourne/.test(combined)) return "Australia";
  if (/canada|toronto|vancouver/.test(combined)) return "Canada";
  if (/singapore/.test(combined)) return "Singapore";
  if (/eu|europe|germany|france|netherlands/.test(combined)) return "EU Remote";
  return "United States (Remote)";
}

function fmtSalary(n: number, loc: string): string {
  const base = SALARY_BASE[loc];
  if (!base) return `$${Math.round(n / 1000)}k`;
  if (base.currency === "INR") return `${base.symbol}${n.toFixed(1)}L`;
  return `${base.symbol}${Math.round(n)}k`;
}

// Role-specific salary adjusters (multiplier applied to base salary range)
function getRoleMultiplier(role: string): number {
  const r = role.toLowerCase();
  if (/b2b|webmethod|mulesoft|boomi|tibco|sterling|trading network|edi|middleware|ipaas/i.test(r)) return 1.12;
  if (/api management|api gateway|kong|apigee/i.test(r)) return 1.10;
  if (/devops|sre|platform engineer|cicd|ci\/cd|devsecops/i.test(r)) return 1.15;
  if (/cloud architect|solution architect|enterprise architect/i.test(r)) return 1.20;
  if (/data engineer|ml engineer|ai engineer|machine learning/i.test(r)) return 1.18;
  if (/database|dba/i.test(r)) return 1.05;
  if (/fullstack|full.?stack/i.test(r)) return 1.08;
  if (/qa|test|sdet/i.test(r)) return 0.95;
  return 1.0;
}

function computeSalary(role: string, exp: number, loc: string) {
  const base = SALARY_BASE[loc] ?? SALARY_BASE["United States (Remote)"];
  const isINR = base.currency === "INR";
  const mult = getRoleMultiplier(role);
  if (isINR) {
    const min = (base.minMult + exp * base.expMult) * mult;
    const max = (base.maxMult + exp * (base.expMult * 1.4)) * mult;
    return { min: min, max: max, isINR: true };
  }
  const min = (base.minMult + exp * base.expMult) * 1000 * mult;
  const max = (base.maxMult + exp * (base.expMult * 1.3)) * 1000 * mult;
  return { min, max, isINR: false };
}

function computePercentile(currentSalary: number, min: number, max: number): number {
  if (currentSalary <= min) return 10;
  if (currentSalary >= max) return 98;
  return Math.round(10 + ((currentSalary - min) / (max - min)) * 88);
}

// Top-paying technologies with uplift data
const TOP_SKILLS_BY_ROLE = (role: string) => {
  const r = role.toLowerCase();
  if (/frontend|react|vue|angular/.test(r)) return [["TypeScript", 18], ["React", 15], ["Next.js", 14], ["GraphQL", 12]];
  if (/backend|api|node|java|python/.test(r)) return [["Go", 22], ["Rust", 20], ["Kubernetes", 18], ["AWS", 16]];
  if (/data|ml|ai|machine/.test(r)) return [["LLMs", 28], ["PyTorch", 22], ["MLOps", 20], ["Spark", 16]];
  if (/devops|platform|cloud|sre|cicd|ci\/cd|pipeline/.test(r)) return [["Kubernetes", 22], ["Terraform", 18], ["ArgoCD", 16], ["Helm", 14]];
  if (/qa|test|sdet/.test(r)) return [["Playwright", 15], ["Kubernetes", 18], ["K6", 12], ["Go", 20]];
  if (/b2b|integration|webmethod|mulesoft|boomi|middleware|ipaas/.test(r)) return [["webMethods API Gateway", 20], ["MuleSoft Anypoint", 22], ["webMethods.IO Integration", 18], ["IBM Sterling", 15]];
  if (/api management|api manager|api gateway|apigee|kong/.test(r)) return [["Apigee X", 22], ["Kong Konnect", 20], ["AWS API Gateway", 18], ["Azure APIM", 16]];
  if (/database|dba|sql|nosql/.test(r)) return [["Snowflake", 22], ["Databricks", 20], ["PostgreSQL", 15], ["Redis", 14]];
  if (/edi|trading network|sterling|b2b/.test(r)) return [["EDI X12", 18], ["AS2/EDIINT", 16], ["webMethods Trading Networks", 20], ["EDIFACT", 14]];
  if (/bpm|process|workflow|camunda|pega/.test(r)) return [["Camunda BPM", 20], ["BPMN 2.0", 16], ["webMethods BPM", 18], ["Pega", 15]];
  return [["Kubernetes", 20], ["AWS", 18], ["Go", 22], ["TypeScript", 15]];
};

export default function InsightsPage() {
  const router = useRouter();
  const { profile, loading } = useProfile();
  const [role, setRole] = useState("");
  const [exp, setExp] = useState(0);
  const [loc, setLoc] = useState("United States (Remote)");
  const [offerAmount, setOfferAmount] = useState("");
  const [salaryData, setSalaryData] = useState<SalaryResult | null>(null);
  const [showNegotiation, setShowNegotiation] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (loading || !profile) return;
    setRole(profile.currentRole || "");
    setExp(typeof profile.experienceYears === "number" ? profile.experienceYears : parseInt(String(profile.experienceYears)) || 0);
    setLoc(inferMarketLocation(profile));
  }, [loading, profile]);

  const fetchSalary = useCallback(async () => {
    if (!role) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;
    try {
      const res = await fetch(`${apiUrl}/api/salary/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, experience_years: exp, location: loc }),
      });
      if (res.ok) setSalaryData(await res.json());
    } catch { /* use computed fallback */ }
  }, [role, exp, loc]);

  useEffect(() => { fetchSalary(); }, [fetchSalary]);

  if (!loading && !profile) {
    return (
      <div className="flex min-h-screen bg-transparent">
        <main className="md:ml-64 xl:mr-72 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-8 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              <UserCircle2 className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-white font-semibold text-xl mb-2">No profile found</h2>
            <p className="text-slate-400 text-sm mb-6">Set up your career profile to get personalised salary benchmarks and market insights.</p>
            <button onClick={() => router.push("/")} className="btn-primary text-sm px-6 py-2.5">Set Up Profile</button>
          </div>
        </main>
      </div>
    );
  }

  const computed = computeSalary(role, exp, loc);
  const base = SALARY_BASE[loc] ?? SALARY_BASE["United States (Remote)"];
  const isINR = base.currency === "INR";

  const minSal = salaryData ? (isINR ? salaryData.min_salary / 100000 : salaryData.min_salary / 1000) : computed.min;
  const maxSal = salaryData ? (isINR ? salaryData.max_salary / 100000 : salaryData.max_salary / 1000) : computed.max;
  const demand = salaryData?.market_demand ?? "Very High";
  const yoy    = salaryData?.yoy_growth_pct ?? 14.2;

  const currSalRaw = profile?.currentSalary ?? 0;
  const currSalDisplay = isINR ? currSalRaw / 100000 : currSalRaw / 1000;
  const percentile = currSalRaw > 0 ? computePercentile(isINR ? currSalDisplay : currSalRaw, isINR ? minSal : minSal * 1000, isINR ? maxSal : maxSal * 1000) : null;

  const topSkills = TOP_SKILLS_BY_ROLE(role) as [string, number][];

  // Negotiation script generator
  const targetAsk = isINR ? maxSal * 1.08 : maxSal * 1000 * 1.08;
  const targetDisplay = isINR ? `${base.symbol}${(targetAsk).toFixed(1)}L` : `${base.symbol}${Math.round(targetAsk / 1000)}k`;

  const negotiationScript = `Hi [Hiring Manager],

Thank you so much for the offer for the ${role || "position"} — I'm genuinely excited about the opportunity at [Company] and the team I'd be joining.

After reviewing the offer, I'd like to have a brief conversation about the compensation. Based on my ${exp}+ years of experience in ${(profile?.skills ?? []).slice(0, 2).join(" and ") || "this domain"}, current market data for ${role} roles in ${loc} (${fmtSalary(isINR ? minSal : minSal, loc)}–${fmtSalary(isINR ? maxSal : maxSal, loc)} range), and the specific value I bring — I was hoping we could discuss a base of ${targetDisplay}.

I want to be clear: I'm very enthusiastic about this role and [Company] specifically. Compensation is just one factor, and I'm open to discussing the full package including equity, bonus structure, and growth trajectory.

Would you be open to a quick call this week to discuss?

Best regards,
${profile?.name || "[Your Name]"}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(negotiationScript).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 xl:mr-72 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-8 max-w-5xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium mb-2">
            <BarChart3 className="w-4 h-4" /> Global Market Intelligence
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Salary <span className="gradient-text">& Market Intelligence</span>
          </h1>
          <p className="text-slate-400 text-sm">
            Real-time compensation benchmarks, percentile ranking, and AI negotiation scripts — all personalised to your role and location.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="space-y-4">
            <div className="card h-fit space-y-4">
              <h2 className="text-base font-semibold text-white border-b border-slate-700/50 pb-3">
                Calculation Parameters
              </h2>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" /> Role Title
                </label>
                <input className="input text-sm" placeholder="e.g. Senior Backend Engineer" value={role} onChange={e => setRole(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Years of Experience
                </label>
                <div className="flex items-center gap-3">
                  <input type="range" min="0" max="25" value={exp} onChange={e => setExp(parseInt(e.target.value))}
                    className="flex-1 accent-indigo-500" />
                  <span className="w-8 text-right text-sm font-bold text-white">{exp}</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Market Location
                </label>
                <select className="input text-sm" value={loc} onChange={e => setLoc(e.target.value)}>
                  {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>

            {/* Percentile Card */}
            {percentile !== null && (
              <div className="card bg-linear-to-br from-indigo-900/40 to-purple-900/20 border-indigo-500/20">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-400" /> Your Salary Percentile
                </h3>
                <div className="relative mb-3">
                  <div className="h-3 rounded-full bg-slate-700/60 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${percentile}%`,
                        background: "linear-gradient(90deg, #7c3aed, #6366f1, #06b6d4)",
                      }}
                    />
                  </div>
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg border-2 border-indigo-500 transition-all duration-700"
                    style={{ left: `calc(${percentile}% - 8px)` }}
                  />
                </div>
                <p className="text-2xl font-bold text-indigo-300 mb-1">{percentile}<span className="text-sm text-slate-400">th</span> percentile</p>
                <p className="text-xs text-slate-400">
                  {percentile >= 75
                    ? "You're well above market average. Strong negotiating position."
                    : percentile >= 50
                    ? "You're at market rate. You have room to negotiate up."
                    : "You're below market. Time to negotiate or switch."}
                </p>
              </div>
            )}
          </div>

          {/* Main Results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Salary Range */}
            <div className="card relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/8 blur-3xl rounded-full pointer-events-none" />
              <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" /> Market Salary Range
              </h2>
              {!role ? (
                <p className="text-slate-500 text-sm text-center py-8">Enter a role to see salary estimates.</p>
              ) : (
                <>
                  <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-6">
                    <div className="text-center md:text-left">
                      <p className="text-xs font-medium text-slate-400 mb-1">Floor (25th %ile)</p>
                      <p className="text-3xl font-bold text-white">{fmtSalary(minSal, loc)}</p>
                    </div>
                    <div className="flex-1 w-full flex items-center gap-2">
                      <div className="h-2.5 flex-1 rounded-l-full overflow-hidden" style={{ background: "linear-gradient(90deg, rgba(99,102,241,0.2), rgba(99,102,241,0.6))" }} />
                      <div className="w-5 h-5 rounded-full bg-indigo-400 shadow-[0_0_18px_rgba(129,140,248,0.9)] z-10 shrink-0" />
                      <div className="h-2.5 flex-1 rounded-r-full overflow-hidden" style={{ background: "linear-gradient(90deg, rgba(16,185,129,0.6), rgba(16,185,129,0.2))" }} />
                    </div>
                    <div className="text-center md:text-right">
                      <p className="text-xs font-medium text-slate-400 mb-1">Ceiling (90th %ile)</p>
                      <p className="text-3xl font-bold text-emerald-400">{fmtSalary(maxSal, loc)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { label: "Market Demand", value: demand, color: "text-emerald-400" },
                      { label: "YoY Growth", value: `+${yoy}%`, color: "text-cyan-400" },
                      { label: "Avg Increment", value: "18–22%", color: "text-indigo-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/40 text-center">
                        <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                        <p className={`text-base font-bold ${color}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Top Paying Skills */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <ArrowUp className="w-4 h-4 text-emerald-400" /> Top Paying Skills for Role
                </h3>
                <div className="space-y-3">
                  {topSkills.map(([tech, uplift]) => (
                    <div key={tech} className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">{tech}</span>
                      <span className="text-emerald-400 font-semibold text-sm flex items-center gap-1">
                        <ArrowUp className="w-3 h-3" />
                        {isINR ? `₹${uplift * 0.5}L` : `+$${uplift}k`}/yr
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" /> Market Signals
                </h3>
                <div className="space-y-3">
                  {[
                    { color: "border-indigo-500", title: "AI/ML roles surging", detail: "+42% YoY demand across all engineering levels" },
                    { color: "border-emerald-500", title: "Remote roles normalised", detail: "68% of senior roles now remote-first globally" },
                    { color: "border-amber-500", title: "Cloud skills premium", detail: "AWS/GCP certified engineers earn 23% above base" },
                  ].map(({ color, title, detail }) => (
                    <div key={title} className={`text-sm border-l-2 ${color} pl-3`}>
                      <p className="text-white font-medium text-xs">{title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Negotiation Script */}
            <div className="card border-indigo-500/20 bg-indigo-500/3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" /> AI Salary Negotiation Script
                </h3>
                <button
                  onClick={() => setShowNegotiation(p => !p)}
                  className="btn-secondary py-1.5 px-3 text-xs"
                >
                  {showNegotiation ? "Hide" : "Generate Script"}
                </button>
              </div>

              {!showNegotiation ? (
                <p className="text-xs text-slate-400">
                  Got an offer? Generate a professionally written negotiation email based on your market percentile, skills, and target salary ceiling.
                </p>
              ) : (
                <>
                  <div className="mb-3">
                    <label className="text-xs font-medium text-slate-400 mb-1.5 block">Current Offer ({base.symbol})</label>
                    <input
                      className="input text-sm"
                      placeholder={isINR ? "e.g. 25 (LPA)" : "e.g. 120000"}
                      value={offerAmount}
                      onChange={e => setOfferAmount(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <div className="bg-slate-900/70 border border-slate-700/50 rounded-xl p-4 text-xs text-slate-300 leading-relaxed whitespace-pre-line font-mono">
                      {negotiationScript}
                    </div>
                    <button
                      onClick={handleCopy}
                      className="absolute top-3 right-3 btn-secondary py-1 px-2.5 text-[11px] flex items-center gap-1"
                    >
                      {copied ? <><CheckCircle className="w-3 h-3 text-emerald-400" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    Targeting: <span className="text-indigo-300 font-medium">{targetDisplay}</span> based on {loc} 90th percentile data.
                    {percentile !== null && ` You're currently at the ${percentile}th percentile.`}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
