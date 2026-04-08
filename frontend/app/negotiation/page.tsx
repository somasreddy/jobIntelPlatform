"use client";
import { useState, useRef, useEffect } from "react";
import { useProfile } from "@/lib/ProfileContext";
import {
  DollarSign, ChevronRight, ChevronLeft, CheckCircle2,
  Copy, Check, Loader2, AlertTriangle, TrendingUp, Zap,
  Radio, Target, Shield, Handshake,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────
interface OfferData {
  company: string;
  role: string;
  base: string;
  equity: string;
  bonus: string;
  benefits: string;
  start_date: string;
}

interface MarketData {
  current_salary: string;
  target_salary: string;
  competing_offers: string;
  location: string;
  experience_years: string;
}

type Step = "offer" | "market" | "strategy" | "scripts" | "closing";

const STEPS: { id: Step; label: string; icon: React.ComponentType<{className?:string}> }[] = [
  { id: "offer",    label: "The Offer",      icon: DollarSign  },
  { id: "market",   label: "Your Leverage",  icon: TrendingUp  },
  { id: "strategy", label: "Strategy",       icon: Target      },
  { id: "scripts",  label: "Scripts",        icon: Zap         },
  { id: "closing",  label: "Close",          icon: Handshake   },
];

// ── CopyBlock ─────────────────────────────────────────────────────────────────
function CopyBox({ label, content }: { label: string; content: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="rounded-xl border relative overflow-hidden" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
        <button onClick={copy} className="flex items-center gap-1 text-xs text-slate-500 hover:text-white transition-colors">
          {copied ? <><Check className="w-3 h-3 text-emerald-400" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
        </button>
      </div>
      <p className="p-4 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{content}</p>
    </div>
  );
}

// ── Stream panel ──────────────────────────────────────────────────────────────
function StreamPanel({ text, streaming, done }: { text: string; streaming: boolean; done: boolean }) {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="rounded-xl border overflow-hidden" style={{ border: "1px solid rgba(99,102,241,0.3)", background: "rgba(10,10,20,0.6)" }}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          {streaming
            ? <><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" /><span className="text-xs text-cyan-400 font-medium">Generating…</span></>
            : done ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /><span className="text-xs text-emerald-400 font-medium">Complete</span></> : null}
        </div>
        {done && text && (
          <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">
            {copied ? <><Check className="w-3 h-3 text-emerald-400" />Copied</> : <><Copy className="w-3 h-3" />Copy all</>}
          </button>
        )}
      </div>
      <div ref={ref} className="p-4 max-h-[500px] overflow-y-auto text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-mono" style={{ scrollbarWidth: "thin" }}>
        {text}
        {streaming && <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse ml-0.5 align-middle" />}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function NegotiationPage() {
  const { profile } = useProfile();
  const [step, setStep] = useState<Step>("offer");
  const [offer, setOffer] = useState<OfferData>({ company: "", role: "", base: "", equity: "", bonus: "", benefits: "", start_date: "" });
  const [market, setMarket] = useState<MarketData>({ current_salary: "", target_salary: "", competing_offers: "", location: "", experience_years: "" });
  const [streamText, setStreamText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamDone, setStreamDone] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill from profile once loaded
  useEffect(() => {
    if (!profile) return;
    setMarket(prev => ({
      ...prev,
      experience_years: prev.experience_years || String(profile.experienceYears || ""),
      location: prev.location || profile.currentLocation || (profile.preferredLocations?.[0] ?? ""),
      current_salary: prev.current_salary || (profile.currentSalary > 0 ? String(profile.currentSalary) : ""),
    }));
    setOffer(prev => ({
      ...prev,
      role: prev.role || profile.currentRole || "",
    }));
  }, [profile]);

  const setOfr = (k: keyof OfferData, v: string) => setOffer(o => ({ ...o, [k]: v }));
  const setMkt = (k: keyof MarketData, v: string) => setMarket(m => ({ ...m, [k]: v }));

  const currentIdx = STEPS.findIndex(s => s.id === step);
  const canNext = () => {
    if (step === "offer") return offer.company && offer.role && offer.base;
    return true;
  };
  const goNext = () => { if (currentIdx < STEPS.length - 1) setStep(STEPS[currentIdx + 1].id); };
  const goPrev = () => { if (currentIdx > 0) setStep(STEPS[currentIdx - 1].id); };

  const runStream = async (promptType: "strategy" | "scripts" | "closing") => {
    setStreaming(true);
    setStreamDone(false);
    setStreamText("");
    setError("");
    try {
      const prof = profile ? {
        name: profile.name,
        current_role: profile.currentRole,
        experience_years: Number(market.experience_years) || profile.experienceYears || 5,
        skills: profile.skills ?? [],
        current_company: "",
      } : { experience_years: Number(market.experience_years) || 5 };

      const payload = {
        offer: {
          company: offer.company,
          role: offer.role,
          base: parseFloat(offer.base.replace(/[$,k]/gi, "")) || 0,
          equity: offer.equity,
          bonus: offer.bonus,
        },
        profile: prof,
        competing_offers: market.competing_offers
          ? [{ company: "Other", base: parseFloat(market.competing_offers.replace(/[$,k]/gi, "")) || 0 }]
          : [],
        market_context: `Target: ${market.target_salary}. Current: ${market.current_salary}. Location: ${market.location}.`,
        prompt_focus: promptType,
      };

      const res = await fetch(`${API}/api/stream/offer-negotiator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok || !res.body) throw new Error(`Error ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") { setStreamDone(true); continue; }
          try {
            const p = JSON.parse(raw);
            if (p.token) setStreamText(prev => prev + p.token);
          } catch { /* skip */ }
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setStreaming(false);
      setStreamDone(true);
    }
  };

  // ── Static scripts derived from offer data ─────────────────────────────────
  const baseNum = parseFloat(offer.base.replace(/[$,k]/gi, "")) || 0;
  const targetNum = parseFloat(market.target_salary.replace(/[$,k]/gi, "")) || Math.round(baseNum * 1.12);
  const hasOffer = offer.company && offer.role && offer.base;

  const openingScript = hasOffer
    ? `"Thank you so much for the offer — I'm genuinely excited about the ${offer.role} role at ${offer.company} and the team. I've done my research on the market and based on my ${market.experience_years || profile?.experienceYears || "X"} years of experience${market.competing_offers ? ` and the competing offer I have at ${market.competing_offers}` : ""}, I was hoping we could discuss getting the base closer to ${market.target_salary || `$${Math.round(targetNum).toLocaleString()}`}. Is there flexibility there?"`
    : "";

  const counterEmail = hasOffer
    ? `Subject: Re: Offer for ${offer.role} at ${offer.company}

Hi [Hiring Manager],

Thank you for the formal offer — I'm very excited about joining the ${offer.company} team.

After careful consideration of the market data and my experience, I'd like to respectfully request a base salary of ${market.target_salary || `$${Math.round(targetNum).toLocaleString()}`}. This reflects:

• Market rate for this role in ${market.location || "this market"} (per Levels.fyi / Glassdoor)${market.experience_years ? `\n• My ${market.experience_years} years of directly relevant experience` : ""}${market.competing_offers ? `\n• A competing offer I have at ${market.competing_offers}` : ""}

The other components of the package — equity, bonus, and the team — are all very compelling, and I'm eager to find an arrangement that works for both of us.

Would you be able to accommodate this?

Best,
${profile?.name ?? "[Your Name]"}`
    : "";

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-12 max-w-3xl">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-medium mb-1">
            <DollarSign className="w-3.5 h-3.5" /> Negotiation Playbook
          </div>
          <h1 className="text-2xl font-bold text-white">
            Offer <span className="gradient-text">Negotiation</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Step-by-step playbook with live scripts to negotiate your best possible offer.</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < currentIdx;
            const active = s.id === step;
            return (
              <div key={s.id} className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setStep(s.id)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl transition-all ${
                    active ? "text-white" : done ? "text-slate-400 hover:text-white" : "text-slate-600"
                  }`}
                  style={active ? { background: "color-mix(in srgb, var(--accent) 20%, transparent)", border: "1px solid var(--border-hover)" } : { border: "1px solid transparent" }}
                >
                  {done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Icon className={`w-3.5 h-3.5 ${active ? "text-white" : "text-slate-500"}`} />}
                  {s.label}
                </button>
                {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
              </div>
            );
          })}
        </div>

        {/* ── STEP: OFFER ─────────────────────────────────────────────── */}
        {step === "offer" && (
          <div className="card p-6 space-y-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2"><DollarSign className="w-4 h-4 text-indigo-400" />Enter the Offer Details</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Company *</label>
                <input className="input-field w-full" placeholder="Stripe" value={offer.company} onChange={e => setOfr("company", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Role *</label>
                <input className="input-field w-full" placeholder="Senior Engineer" value={offer.role} onChange={e => setOfr("role", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Base Salary *</label>
                <input className="input-field w-full" placeholder="$130,000" value={offer.base} onChange={e => setOfr("base", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Equity</label>
                <input className="input-field w-full" placeholder="$80k RSUs / 4yr" value={offer.equity} onChange={e => setOfr("equity", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Bonus</label>
                <input className="input-field w-full" placeholder="10% target" value={offer.bonus} onChange={e => setOfr("bonus", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Benefits highlights</label>
                <input className="input-field w-full" placeholder="Health, 401k, remote…" value={offer.benefits} onChange={e => setOfr("benefits", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Proposed start date</label>
                <input type="date" className="input-field w-full" value={offer.start_date} onChange={e => setOfr("start_date", e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: MARKET ─────────────────────────────────────────────── */}
        {step === "market" && (
          <div className="card p-6 space-y-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-cyan-400" />Your Leverage</h2>
            <div className="rounded-xl p-4 mb-2" style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)", border: "1px solid var(--border-hover)" }}>
              <p className="text-xs text-slate-400 leading-relaxed">Your leverage = market data + competing offers + their urgency to fill the role. Fill in as many as you have — even one competing offer changes everything.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Your current salary</label>
                <input className="input-field w-full" placeholder="$115,000" value={market.current_salary} onChange={e => setMkt("current_salary", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Your target salary</label>
                <input className="input-field w-full" placeholder="$155,000" value={market.target_salary} onChange={e => setMkt("target_salary", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Competing offer (if any)</label>
                <input className="input-field w-full" placeholder="$145k at Plaid" value={market.competing_offers} onChange={e => setMkt("competing_offers", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Location</label>
                <input className="input-field w-full" placeholder="San Francisco, CA" value={market.location} onChange={e => setMkt("location", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Years of experience</label>
                <input className="input-field w-full" placeholder="7" value={market.experience_years} onChange={e => setMkt("experience_years", e.target.value)} />
              </div>
            </div>
            {/* Quick gap calc */}
            {offer.base && market.target_salary && (
              <div className="rounded-xl p-4" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                <p className="text-xs text-slate-400 mb-1">Negotiation gap</p>
                <p className="text-2xl font-bold" style={{ color: "var(--accent-bright)" }}>
                  +{market.target_salary.replace(/[$,k]/i, "") && offer.base.replace(/[$,k]/i, "")
                    ? `$${Math.max(0, (parseFloat(market.target_salary.replace(/[$,k]/gi, "")) - parseFloat(offer.base.replace(/[$,k]/gi, "")))).toLocaleString()}`
                    : "?"}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">between their offer and your target</p>
              </div>
            )}
          </div>
        )}

        {/* ── STEP: STRATEGY ─────────────────────────────────────────────── */}
        {step === "strategy" && (
          <div className="space-y-4">
            <div className="card p-6">
              <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4"><Target className="w-4 h-4 text-violet-400" />Negotiation Strategy</h2>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { label: "Their Offer", value: offer.base || "—", color: "text-slate-300" },
                  { label: "Your Target", value: market.target_salary || "—", color: "text-emerald-400" },
                  { label: "Gap to Close", value: offer.base && market.target_salary ? `+$${Math.max(0, parseFloat(market.target_salary.replace(/[$,k]/gi,"")) - parseFloat(offer.base.replace(/[$,k]/gi,""))).toLocaleString()}` : "—", color: "var(--accent-bright)" },
                  { label: "Leverage", value: market.competing_offers ? "Strong" : "Moderate", color: market.competing_offers ? "text-emerald-400" : "text-amber-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl p-3 text-center" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                    <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                    <p className={`text-base font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => runStream("strategy")}
                disabled={streaming}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3"
              >
                {streaming ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing…</> : <><Radio className="w-4 h-4" />Generate AI Strategy</>}
              </button>
            </div>
            {(streaming || streamText) && <StreamPanel text={streamText} streaming={streaming} done={streamDone} />}
            {error && <div className="text-sm text-rose-400 p-3 rounded-xl" style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)" }}>{error}</div>}
          </div>
        )}

        {/* ── STEP: SCRIPTS ─────────────────────────────────────────────── */}
        {step === "scripts" && (
          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4"><Zap className="w-4 h-4 text-amber-400" />Ready-to-Use Scripts</h2>

              {openingScript && <CopyBox label="Opening Counter — Phone Call" content={openingScript} />}
              {counterEmail && <CopyBox label="Counter Offer Email" content={counterEmail} />}

              <div className="pt-4">
                <button
                  onClick={() => runStream("scripts")}
                  disabled={streaming}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3"
                >
                  {streaming ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</> : <><Radio className="w-4 h-4" />Generate Advanced Scripts</>}
                </button>
                <p className="text-xs text-slate-500 text-center mt-2">Objection handlers, LinkedIn DM, walk-away line</p>
              </div>
            </div>
            {(streaming || streamText) && <StreamPanel text={streamText} streaming={streaming} done={streamDone} />}
            {error && <div className="text-sm text-rose-400 p-3 rounded-xl" style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)" }}>{error}</div>}
          </div>
        )}

        {/* ── STEP: CLOSING ─────────────────────────────────────────────── */}
        {step === "closing" && (
          <div className="space-y-4">
            <div className="card p-6">
              <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-3"><Handshake className="w-4 h-4 text-emerald-400" />How to Close</h2>
              <div className="space-y-3 mb-5">
                {[
                  { icon: Shield, color: "text-cyan-400", title: "Set a deadline", body: `Ask for 48–72 hours to review the updated offer. This creates urgency on their side while giving you time to compare.` },
                  { icon: CheckCircle2, color: "text-emerald-400", title: "Accept in writing", body: `Once agreed, confirm the final terms via email before signing. Reference each component: base, equity, bonus, start date.` },
                  { icon: AlertTriangle, color: "text-amber-400", title: "Walk-away signal", body: `If they won't budge on base, push for signing bonus, accelerated equity cliff (6→3 months), or an extra 5 PTO days.` },
                ].map(({ icon: Icon, color, title, body }) => (
                  <div key={title} className="flex gap-3 p-3 rounded-xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                    <Icon className={`w-5 h-5 ${color} mt-0.5 shrink-0`} />
                    <div>
                      <p className="text-sm font-semibold text-white">{title}</p>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => runStream("closing")}
                disabled={streaming}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3"
              >
                {streaming ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</> : <><Radio className="w-4 h-4" />AI Closing Playbook</>}
              </button>
            </div>
            {(streaming || streamText) && <StreamPanel text={streamText} streaming={streaming} done={streamDone} />}
            {error && <div className="text-sm text-rose-400 p-3 rounded-xl" style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)" }}>{error}</div>}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {currentIdx > 0 && (
            <button onClick={goPrev} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm text-slate-400 hover:text-white transition-all" style={{ border: "1px solid var(--border)" }}>
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          {currentIdx < STEPS.length - 1 && (
            <button onClick={goNext} disabled={!canNext()} className="btn-primary flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm disabled:opacity-40">
              Next: {STEPS[currentIdx + 1].label} <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
