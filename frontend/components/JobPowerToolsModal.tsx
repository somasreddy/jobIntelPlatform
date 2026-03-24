"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X, Zap, Loader2, Check, Copy,
  Search, FileText, AlertTriangle, Linkedin, Mail,
  DollarSign, Hourglass, Crosshair, Building2, MapPin, Clock
} from "lucide-react";
import { Job } from "@/lib/types";
import { useProfile } from "@/lib/ProfileContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Shared sub-components ────────────────────────────────────────────────────

function Section({ title, content }: { title?: string; content?: string }) {
  if (!content) return null;
  return (
    <div>
      {title && <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{title}</p>}
      <p className="text-sm text-slate-300 leading-relaxed">{content}</p>
    </div>
  );
}

function ListSection({ title, items, color }: { title: string; items?: string[]; color: string }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className={`text-sm flex gap-2 ${color}`}>
            <span className="mt-0.5 shrink-0">▸</span>{item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CopyBlock({ title, content }: { title?: string; content?: string }) {
  const [copied, setCopied] = useState(false);
  if (!content) return null;
  const copy = () => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="rounded-xl p-4 border border-white/10 relative" style={{ background: "var(--bg-elevated)" }}>
      {title && <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{title}</p>}
      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap pr-8">{content}</p>
      <button onClick={copy} className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors" style={{ background: "rgba(255,255,255,0.05)" }}>
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

// ─── Tool result renderers ────────────────────────────────────────────────────

function HiringDecoderResult({ r }: { r: Record<string, unknown> }) {
  return (
    <div className="space-y-4">
      <Section title="Real Problem Being Solved" content={r.real_problem as string} />
      <Section title="Day-to-Day Priorities" content={r.day_to_day_priorities as string} />
      <ListSection title="Forward Signals" items={r.instant_forward as string[]} color="text-green-400" />
      <ListSection title="Reject Signals" items={r.instant_reject as string[]} color="text-red-400" />
      <ListSection title="Hidden Requirements" items={r.hidden_requirements as string[]} color="text-yellow-400" />
      <Section title="Culture Signals" content={r.culture_signals as string} />
      {(r.red_flags_in_jd as string[])?.length > 0 && (
        <ListSection title="Red Flags in JD" items={r.red_flags_in_jd as string[]} color="text-orange-400" />
      )}
    </div>
  );
}

function ResumeSurgeonResult({ r }: { r: Record<string, unknown> }) {
  type ExpBlock = { role: string; company: string; duration?: string; bullets: string[] };
  return (
    <div className="space-y-4">
      <CopyBlock title="Rewritten Summary" content={r.summary as string} />
      {(r.experience as ExpBlock[])?.slice(0, 3).map((exp, i) => (
        <div key={i} className="rounded-xl p-4 border border-white/10" style={{ background: "var(--bg-elevated)" }}>
          <p className="font-semibold text-white text-sm">{exp.role} — {exp.company}{exp.duration ? ` · ${exp.duration}` : ""}</p>
          <ul className="mt-2 space-y-1.5">
            {exp.bullets?.slice(0, 4).map((b, j) => (
              <li key={j} className="text-sm text-slate-300 flex gap-2"><span className="text-cyan-400 mt-0.5 shrink-0">▸</span>{b}</li>
            ))}
          </ul>
        </div>
      ))}
      {typeof r.ats_score_estimate === "number" && (
        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <span className="text-slate-400 text-sm">Estimated ATS Score:</span>
          <span className="text-green-400 font-bold text-2xl">{r.ats_score_estimate}%</span>
        </div>
      )}
      <ListSection title="ATS Keywords Embedded" items={r.ats_keywords_embedded as string[]} color="text-indigo-400" />
    </div>
  );
}

function LinkedInInfiltratorResult({ r }: { r: Record<string, unknown> }) {
  type Filters = { titles?: string[]; skills?: string[]; keywords?: string[] };
  const filters = r.recommended_filters as Filters | undefined;
  return (
    <div className="space-y-4">
      <CopyBlock title="Optimized Headline" content={r.optimized_headline as string} />
      <CopyBlock title="Optimized About Section" content={r.optimized_about as string} />
      <ListSection title="Recruiter Search Strings" items={r.search_strings as string[]} color="text-blue-400" />
      <CopyBlock title="Boolean Search" content={r.boolean_search as string} />
      {filters && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recommended Filters</p>
          <ListSection title="Titles" items={filters.titles} color="text-violet-400" />
          <ListSection title="Skills" items={filters.skills} color="text-cyan-400" />
          <ListSection title="Keywords" items={filters.keywords} color="text-amber-400" />
        </div>
      )}
      <ListSection title="Missing Keywords" items={r.missing_keywords as string[]} color="text-rose-400" />
      <ListSection title="Profile Quick Wins" items={r.profile_quick_wins as string[]} color="text-green-400" />
      <Section title="Connection Strategy" content={r.connection_strategy as string} />
    </div>
  );
}

function InterviewResult({ r }: { r: Record<string, unknown> }) {
  type Question = { question: string; is_trap: boolean; trap_reason: string; strong_answer: string; avoid_saying: string; type?: string };
  const questions = r.questions as Question[];
  return (
    <div className="space-y-3">
      {questions?.slice(0, 8).map((q, i) => (
        <div key={i} className="rounded-xl p-4 border border-white/10 space-y-2" style={{ background: "var(--bg-elevated)" }}>
          <div className="flex items-center gap-2">
            {q.is_trap && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>⚠ Trap</span>
            )}
            {q.type && <span className="text-xs text-slate-500 capitalize">{q.type}</span>}
          </div>
          <p className="font-medium text-white text-sm">{q.question}</p>
          {q.trap_reason && <p className="text-xs text-orange-400">⚠ {q.trap_reason}</p>}
          <div className="rounded-lg p-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <p className="text-xs font-semibold text-green-400 mb-1">Strong Answer</p>
            <p className="text-sm text-slate-300">{q.strong_answer}</p>
          </div>
          {q.avoid_saying && <p className="text-xs text-red-400">✕ Avoid: {q.avoid_saying}</p>}
        </div>
      ))}
      <ListSection title="Must-Prepare STAR Stories" items={r.must_prepare_stories as string[]} color="text-blue-400" />
      <ListSection title="Smart Questions to Ask" items={r.smart_questions_to_ask as string[]} color="text-violet-400" />
      <ListSection title="Red Flag Topics" items={r.red_flag_topics as string[]} color="text-rose-400" />
    </div>
  );
}

function ColdEmailResult({ r }: { r: Record<string, unknown> }) {
  type Email = { subject: string; body: string; ps_line?: string };
  type FollowUp = { day: number; channel: string; message: string };
  const email = r.email as Email | undefined;
  const followUps = r.follow_up_sequence as FollowUp[] | undefined;
  return (
    <div className="space-y-4">
      {email && (
        <div className="rounded-xl p-4 border border-white/10 space-y-3" style={{ background: "var(--bg-elevated)" }}>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Subject</p>
            <p className="text-sm font-semibold text-indigo-300">{email.subject}</p>
          </div>
          <CopyBlock title="Email Body" content={email.body} />
          {email.ps_line && <p className="text-xs text-slate-400 italic">P.S. {email.ps_line}</p>}
        </div>
      )}
      <CopyBlock title="LinkedIn Connection Note" content={r.linkedin_connection_note as string} />
      <CopyBlock title="Voice Note Script (60s)" content={r.voice_note_script as string} />
      {followUps && followUps.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Follow-Up Sequence</p>
          <div className="space-y-2">
            {followUps.map((f, i) => (
              <div key={i} className="flex gap-3 rounded-lg p-3 border border-white/5" style={{ background: "var(--bg-elevated)" }}>
                <span className="text-xs font-bold text-indigo-400 w-12 shrink-0">Day {f.day}</span>
                <div>
                  <span className="text-xs text-slate-500 capitalize mr-2">{f.channel}</span>
                  <span className="text-sm text-slate-300">{f.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <Section title="Best Send Timing" content={r.send_timing as string} />
      <ListSection title="Personalization Hooks" items={r.personalization_hooks as string[]} color="text-amber-400" />
    </div>
  );
}

function OfferNegotiatorResult({ r }: { r: Record<string, unknown> }) {
  type Levers = Record<string, string>;
  type Counter = { recommended_base?: number; justification?: string; live_call_script?: string; counter_script?: string };
  const counter = r.counter_offer as Counter | undefined;
  const levers = r.alternative_levers as Levers | undefined;
  return (
    <div className="space-y-4">
      <Section title="Market Assessment" content={r.market_assessment as string} />
      {counter && (
        <div className="space-y-3">
          {counter.recommended_base && counter.recommended_base > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <span className="text-slate-400 text-sm">Recommended Counter Base:</span>
              <span className="text-indigo-300 font-bold text-xl">${counter.recommended_base.toLocaleString()}</span>
            </div>
          )}
          <Section title="Justification" content={counter.justification} />
          <CopyBlock title="Live Call Script" content={counter.live_call_script} />
          <CopyBlock title="Counter-Offer Script" content={counter.counter_script} />
        </div>
      )}
      <CopyBlock title="If They Say 'This Is Our Best Offer'" content={r.if_they_say_best_offer as string} />
      <CopyBlock title="Counter-Offer Email (Ready to Send)" content={r.counter_offer_email as string} />
      {levers && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Alternative Levers</p>
          <div className="space-y-2">
            {Object.entries(levers).map(([key, val]) => val && (
              <div key={key} className="rounded-lg p-3 border border-white/5" style={{ background: "var(--bg-elevated)" }}>
                <p className="text-xs font-semibold text-slate-400 capitalize mb-0.5">{key.replace(/_/g, " ")}</p>
                <p className="text-sm text-slate-300">{val}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <ListSection title="Red Flags in This Offer" items={r.red_flags as string[]} color="text-rose-400" />
      <Section title="Walk-Away Threshold" content={r.walk_away_threshold as string} />
    </div>
  );
}

function GapKillerResult({ r }: { r: Record<string, unknown> }) {
  return (
    <div className="space-y-4">
      <CopyBlock title="Cover Letter Sentences (2 sentences, ready to paste)" content={r.cover_letter_sentences as string} />
      <CopyBlock title="Interview Answer (45-second spoken answer)" content={r.interview_answer as string} />
      <CopyBlock title="LinkedIn Reframe" content={r.linkedin_reframe as string} />
      <Section title="Core Narrative Strategy" content={r.narrative_strategy as string} />
      <Section title="Gap-Type Playbook" content={r.gap_type_playbook as string} />
      <Section title="When to Bring It Up First" content={r.when_to_address_proactively as string} />
      <Section title="When to Wait" content={r.when_to_wait as string} />
      <ListSection title="Skills Gained During Gap" items={r.skills_gained as string[]} color="text-green-400" />
      <ListSection title="Language to Avoid" items={r.language_to_avoid as string[]} color="text-red-400" />
      <Section title="Why This Gap Makes You Stronger" content={r.reframe_as_strength as string} />
    </div>
  );
}

function AttackPlanResult({ r }: { r: Record<string, unknown> }) {
  type Company = { company_type: string; why_strong_fit: string; linkedin_search_string: string; insider_tip: string };
  type Hours = { hour_0_to_4?: string[]; hour_4_to_12?: string[]; hour_12_to_24?: string[]; hour_24_to_48?: string[] };
  type LinkedIn = { full_content: string; hashtags: string[]; best_posting_time: string };
  type Referral = { subject_line: string; message_template: string };
  type Checkpoints = { at_24_hours?: string[]; at_48_hours?: string[] };

  const companies = r.target_companies as Company[] | undefined;
  const linkedInPost = r.linkedin_post as LinkedIn | undefined;
  const referral = r.referral_outreach as Referral | undefined;
  const hours = r.hour_by_hour as Hours | undefined;
  const checkpoints = r.success_checkpoints as Checkpoints | undefined;

  return (
    <div className="space-y-4">
      {/* Hour-by-Hour Plan */}
      {hours && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">48-Hour Battle Plan</p>
          <div className="space-y-2">
            {([
              ["0–4 hrs", hours.hour_0_to_4, "text-green-400"],
              ["4–12 hrs", hours.hour_4_to_12, "text-blue-400"],
              ["12–24 hrs", hours.hour_12_to_24, "text-indigo-400"],
              ["24–48 hrs", hours.hour_24_to_48, "text-violet-400"],
            ] as [string, string[] | undefined, string][]).map(([label, actions, color]) => (
              actions?.length ? (
                <div key={label} className="rounded-lg p-3 border border-white/5" style={{ background: "var(--bg-elevated)" }}>
                  <p className={`text-xs font-bold mb-1.5 ${color}`}>{label}</p>
                  <ul className="space-y-1">
                    {actions.map((a, i) => <li key={i} className={`text-sm flex gap-2 ${color}`}><span className="shrink-0">▸</span>{a}</li>)}
                  </ul>
                </div>
              ) : null
            ))}
          </div>
        </div>
      )}

      {/* Target Companies */}
      {companies?.length && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Target Company Types</p>
          <div className="space-y-2">
            {companies.slice(0, 3).map((c, i) => (
              <div key={i} className="rounded-xl p-3 border border-white/10 space-y-1" style={{ background: "var(--bg-elevated)" }}>
                <p className="font-semibold text-white text-sm">{c.company_type}</p>
                <p className="text-xs text-slate-400">{c.why_strong_fit}</p>
                <CopyBlock content={c.linkedin_search_string} />
                <p className="text-xs text-amber-400">💡 {c.insider_tip}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LinkedIn Post */}
      {linkedInPost && (
        <div>
          <CopyBlock title="LinkedIn Post (Ready to Publish)" content={linkedInPost.full_content} />
          <p className="text-xs text-slate-500 mt-1">
            {linkedInPost.hashtags?.join(" ")} · Best time: {linkedInPost.best_posting_time}
          </p>
        </div>
      )}

      {/* Referral Outreach */}
      {referral && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Referral Outreach</p>
          <div className="rounded-lg p-3 border border-white/5" style={{ background: "var(--bg-elevated)" }}>
            <p className="text-xs text-slate-400 mb-1">Subject: <span className="text-white font-medium">{referral.subject_line}</span></p>
          </div>
          <CopyBlock content={referral.message_template} />
        </div>
      )}

      {/* Checkpoints */}
      {checkpoints && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">At 24 Hours</p>
            <ul className="space-y-1">
              {checkpoints.at_24_hours?.map((c, i) => <li key={i} className="text-sm text-green-400 flex gap-2"><span>▸</span>{c}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">At 48 Hours</p>
            <ul className="space-y-1">
              {checkpoints.at_48_hours?.map((c, i) => <li key={i} className="text-sm text-blue-400 flex gap-2"><span>▸</span>{c}</li>)}
            </ul>
          </div>
        </div>
      )}

      <ListSection title="Momentum Killers to Avoid" items={r.momentum_killers as string[]} color="text-rose-400" />
    </div>
  );
}

// ─── Tool configs ─────────────────────────────────────────────────────────────

const CORE_TOOLS = [
  {
    id: "hiring-decoder",
    icon: Search,
    title: "Hiring Decoder",
    color: "from-violet-500 to-purple-600",
    glow: "rgba(139,92,246,0.3)",
    endpoint: "/api/intelligence-tools/hiring-decoder",
  },
  {
    id: "resume-surgeon",
    icon: FileText,
    title: "Resume Surgeon",
    color: "from-blue-500 to-cyan-600",
    glow: "rgba(59,130,246,0.3)",
    endpoint: "/api/intelligence-tools/resume-surgeon",
  },
  {
    id: "interview-trap-detector",
    icon: AlertTriangle,
    title: "Interview Traps",
    color: "from-orange-500 to-red-600",
    glow: "rgba(249,115,22,0.3)",
    endpoint: "/api/intelligence-tools/interview-trap-detector",
  },
];

const EXTENDED_TOOLS = [
  {
    id: "linkedin-infiltrator",
    icon: Linkedin,
    title: "LinkedIn Infiltrator",
    color: "from-sky-500 to-blue-600",
    glow: "rgba(14,165,233,0.3)",
    endpoint: "/api/intelligence-tools/linkedin-infiltrator",
  },
  {
    id: "cold-email-weapon",
    icon: Mail,
    title: "Cold Email",
    color: "from-emerald-500 to-teal-600",
    glow: "rgba(16,185,129,0.3)",
    endpoint: "/api/intelligence-tools/cold-email-weapon",
  },
  {
    id: "offer-negotiator",
    icon: DollarSign,
    title: "Offer Negotiator",
    color: "from-yellow-500 to-amber-600",
    glow: "rgba(234,179,8,0.3)",
    endpoint: "/api/intelligence-tools/offer-negotiator",
  },
  {
    id: "gap-killer",
    icon: Hourglass,
    title: "Gap Killer",
    color: "from-pink-500 to-rose-600",
    glow: "rgba(236,72,153,0.3)",
    endpoint: "/api/intelligence-tools/gap-killer",
  },
  {
    id: "attack-plan",
    icon: Crosshair,
    title: "48h Attack Plan",
    color: "from-red-500 to-orange-600",
    glow: "rgba(239,68,68,0.3)",
    endpoint: "/api/intelligence-tools/attack-plan",
  },
];

const ALL_TOOLS = [...CORE_TOOLS, ...EXTENDED_TOOLS];

// ─── Modal ────────────────────────────────────────────────────────────────────

interface Props {
  job: Job;
  onClose: () => void;
}

export default function JobPowerToolsModal({ job, onClose }: Props) {
  const { profile } = useProfile();
  const [results, setResults] = useState<Record<string, Record<string, unknown> | null>>({});
  const [loadings, setLoadings] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState(CORE_TOOLS[0].id);

  const visibleTools = expanded ? ALL_TOOLS : CORE_TOOLS;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Auto-run core 3 on open
  useEffect(() => {
    runTools(CORE_TOOLS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildPayload = (toolId: string, jd: string, resumeText: string) => {
    const backgroundSummary = resumeText?.slice(0, 500) ||
      `${profile?.name || "Candidate"} with ${profile?.experienceYears || 0} years of experience as ${profile?.currentRole || "professional"}. Skills: ${[...(profile?.skills ?? []), ...(profile?.frameworks ?? [])].slice(0, 10).join(", ")}.`;

    switch (toolId) {
      case "hiring-decoder":
        return { job_description: jd };
      case "resume-surgeon":
        return { job_description: jd, resume_text: resumeText || backgroundSummary };
      case "linkedin-infiltrator":
        return {
          job_description: jd,
          current_headline: profile?.currentRole || "",
          current_about: resumeText?.slice(0, 800) || backgroundSummary,
        };
      case "interview-trap-detector":
        return { job_description: jd, resume_text: resumeText || backgroundSummary, company: job.organization, role: job.title };
      case "cold-email-weapon":
        return { company: job.organization, role: job.title, background_summary: backgroundSummary };
      case "offer-negotiator":
        return {
          offer_details: `${job.title} at ${job.organization}. Location: ${job.location}. Salary range: ${job.salaryMin}–${job.salaryMax} ${job.currency}.`,
          role: job.title,
          company: job.organization,
          current_salary: profile?.currentSalary?.toString() || "",
        };
      case "gap-killer":
        return {
          gap_description: `Exploring new opportunities as ${job.title} at ${job.organization}. Target role focuses on: ${job.technologies.slice(0, 5).join(", ")}.`,
          gap_type: "career_change",
          target_role: job.title,
        };
      case "attack-plan":
        return { target_role: job.title, resume_text: resumeText || backgroundSummary, location: job.location };
      default:
        return { job_description: jd };
    }
  };

  const runTool = async (config: typeof ALL_TOOLS[0]) => {
    setLoadings((p) => ({ ...p, [config.id]: true }));
    setErrors((p) => ({ ...p, [config.id]: "" }));
    try {
      // Build a rich job description that always exceeds the 50-char min_length validation
      const jdFallback = [
        `Role: ${job.title}`,
        `Company: ${job.organization}`,
        `Location: ${job.location}`,
        `Work mode: ${job.workMode}`,
        `Experience required: ${job.experienceRequired}+ years`,
        `Technologies: ${job.technologies.join(", ")}`,
        `Salary: ${job.salaryMin}–${job.salaryMax} ${job.currency}`,
      ].join(". ");
      const jd = (job.description && job.description.length >= 50) ? job.description : jdFallback;
      const resumeText = profile?.resumeText || "";
      const payload = buildPayload(config.id, jd, resumeText);
      const url = `${API}${config.endpoint}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = (err as Record<string, string>).detail;
        if (res.status === 404) {
          throw new Error(`Endpoint not found on server (${url}). Make sure the backend is up to date.`);
        }
        if (res.status === 422) {
          throw new Error(`Validation error: ${JSON.stringify(detail || err)}`);
        }
        throw new Error(detail || `Server error ${res.status}`);
      }
      const data = await res.json();
      setResults((p) => ({ ...p, [config.id]: data }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      setErrors((p) => ({ ...p, [config.id]: msg }));
    } finally {
      setLoadings((p) => ({ ...p, [config.id]: false }));
    }
  };

  const runTools = (tools: typeof ALL_TOOLS) => {
    Promise.all(tools.map(runTool));
  };

  const handleExpand = () => {
    setExpanded(true);
    // Run only the extended tools that haven't run yet
    const pending = EXTENDED_TOOLS.filter((t) => !results[t.id] && !loadings[t.id] && !errors[t.id]);
    if (pending.length > 0) runTools(pending);
  };

  const runAll = () => runTools(ALL_TOOLS);

  // Switch to first completed tab automatically
  useEffect(() => {
    const firstDone = visibleTools.find((c) => results[c.id]);
    if (firstDone && !results[activeTab]) setActiveTab(firstDone.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  const anyLoading = Object.values(loadings).some(Boolean);
  const allCoreDone = CORE_TOOLS.every((c) => results[c.id] || errors[c.id]);
  const allDone = ALL_TOOLS.every((c) => results[c.id] || errors[c.id]);

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full flex flex-col rounded-2xl overflow-hidden"
        style={{
          maxWidth: expanded ? "1040px" : "880px",
          maxHeight: "90vh",
          background: "var(--bg-primary)",
          border: "1px solid var(--border-hover)",
          boxShadow: "0 32px 80px -12px rgba(0,0,0,0.8), 0 0 0 1px rgba(99,102,241,0.15)",
          transition: "max-width 0.3s ease",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="shrink-0 px-6 pt-5 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-start gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, var(--accent-deep), var(--accent))", boxShadow: "0 4px 14px -4px var(--glow-accent)" }}
            >
              <Zap className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--accent-bright)" }}>AI Job Analysis</span>
                {anyLoading && (
                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> Running…
                  </span>
                )}
                {(expanded ? allDone : allCoreDone) && !anyLoading && (
                  <span className="flex items-center gap-1 text-[10px] text-green-400">
                    <Check className="w-2.5 h-2.5" /> Complete
                  </span>
                )}
              </div>
              <h2 className="font-bold text-white text-xl leading-tight">{job.title}</h2>
              <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-1">
                <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{job.organization}</span>
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{job.experienceRequired}+ yrs</span>
                {profile && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="flex items-center gap-1 text-green-400">
                      <Check className="w-2.5 h-2.5" />
                      {profile.name}{profile.resumeText ? " · Resume ready" : ""}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={runAll}
                disabled={anyLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all"
                style={{
                  background: anyLoading ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, var(--accent-deep), var(--accent))",
                  opacity: anyLoading ? 0.6 : 1,
                  boxShadow: anyLoading ? "none" : "0 2px 10px -2px var(--glow-accent)",
                }}
              >
                {anyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {anyLoading ? "Running…" : "Re-run All"}
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors"
                style={{ background: "var(--bg-elevated)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tab bar — scrollable */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            {visibleTools.map((cfg) => {
              const Icon = cfg.icon;
              const done = !!results[cfg.id];
              const loading = !!loadings[cfg.id];
              const active = activeTab === cfg.id;
              return (
                <button
                  key={cfg.id}
                  onClick={() => setActiveTab(cfg.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0"
                  style={{
                    background: active ? "rgba(99,102,241,0.15)" : "transparent",
                    color: active ? "var(--accent-bright)" : "var(--text-secondary)",
                    border: active ? "1px solid rgba(99,102,241,0.3)" : "1px solid transparent",
                  }}
                >
                  <Icon className="w-3 h-3 shrink-0" />
                  <span>{cfg.title}</span>
                  {loading && <Loader2 className="w-2.5 h-2.5 animate-spin ml-0.5" />}
                  {done && !loading && <Check className="w-2.5 h-2.5 text-green-400 ml-0.5" />}
                </button>
              );
            })}

            {/* Expand button — only shown when not expanded */}
            {!expanded && (
              <button
                onClick={handleExpand}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ml-1 transition-all"
                style={{
                  background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))",
                  color: "var(--accent-bright)",
                  border: "1px solid rgba(99,102,241,0.35)",
                  boxShadow: "0 0 10px -4px rgba(99,102,241,0.4)",
                }}
              >
                <Zap className="w-3 h-3" />
                + 5 More Tools
              </button>
            )}
          </div>
        </div>

        {/* ── Active tool content ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {ALL_TOOLS.map((cfg) => {
            if (cfg.id !== activeTab) return null;
            const result = results[cfg.id] ?? null;
            const loading = !!loadings[cfg.id];
            const error = errors[cfg.id] ?? "";
            return (
              <div key={cfg.id}>
                {loading && (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${cfg.color} flex items-center justify-center`}
                      style={{ boxShadow: `0 8px 24px -4px ${cfg.glow}` }}
                    >
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                    <div className="text-center">
                      <p className="text-white font-semibold">{cfg.title}</p>
                      <p className="text-slate-400 text-sm mt-1">Running multi-LLM analysis…</p>
                    </div>
                  </div>
                )}
                {error && !loading && (
                  <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <p className="text-sm text-red-400 font-medium">{error}</p>
                    {error.includes("not found on server") && (
                      <p className="text-xs text-slate-400">
                        The backend at <span className="text-amber-400 font-mono">{API}</span> doesn&apos;t have this route.
                        Redeploy the backend to Render with the latest code, or check{" "}
                        <span className="text-amber-400 font-mono">{API}/docs</span> to verify available endpoints.
                      </p>
                    )}
                    <button
                      onClick={() => runTool(cfg)}
                      className="text-xs text-red-400 hover:text-white underline"
                    >
                      Retry
                    </button>
                  </div>
                )}
                {!loading && !result && !error && (
                  <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${cfg.color} opacity-30 flex items-center justify-center`}>
                      <cfg.icon className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-slate-500 text-sm">Click ⚡ Re-run All to generate results</p>
                  </div>
                )}
                {result && !loading && (
                  <div className="space-y-4">
                    {cfg.id === "hiring-decoder" && <HiringDecoderResult r={result} />}
                    {cfg.id === "resume-surgeon" && <ResumeSurgeonResult r={result} />}
                    {cfg.id === "linkedin-infiltrator" && <LinkedInInfiltratorResult r={result} />}
                    {cfg.id === "interview-trap-detector" && <InterviewResult r={result} />}
                    {cfg.id === "cold-email-weapon" && <ColdEmailResult r={result} />}
                    {cfg.id === "offer-negotiator" && <OfferNegotiatorResult r={result} />}
                    {cfg.id === "gap-killer" && <GapKillerResult r={result} />}
                    {cfg.id === "attack-plan" && <AttackPlanResult r={result} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
