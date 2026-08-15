"use client";
import { useState, useEffect } from "react";
import { useProfile } from "@/lib/ProfileContext";
import { motion, AnimatePresence } from "motion/react";
import {
  DollarSign, ChevronRight, ChevronLeft, CheckCircle2,
  Copy, Check, Loader2, AlertTriangle, TrendingUp, Zap,
  Radio, Target, Shield, Handshake, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { motionTransition, easings } from "@/lib/motion-tokens";

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

const CLOSING_TIPS = [
  { icon: Shield, color: "text-cyan-400", title: "Set a deadline", body: "Ask for 48–72 hours to review the updated offer. This creates urgency on their side while giving you time to compare." },
  { icon: CheckCircle2, color: "text-emerald-400", title: "Accept in writing", body: "Once agreed, confirm the final terms via email before signing. Reference each component: base, equity, bonus, start date." },
  { icon: AlertTriangle, color: "text-amber-400", title: "Walk-away signal", body: "If they won't budge on base, push for signing bonus, accelerated equity cliff (6→3 months), or an extra 5 PTO days." },
];

// ── CopyBox ───────────────────────────────────────────────────────────────────
function CopyBox({ label, content }: { label: string; content: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="rounded-xl border relative overflow-hidden" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
        <motion.button
          onClick={copy}
          whileTap={{ scale: 0.92 }}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-white transition-colors"
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.span key="copied" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={motionTransition("fast")} className="flex items-center gap-1 text-emerald-400">
                <Check className="w-3 h-3" />Copied
              </motion.span>
            ) : (
              <motion.span key="copy" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={motionTransition("fast")} className="flex items-center gap-1">
                <Copy className="w-3 h-3" />Copy
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
      <Separator />
      <p className="p-4 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{content}</p>
    </div>
  );
}

// ── Stream panel ──────────────────────────────────────────────────────────────
function StreamPanel({ text, streaming, done }: { text: string; streaming: boolean; done: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={motionTransition("base", "outQuint")}
      className="rounded-xl border overflow-hidden"
      style={{ border: "1px solid rgba(99,102,241,0.3)", background: "rgba(10,10,20,0.6)" }}
    >
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          {streaming ? (
            <motion.div
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.1, repeat: Infinity, repeatType: "reverse", ease: easings.easeInOut }}
            >
              <Badge variant="outline" className="gap-1.5 border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />Generating…
              </Badge>
            </motion.div>
          ) : done ? (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={motionTransition("fast", "spring")}>
              <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />Complete
              </Badge>
            </motion.div>
          ) : null}
        </div>
        {done && text && (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span key="copied" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={motionTransition("fast")} className="flex items-center gap-1 text-emerald-400">
                  <Check className="w-3 h-3" />Copied
                </motion.span>
              ) : (
                <motion.span key="copy" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={motionTransition("fast")} className="flex items-center gap-1">
                  <Copy className="w-3 h-3" />Copy all
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        )}
      </div>
      <Separator />
      <div className="p-4 max-h-[500px] overflow-y-auto text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-mono" style={{ scrollbarWidth: "thin" }}>
        {streaming && !text ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        ) : (
          <>
            {text}
            {streaming && <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse ml-0.5 align-middle" />}
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Loading shell (initial profile fetch) ──────────────────────────────────────
function NegotiationSkeleton() {
  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-12 max-w-3xl">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <Skeleton className="h-11 w-full rounded-xl mb-6" />
        <Card className="card gap-4">
          <Skeleton className="h-5 w-56" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        </Card>
      </main>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function NegotiationPage() {
  const { profile, loading: profileLoading } = useProfile();
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
    const currencySymbol = profile.currency === "EUR" ? "€" : profile.currency === "GBP" ? "£" : profile.currency === "INR" ? "₹" : "$";
    setMarket(prev => ({
      ...prev,
      experience_years: prev.experience_years || String(profile.experienceYears || ""),
      location:         prev.location         || profile.preferredLocations?.[0] || profile.currentLocation || "",
      current_salary:   prev.current_salary   || (profile.currentSalary > 0 ? `${currencySymbol}${profile.currentSalary.toLocaleString()}` : ""),
      target_salary:    prev.target_salary    || (profile.currentSalary > 0 ? `${currencySymbol}${Math.round(profile.currentSalary * 1.15).toLocaleString()}` : ""),
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

  // Shared negotiation-gap figure (used by both the Leverage step's callout and
  // the Strategy step's stat tile — same formula the original page computed
  // independently in two places).
  const rawBaseNum = parseFloat(offer.base.replace(/[$,k]/gi, ""));
  const rawTargetNum = parseFloat(market.target_salary.replace(/[$,k]/gi, ""));
  const gapAmount = Math.max(0, rawTargetNum - rawBaseNum);

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

  // Brief window before the profile context resolves (localStorage/DB) — show a
  // skeleton shell instead of an empty/unstyled form flashing into place.
  if (profileLoading && !profile) {
    return <NegotiationSkeleton />;
  }

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-12 max-w-3xl">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={motionTransition("base", "outQuint")}
          className="mb-6"
        >
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-medium mb-1">
            <DollarSign className="w-3.5 h-3.5" /> Negotiation Playbook
          </div>
          <h1 className="text-2xl font-bold text-white">
            Offer <span className="gradient-text">Negotiation</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Step-by-step playbook with live scripts to negotiate your best possible offer.</p>
        </motion.div>

        <Tabs value={step} onValueChange={(v) => setStep(v as Step)} className="gap-6">
          {/* Step indicator */}
          <TabsList className="h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto rounded-xl p-1.5">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < currentIdx;
              return (
                <TabsTrigger
                  key={s.id}
                  value={s.id}
                  className="h-auto shrink-0 flex-none gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium data-[state=active]:shadow-sm"
                >
                  {done ? (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={motionTransition("fast", "spring")} className="flex items-center">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </motion.span>
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                  {s.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* ── STEP: OFFER ─────────────────────────────────────────────── */}
          <TabsContent value="offer">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={motionTransition("base", "outQuint")}>
              <Card className="card gap-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2"><DollarSign className="w-4 h-4 text-indigo-400" />Enter the Offer Details</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Company *</label>
                    <input className="input w-full" placeholder="Stripe" value={offer.company} onChange={e => setOfr("company", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Role *</label>
                    <input className="input w-full" placeholder="Senior Engineer" value={offer.role} onChange={e => setOfr("role", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Base Salary *</label>
                    <input className="input w-full" placeholder="$130,000" value={offer.base} onChange={e => setOfr("base", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Equity</label>
                    <input className="input w-full" placeholder="$80k RSUs / 4yr" value={offer.equity} onChange={e => setOfr("equity", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Bonus</label>
                    <input className="input w-full" placeholder="10% target" value={offer.bonus} onChange={e => setOfr("bonus", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Benefits highlights</label>
                    <input className="input w-full" placeholder="Health, 401k, remote…" value={offer.benefits} onChange={e => setOfr("benefits", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Proposed start date</label>
                    <input type="date" className="input w-full" value={offer.start_date} onChange={e => setOfr("start_date", e.target.value)} />
                  </div>
                </div>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ── STEP: MARKET ─────────────────────────────────────────────── */}
          <TabsContent value="market">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={motionTransition("base", "outQuint")}>
              <Card className="card gap-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-cyan-400" />Your Leverage</h2>
                <div className="rounded-xl p-4" style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)", border: "1px solid var(--border-hover)" }}>
                  <p className="text-xs text-slate-400 leading-relaxed">Your leverage = market data + competing offers + their urgency to fill the role. Fill in as many as you have — even one competing offer changes everything.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Your current salary</label>
                    <input className="input w-full" placeholder="$115,000" value={market.current_salary} onChange={e => setMkt("current_salary", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Your target salary</label>
                    <input className="input w-full" placeholder="$155,000" value={market.target_salary} onChange={e => setMkt("target_salary", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Competing offer (if any)</label>
                    <input className="input w-full" placeholder="$145k at Plaid" value={market.competing_offers} onChange={e => setMkt("competing_offers", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Location</label>
                    <input className="input w-full" placeholder="San Francisco, CA" value={market.location} onChange={e => setMkt("location", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Years of experience</label>
                    <input className="input w-full" placeholder="7" value={market.experience_years} onChange={e => setMkt("experience_years", e.target.value)} />
                  </div>
                </div>
                {/* Quick gap calc */}
                {offer.base && market.target_salary && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={motionTransition("base", "spring")}
                    className="rounded-xl p-4"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                  >
                    <p className="text-xs text-slate-400 mb-1">Negotiation gap</p>
                    <p className="text-2xl font-bold" style={{ color: "var(--accent-bright)" }}>
                      +{market.target_salary.replace(/[$,k]/i, "") && offer.base.replace(/[$,k]/i, "")
                        ? `$${gapAmount.toLocaleString()}`
                        : "?"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">between their offer and your target</p>
                  </motion.div>
                )}
              </Card>
            </motion.div>
          </TabsContent>

          {/* ── STEP: STRATEGY ─────────────────────────────────────────────── */}
          <TabsContent value="strategy">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={motionTransition("base", "outQuint")} className="space-y-4">
              <Card className="card gap-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2"><Target className="w-4 h-4 text-violet-400" />Negotiation Strategy</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-3 text-center" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                    <p className="text-[10px] text-slate-500 mb-1">Their Offer</p>
                    <p className="text-base font-bold text-slate-300">{offer.base || "—"}</p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                    <p className="text-[10px] text-slate-500 mb-1">Your Target</p>
                    <p className="text-base font-bold text-emerald-400">{market.target_salary || "—"}</p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                    <p className="text-[10px] text-slate-500 mb-1">Gap to Close</p>
                    <p className="text-base font-bold" style={{ color: "var(--accent-bright)" }}>
                      {offer.base && market.target_salary ? `+$${gapAmount.toLocaleString()}` : "—"}
                    </p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="rounded-xl p-3 text-center cursor-help" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                        <p className="text-[10px] text-slate-500 mb-1 flex items-center justify-center gap-1">Leverage <Info className="w-2.5 h-2.5" /></p>
                        <Badge variant="outline" className={market.competing_offers ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-400"}>
                          {market.competing_offers ? "Strong" : "Moderate"}
                        </Badge>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {market.competing_offers
                        ? "A competing offer gives you real walk-away power at the table."
                        : "Add a competing offer on the Leverage step to strengthen your position."}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Button onClick={() => runStream("strategy")} disabled={streaming} className="btn-primary h-auto w-full flex items-center justify-center gap-2 py-3">
                  {streaming ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing…</> : <><Radio className="w-4 h-4" />Generate AI Strategy</>}
                </Button>
              </Card>
              <AnimatePresence>
                {(streaming || streamText) && <StreamPanel text={streamText} streaming={streaming} done={streamDone} />}
              </AnimatePresence>
              {error && (
                <div className="text-sm text-rose-400 p-3 rounded-xl flex items-center gap-2" style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)" }}>
                  <AlertTriangle className="w-4 h-4 shrink-0" />{error}
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* ── STEP: SCRIPTS ─────────────────────────────────────────────── */}
          <TabsContent value="scripts">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={motionTransition("base", "outQuint")} className="space-y-4">
              <Card className="card gap-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" />Ready-to-Use Scripts</h2>

                {hasOffer ? (
                  <>
                    <CopyBox label="Opening Counter — Phone Call" content={openingScript} />
                    <CopyBox label="Counter Offer Email" content={counterEmail} />
                  </>
                ) : (
                  <EmptyState
                    icon={AlertTriangle}
                    title="Add your offer details first"
                    description="Fill in company, role, and base salary on the Offer step to unlock your personalized opening script and counter-offer email."
                    action={{ label: "Go to Offer step", onClick: () => setStep("offer") }}
                    bordered={false}
                    className="py-2"
                  />
                )}

                <div className="pt-2">
                  <Button onClick={() => runStream("scripts")} disabled={streaming} className="btn-primary h-auto w-full flex items-center justify-center gap-2 py-3">
                    {streaming ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</> : <><Radio className="w-4 h-4" />Generate Advanced Scripts</>}
                  </Button>
                  <p className="text-xs text-slate-500 text-center mt-2">Objection handlers, LinkedIn DM, walk-away line</p>
                </div>
              </Card>
              <AnimatePresence>
                {(streaming || streamText) && <StreamPanel text={streamText} streaming={streaming} done={streamDone} />}
              </AnimatePresence>
              {error && (
                <div className="text-sm text-rose-400 p-3 rounded-xl flex items-center gap-2" style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)" }}>
                  <AlertTriangle className="w-4 h-4 shrink-0" />{error}
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* ── STEP: CLOSING ─────────────────────────────────────────────── */}
          <TabsContent value="closing">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={motionTransition("base", "outQuint")} className="space-y-4">
              <Card className="card gap-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2"><Handshake className="w-4 h-4 text-emerald-400" />How to Close</h2>
                <motion.div
                  className="space-y-3"
                  initial="hidden"
                  animate="show"
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
                >
                  {CLOSING_TIPS.map(({ icon: Icon, color, title, body }) => (
                    <motion.div
                      key={title}
                      variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                      transition={motionTransition("base", "outQuint")}
                      className="flex gap-3 p-3 rounded-xl"
                      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                    >
                      <Icon className={`w-5 h-5 ${color} mt-0.5 shrink-0`} />
                      <div>
                        <p className="text-sm font-semibold text-white">{title}</p>
                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{body}</p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
                <Button onClick={() => runStream("closing")} disabled={streaming} className="btn-primary h-auto w-full flex items-center justify-center gap-2 py-3">
                  {streaming ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</> : <><Radio className="w-4 h-4" />AI Closing Playbook</>}
                </Button>
              </Card>
              <AnimatePresence>
                {(streaming || streamText) && <StreamPanel text={streamText} streaming={streaming} done={streamDone} />}
              </AnimatePresence>
              {error && (
                <div className="text-sm text-rose-400 p-3 rounded-xl flex items-center gap-2" style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)" }}>
                  <AlertTriangle className="w-4 h-4 shrink-0" />{error}
                </div>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>

        <Separator className="my-6" />

        {/* Navigation */}
        <div className="flex gap-3">
          {currentIdx > 0 && (
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button onClick={goPrev} className="btn-secondary h-auto flex items-center gap-1.5 px-4 py-2.5 text-sm">
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
            </motion.div>
          )}
          {currentIdx < STEPS.length - 1 && (
            <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
              <Button onClick={goNext} disabled={!canNext()} className="btn-primary h-auto w-full flex items-center justify-center gap-1.5 py-2.5 text-sm disabled:opacity-40">
                Next: {STEPS[currentIdx + 1].label} <ChevronRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
