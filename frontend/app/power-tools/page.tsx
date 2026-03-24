"use client";
import { useState, useEffect } from "react";
import {
  Search, FileText, Linkedin, AlertTriangle, Mail,
  DollarSign, Clock, Crosshair, ChevronDown, ChevronUp,
  Loader2, Copy, Check, Zap, User, ChevronRight
} from "lucide-react";
import { useProfile } from "@/lib/ProfileContext";
import { CandidateProfile } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Build a background summary string from profile fields
function buildBackgroundSummary(p: CandidateProfile): string {
  const parts: string[] = [];
  if (p.name) parts.push(p.name);
  if (p.currentRole) parts.push(`is a ${p.currentRole}`);
  if (p.experienceYears) parts.push(`with ${p.experienceYears} years of experience`);
  if (p.currentLocation) parts.push(`based in ${p.currentLocation}`);
  let summary = parts.join(" ") + ".";
  const techParts: string[] = [];
  if (p.skills?.length) techParts.push(`Skills: ${p.skills.slice(0, 8).join(", ")}`);
  if (p.frameworks?.length) techParts.push(`Frameworks: ${p.frameworks.slice(0, 5).join(", ")}`);
  if (p.languages?.length) techParts.push(`Languages: ${p.languages.slice(0, 5).join(", ")}`);
  if (techParts.length) summary += " " + techParts.join(". ") + ".";
  if (p.certifications?.length) summary += ` Certifications: ${p.certifications.join(", ")}.`;
  return summary;
}

// ─── Tool definitions ─────────────────────────────────────────────────────────
const TOOLS = [
  {
    id: "hiring-decoder",
    icon: Search,
    title: "Hiring Manager Decoder",
    subtitle: "Decode what the JD really means",
    color: "from-violet-500 to-purple-600",
    glow: "rgba(139,92,246,0.3)",
    fields: [
      { key: "job_description", label: "Job Description", type: "textarea", placeholder: "Paste the full job description here..." },
    ],
    endpoint: "/api/intelligence-tools/hiring-decoder",
    renderResult: (r: Record<string, unknown>) => (
      <div className="space-y-4">
        <Section title="Real Problem Being Solved" content={r.real_problem as string} />
        <ListSection title="Instant Forward Signals" items={r.instant_forward as string[]} color="text-green-400" />
        <ListSection title="Instant Reject Signals" items={r.instant_reject as string[]} color="text-red-400" />
        <Section title="Day-to-Day Priorities" content={r.day_to_day_priorities as string} />
        <ListSection title="Hidden Requirements" items={r.hidden_requirements as string[]} color="text-yellow-400" />
        <Section title="Culture Signals" content={r.culture_signals as string} />
        {(r.red_flags_in_jd as string[])?.length > 0 && (
          <ListSection title="Red Flags in JD" items={r.red_flags_in_jd as string[]} color="text-orange-400" />
        )}
      </div>
    ),
  },
  {
    id: "resume-surgeon",
    icon: FileText,
    title: "Resume Surgeon",
    subtitle: "Full resume rewrite for this exact role",
    color: "from-blue-500 to-cyan-600",
    glow: "rgba(59,130,246,0.3)",
    fields: [
      { key: "job_description", label: "Job Description", type: "textarea", placeholder: "Paste the full job description..." },
    ],
    endpoint: "/api/intelligence-tools/resume-surgeon",
    renderResult: (r: Record<string, unknown>) => (
      <div className="space-y-4">
        <Section title="Rewritten Summary" content={r.summary as string} />
        {(r.experience as Array<{role:string;company:string;duration?:string;bullets:string[]}>)?.map((exp, i) => (
          <div key={i} className="rounded-xl p-4 border border-white/10" style={{ background: "var(--bg-elevated)" }}>
            <p className="font-semibold text-white">{exp.role} — {exp.company} {exp.duration && <span className="text-slate-400 font-normal text-xs">({exp.duration})</span>}</p>
            <ul className="mt-2 space-y-1.5">
              {exp.bullets?.map((b, j) => <li key={j} className="text-sm text-slate-300 flex gap-2"><span className="text-cyan-400 mt-0.5">▸</span>{b}</li>)}
            </ul>
          </div>
        ))}
        {!!r.skills && (
          <div className="rounded-xl p-4 border border-white/10" style={{ background: "var(--bg-elevated)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Skills</p>
            {Object.entries(r.skills as Record<string, string[]>).map(([cat, items]) => (
              <p key={cat} className="text-sm text-slate-300 mb-1"><span className="text-white font-medium">{cat}: </span>{(items as string[]).join(", ")}</p>
            ))}
          </div>
        )}
        {(r.ats_keywords_embedded as string[])?.length > 0 && (
          <TagList title="ATS Keywords Embedded" tags={r.ats_keywords_embedded as string[]} color="bg-blue-500/20 text-blue-300" />
        )}
        {typeof r.ats_score_estimate === "number" && (
          <div className="flex items-center gap-2 text-sm"><span className="text-slate-400">Estimated ATS Score:</span><span className="text-green-400 font-bold text-lg">{r.ats_score_estimate}%</span></div>
        )}
      </div>
    ),
  },
  {
    id: "linkedin-infiltrator",
    icon: Linkedin,
    title: "LinkedIn Infiltrator",
    subtitle: "Get found by recruiters for this role",
    color: "from-sky-500 to-blue-600",
    glow: "rgba(14,165,233,0.3)",
    fields: [
      { key: "job_description", label: "Job Description", type: "textarea", placeholder: "Paste the full job description..." },
      { key: "current_headline", label: "Current LinkedIn Headline", type: "text", placeholder: "e.g. Senior Engineer at Acme Corp" },
      { key: "current_about", label: "Current About Section (optional)", type: "textarea", placeholder: "Paste your current LinkedIn About section..." },
    ],
    endpoint: "/api/intelligence-tools/linkedin-infiltrator",
    renderResult: (r: Record<string, unknown>) => (
      <div className="space-y-4">
        <CopyBlock title="Optimized Headline" content={r.optimized_headline as string} />
        <CopyBlock title="Optimized About Section" content={r.optimized_about as string} />
        <ListSection title="Recruiter Search Strings" items={r.search_strings as string[]} color="text-sky-400" mono />
        <Section title="Boolean Search" content={r.boolean_search as string} mono />
        <ListSection title="Missing Keywords to Add" items={r.missing_keywords as string[]} color="text-yellow-400" />
        <ListSection title="Profile Quick Wins" items={r.profile_quick_wins as string[]} color="text-green-400" />
        <Section title="Connection Strategy" content={r.connection_strategy as string} />
      </div>
    ),
  },
  {
    id: "interview-trap-detector",
    icon: AlertTriangle,
    title: "Interview Trap Detector",
    subtitle: "10 likely questions + trap detection + strong answers",
    color: "from-orange-500 to-red-600",
    glow: "rgba(249,115,22,0.3)",
    fields: [
      { key: "role", label: "Role Title", type: "text", placeholder: "e.g. Senior Product Manager", profileKey: "currentRole" },
      { key: "company", label: "Company", type: "text", placeholder: "e.g. Stripe" },
      { key: "job_description", label: "Job Description", type: "textarea", placeholder: "Paste the full job description..." },
    ],
    endpoint: "/api/intelligence-tools/interview-trap-detector",
    renderResult: (r: Record<string, unknown>) => (
      <div className="space-y-4">
        {(r.questions as Array<{
          question:string; type:string; difficulty:string; is_trap:boolean;
          trap_reason:string; strong_answer:string; avoid_saying:string; time_estimate:string
        }>)?.map((q, i) => (
          <div key={i} className="rounded-xl p-4 border border-white/10 space-y-2" style={{ background: "var(--bg-elevated)" }}>
            <div className="flex items-start gap-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: q.is_trap ? "rgba(239,68,68,0.15)" : "rgba(99,102,241,0.15)", color: q.is_trap ? "#f87171" : "#a5b4fc" }}>
                {q.is_trap ? "⚠ Trap" : q.type}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-white/5 text-slate-400">{q.difficulty}</span>
              {q.time_estimate && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-white/5 text-slate-400">{q.time_estimate}</span>}
            </div>
            <p className="font-medium text-white">{q.question}</p>
            {q.trap_reason && <p className="text-xs text-orange-400">⚠ What they&apos;re really testing: {q.trap_reason}</p>}
            <div className="rounded-lg p-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <p className="text-xs font-semibold text-green-400 mb-1">Strong Answer</p>
              <p className="text-sm text-slate-300">{q.strong_answer}</p>
            </div>
            {q.avoid_saying && <p className="text-xs text-red-400">✕ Avoid: {q.avoid_saying}</p>}
          </div>
        ))}
        <ListSection title="Core Themes to Prepare For" items={r.core_themes as string[]} color="text-violet-400" />
        <ListSection title="Must-Prepare STAR Stories" items={r.must_prepare_stories as string[]} color="text-blue-400" />
        <ListSection title="Smart Questions to Ask the Interviewer" items={r.smart_questions_to_ask as string[]} color="text-emerald-400" />
      </div>
    ),
  },
  {
    id: "cold-email-weapon",
    icon: Mail,
    title: "Cold Email Weapon",
    subtitle: "Email, LinkedIn note + voice script + follow-ups",
    color: "from-emerald-500 to-teal-600",
    glow: "rgba(16,185,129,0.3)",
    fields: [
      { key: "company", label: "Target Company", type: "text", placeholder: "e.g. Stripe" },
      { key: "role", label: "Target Role", type: "text", placeholder: "e.g. Senior Engineer" },
    ],
    endpoint: "/api/intelligence-tools/cold-email-weapon",
    renderResult: (r: Record<string, unknown>) => {
      const email = r.email as { subject: string; body: string; ps_line: string };
      const seq = r.follow_up_sequence as Array<{day:number;channel:string;message:string}>;
      return (
        <div className="space-y-4">
          <div className="rounded-xl p-4 border border-white/10" style={{ background: "var(--bg-elevated)" }}>
            <p className="text-xs font-semibold text-slate-400 mb-1">Subject Line</p>
            <CopyInline content={email?.subject} />
            <p className="text-xs font-semibold text-slate-400 mt-3 mb-1">Email Body</p>
            <CopyBlock content={email?.body} />
            {email?.ps_line && <p className="text-xs text-slate-400 mt-2">{email.ps_line}</p>}
          </div>
          <CopyBlock title="LinkedIn Connection Note" content={r.linkedin_connection_note as string} />
          <CopyBlock title="Voice Note Script (60 sec)" content={r.voice_note_script as string} />
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Follow-Up Sequence</p>
            {seq?.map((s, i) => (
              <div key={i} className="rounded-lg p-3 border border-white/10" style={{ background: "var(--bg-elevated)" }}>
                <p className="text-xs text-slate-400 mb-1">Day {s.day} · {s.channel}</p>
                <p className="text-sm text-slate-300">{s.message}</p>
              </div>
            ))}
          </div>
          {r.send_timing ? <Section title="Best Send Timing" content={r.send_timing as string} /> : null}
        </div>
      );
    },
  },
  {
    id: "offer-negotiator",
    icon: DollarSign,
    title: "Offer Negotiator",
    subtitle: "Word-for-word scripts to negotiate your offer",
    color: "from-yellow-500 to-amber-600",
    glow: "rgba(234,179,8,0.3)",
    fields: [
      { key: "role", label: "Role Title", type: "text", placeholder: "e.g. Staff Engineer", profileKey: "currentRole" },
      { key: "company", label: "Company", type: "text", placeholder: "e.g. Stripe" },
      { key: "current_salary", label: "Current / Expected Salary", type: "text", placeholder: "e.g. $130,000" },
      { key: "offer_details", label: "Full Offer Details", type: "textarea", placeholder: "Base: $140k, Equity: 20k RSUs over 4 years, Bonus: 10%, PTO: 15 days..." },
    ],
    endpoint: "/api/intelligence-tools/offer-negotiator",
    renderResult: (r: Record<string, unknown>) => {
      const counter = r.counter_offer as { recommended_base:number; justification:string; live_call_script:string; counter_script:string };
      const levers = r.alternative_levers as Record<string,string>;
      return (
        <div className="space-y-4">
          <Section title="Market Assessment" content={r.market_assessment as string} />
          {counter?.recommended_base > 0 && (
            <div className="rounded-xl p-4 border border-yellow-500/30" style={{ background: "rgba(234,179,8,0.08)" }}>
              <p className="text-xs font-semibold text-yellow-400 mb-1">Recommended Counter Offer</p>
              <p className="text-2xl font-bold text-white">${counter.recommended_base.toLocaleString()}</p>
              <p className="text-sm text-slate-300 mt-1">{counter.justification}</p>
            </div>
          )}
          <CopyBlock title="When They Call — Live Script" content={counter?.live_call_script} />
          <CopyBlock title="Counter Offer Script" content={counter?.counter_script} />
          <CopyBlock title="If They Say 'Best Offer'" content={r.if_they_say_best_offer as string} />
          {levers && (
            <div className="rounded-xl p-4 border border-white/10 space-y-2" style={{ background: "var(--bg-elevated)" }}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Alternative Levers</p>
              {Object.entries(levers).map(([k, v]) => (
                <div key={k}><p className="text-xs font-semibold text-yellow-300 capitalize">{k.replace(/_/g, " ")}</p><p className="text-sm text-slate-300">{v}</p></div>
              ))}
            </div>
          )}
          <CopyBlock title="Counter Offer Email" content={r.counter_offer_email as string} />
          {(r.red_flags as string[])?.length > 0 && <ListSection title="Red Flags in This Offer" items={r.red_flags as string[]} color="text-red-400" />}
          <Section title="Walk Away Threshold" content={r.walk_away_threshold as string} />
        </div>
      );
    },
  },
  {
    id: "gap-killer",
    icon: Clock,
    title: "Gap Killer",
    subtitle: "Turn your career gap into a strength",
    color: "from-pink-500 to-rose-600",
    glow: "rgba(236,72,153,0.3)",
    fields: [
      { key: "target_role", label: "Target Role", type: "text", placeholder: "e.g. Senior Data Analyst", profileKey: "currentRole" },
      { key: "gap_type", label: "Gap Type", type: "select", options: ["layoff", "career_change", "sabbatical", "health_break", "family", "other"] },
      { key: "gap_description", label: "Describe Your Situation (honestly)", type: "textarea", placeholder: "e.g. I was laid off in Jan 2024 when my company had a round of cuts. I spent 3 months traveling, then completed a Google Data Analytics certification..." },
    ],
    endpoint: "/api/intelligence-tools/gap-killer",
    renderResult: (r: Record<string, unknown>) => (
      <div className="space-y-4">
        <CopyBlock title="Interview Answer (≤45 sec)" content={r.interview_answer as string} />
        <CopyBlock title="Cover Letter Sentences" content={r.cover_letter_sentences as string} />
        <CopyBlock title="LinkedIn / Networking Reframe" content={r.linkedin_reframe as string} />
        <Section title="Core Narrative Strategy" content={r.narrative_strategy as string} />
        <Section title="Gap Type Playbook" content={r.gap_type_playbook as string} />
        <Section title="Why This Makes You Stronger" content={r.reframe_as_strength as string} />
        <ListSection title="Skills to Highlight From This Period" items={r.skills_gained as string[]} color="text-green-400" />
        <ListSection title="Language to Avoid" items={r.language_to_avoid as string[]} color="text-red-400" />
      </div>
    ),
  },
  {
    id: "attack-plan",
    icon: Crosshair,
    title: "48-Hour Attack Plan",
    subtitle: "Hyper-actionable job search plan starting now",
    color: "from-red-500 to-orange-600",
    glow: "rgba(239,68,68,0.3)",
    fields: [
      { key: "target_role", label: "Target Role", type: "text", placeholder: "e.g. Head of Marketing", profileKey: "currentRole" },
      { key: "location", label: "Location / Remote Preference", type: "text", placeholder: "e.g. New York, NY or Remote", profileKey: "currentLocation" },
    ],
    endpoint: "/api/intelligence-tools/attack-plan",
    renderResult: (r: Record<string, unknown>) => {
      const post = r.linkedin_post as { full_content:string; hashtags:string[]; best_posting_time:string };
      const referral = r.referral_outreach as { subject_line:string; message_template:string };
      const hours = r.hour_by_hour as Record<string,string[]>;
      const targets = r.target_companies as Array<{company_type:string;why_strong_fit:string;linkedin_search_string:string;insider_tip:string}>;
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target Companies</p>
            {targets?.map((t, i) => (
              <div key={i} className="rounded-xl p-4 border border-white/10" style={{ background: "var(--bg-elevated)" }}>
                <p className="font-semibold text-white">{t.company_type}</p>
                <p className="text-sm text-slate-300 mt-1">{t.why_strong_fit}</p>
                <p className="text-xs text-sky-400 mt-1 font-mono">{t.linkedin_search_string}</p>
                <p className="text-xs text-yellow-400 mt-1">Tip: {t.insider_tip}</p>
              </div>
            ))}
          </div>
          {hours && (
            <div className="rounded-xl p-4 border border-white/10" style={{ background: "var(--bg-elevated)" }}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Hour-by-Hour Plan</p>
              {Object.entries(hours).map(([range, actions]) => (
                <div key={range} className="mb-3">
                  <p className="text-xs font-semibold text-orange-400 mb-1">{range.replace(/_/g, " ").replace("to", "→")}</p>
                  <ul className="space-y-1">{(actions as string[]).map((a, i) => <li key={i} className="text-sm text-slate-300 flex gap-2"><span className="text-orange-500 mt-0.5">▸</span>{a}</li>)}</ul>
                </div>
              ))}
            </div>
          )}
          <CopyBlock title="LinkedIn Post (Publish Today)" content={post?.full_content} />
          {post?.hashtags && <TagList title="Hashtags" tags={post.hashtags} color="bg-sky-500/20 text-sky-300" />}
          <CopyBlock title="Referral Outreach — Subject" content={referral?.subject_line} />
          <CopyBlock title="Referral Message Template" content={referral?.message_template} />
          {(r.momentum_killers as string[])?.length > 0 && <ListSection title="Momentum Killers to Avoid" items={r.momentum_killers as string[]} color="text-red-400" />}
        </div>
      );
    },
  },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, content, mono }: { title?: string; content?: string; mono?: boolean }) {
  if (!content) return null;
  return (
    <div>
      {title && <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{title}</p>}
      <p className={`text-sm text-slate-300 leading-relaxed ${mono ? "font-mono text-xs" : ""}`}>{content}</p>
    </div>
  );
}

function ListSection({ title, items, color, mono }: { title: string; items?: string[]; color: string; mono?: boolean }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className={`text-sm flex gap-2 ${color} ${mono ? "font-mono text-xs" : ""}`}>
            <span className="mt-0.5 shrink-0">▸</span>{item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TagList({ title, tags, color }: { title: string; tags?: string[]; color: string }) {
  if (!tags?.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t, i) => <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${color}`}>{t}</span>)}
      </div>
    </div>
  );
}

function CopyInline({ content }: { content?: string }) {
  const [copied, setCopied] = useState(false);
  if (!content) return null;
  const copy = () => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="flex items-center gap-2">
      <p className="text-sm text-white font-medium flex-1">{content}</p>
      <button onClick={copy} className="p-1 rounded text-slate-400 hover:text-white transition-colors">
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
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

// ─── Profile Banner ────────────────────────────────────────────────────────────

function ProfileBanner({ profile, globalResume, onResumeChange }: {
  profile: CandidateProfile | null;
  globalResume: string;
  onResumeChange: (v: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasProfile = !!profile?.name;
  const totalSkills = [
    ...(profile?.skills ?? []),
    ...(profile?.frameworks ?? []),
    ...(profile?.languages ?? []),
    ...(profile?.aiTools ?? []),
  ].length;

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all duration-300"
      style={{
        background: hasProfile
          ? "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06))"
          : "var(--bg-card)",
        border: hasProfile ? "1px solid rgba(99,102,241,0.3)" : "1px solid var(--border)",
      }}
    >
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: hasProfile
              ? "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))"
              : "var(--bg-elevated)",
          }}
        >
          <User className="w-4 h-4" style={{ color: hasProfile ? "var(--accent-bright)" : "var(--text-muted)" }} />
        </div>
        <div className="flex-1 min-w-0">
          {hasProfile ? (
            <>
              <p className="font-semibold text-white text-sm">{profile!.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {profile!.currentRole}
                {profile!.experienceYears ? ` · ${profile!.experienceYears} yrs` : ""}
                {totalSkills > 0 ? ` · ${totalSkills} skills loaded` : ""}
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-slate-400 text-sm">No profile loaded</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Save your profile on the{" "}
                <a href="/" className="underline" style={{ color: "var(--accent-bright)" }}>Profile page</a>{" "}
                to auto-fill tool inputs
              </p>
            </>
          )}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
        >
          Resume {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Skill tags */}
      {hasProfile && (
        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          {[...(profile!.skills ?? []), ...(profile!.frameworks ?? [])].slice(0, 10).map((s, i) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(99,102,241,0.12)", color: "var(--accent-bright)", border: "1px solid rgba(99,102,241,0.2)" }}>
              {s}
            </span>
          ))}
          {totalSkills > 10 && (
            <span className="text-xs px-2 py-0.5 rounded-full text-slate-500" style={{ background: "var(--bg-elevated)" }}>
              +{totalSkills - 10} more
            </span>
          )}
        </div>
      )}

      {/* Expandable resume textarea */}
      {expanded && (
        <div className="px-5 pb-5 space-y-2">
          <div className="h-px" style={{ background: "var(--border)" }} />
          <label className="block text-xs font-medium text-slate-400 mt-3">
            Resume / Background
            {globalResume && <span className="ml-2 text-green-400 font-normal">· loaded from profile</span>}
          </label>
          <textarea
            rows={8}
            className="w-full rounded-xl px-3 py-2.5 text-sm text-white resize-none outline-none transition-colors"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", lineHeight: "1.6" }}
            placeholder="Paste your resume as plain text, or save your profile on the Profile page to auto-load it here..."
            value={globalResume}
            onChange={(e) => onResumeChange(e.target.value)}
            onFocus={(e) => (e.target.style.borderColor = "var(--border-hover)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
          <p className="text-xs text-slate-500">
            This resume is automatically injected into Resume Surgeon, Interview Prep, Cold Email, and Attack Plan tools.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Tool Card ────────────────────────────────────────────────────────────────

type ToolDef = typeof TOOLS[0];
type FieldDef = ToolDef["fields"][0] & { profileKey?: keyof CandidateProfile; options?: string[] };

function ToolCard({
  tool,
  globalResume,
  profile,
}: {
  tool: ToolDef;
  globalResume: string;
  profile: CandidateProfile | null;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  // Auto-fill profile-derived fields when profile loads or tool opens
  useEffect(() => {
    if (!profile || !open) return;
    setValues((prev) => {
      const next = { ...prev };
      (tool.fields as FieldDef[]).forEach((f) => {
        if (f.profileKey && !next[f.key]) {
          const val = profile[f.profileKey];
          if (typeof val === "string" && val) next[f.key] = val;
          else if (typeof val === "number" && val) next[f.key] = String(val);
        }
      });
      return next;
    });
  }, [open, profile, tool.fields]);

  const Icon = tool.icon;

  const run = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      // Build payload: merge tool values + global context
      const payload: Record<string, string> = { ...values };

      // Inject resume text for tools that need it (backend uses resume_text key)
      const needsResume = ["resume-surgeon", "interview-trap-detector", "attack-plan"].includes(tool.id);
      if (needsResume && globalResume && !payload.resume_text) {
        payload.resume_text = globalResume;
      }

      // Cold Email Weapon: inject background_summary from profile if not set
      if (tool.id === "cold-email-weapon" && !payload.background_summary && profile) {
        payload.background_summary = buildBackgroundSummary(profile);
      } else if (tool.id === "cold-email-weapon" && !payload.background_summary && globalResume) {
        payload.background_summary = globalResume.slice(0, 500);
      }

      const res = await fetch(`${API}${tool.endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status}`);
      }
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="rounded-2xl border transition-all duration-200"
      style={{
        background: "var(--bg-card)",
        border: open ? "1px solid var(--border-hover)" : "1px solid var(--border)",
        boxShadow: open ? `0 0 24px -8px ${tool.glow}` : "none",
      }}
    >
      {/* Header */}
      <button
        className="w-full flex items-center gap-4 p-5 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div
          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center shrink-0`}
          style={{ boxShadow: `0 4px 14px -4px ${tool.glow}` }}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">{tool.title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{tool.subtitle}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {/* Body */}
      {open && (
        <div className="px-5 pb-5 space-y-4">
          <div className="h-px" style={{ background: "var(--border)" }} />

          {/* Fields */}
          <div className="space-y-3">
            {(tool.fields as FieldDef[]).map((field) => (
              <div key={field.key}>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-xs font-medium text-slate-400">{field.label}</label>
                  {field.profileKey && profile?.[field.profileKey] && values[field.key] === String(profile[field.profileKey]) && (
                    <span className="text-xs text-green-400 flex items-center gap-0.5">
                      <ChevronRight className="w-2.5 h-2.5" />from profile
                    </span>
                  )}
                </div>
                {field.type === "textarea" ? (
                  <textarea
                    rows={4}
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-white resize-none outline-none transition-colors"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", lineHeight: "1.6" }}
                    placeholder={field.placeholder}
                    value={values[field.key] || ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                    onFocus={(e) => (e.target.style.borderColor = "var(--border-hover)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                  />
                ) : field.type === "select" ? (
                  <select
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                    value={values[field.key] || ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  >
                    <option value="">Select gap type...</option>
                    {field.options?.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none transition-colors"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                    placeholder={field.placeholder}
                    value={values[field.key] || ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                    onFocus={(e) => (e.target.style.borderColor = "var(--border-hover)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Context indicators */}
          {(globalResume || profile) && (
            <div className="flex flex-wrap gap-2">
              {globalResume && ["resume-surgeon", "interview-trap-detector", "attack-plan"].includes(tool.id) && (
                <span className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: "rgba(34,197,94,0.08)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <Check className="w-2.5 h-2.5" /> Resume auto-loaded
                </span>
              )}
              {profile && tool.id === "cold-email-weapon" && (
                <span className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: "rgba(34,197,94,0.08)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <Check className="w-2.5 h-2.5" /> Background auto-generated from profile
                </span>
              )}
            </div>
          )}

          {/* Run button */}
          <button
            onClick={run}
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all"
            style={{
              background: loading ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, var(--accent-deep), var(--accent))`,
              opacity: loading ? 0.7 : 1,
              boxShadow: loading ? "none" : `0 4px 14px -4px var(--glow-accent)`,
            }}
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Running all LLMs...</> : <><Zap className="w-4 h-4" />Run Tool</>}
          </button>

          {error && (
            <div className="rounded-xl p-3 text-sm text-red-400" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-xl p-4 border border-white/10 space-y-4" style={{ background: "rgba(255,255,255,0.02)" }}>
              <p className="text-xs font-semibold text-green-400 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> AI Analysis Complete
              </p>
              {tool.renderResult(result)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PowerToolsPage() {
  const { profile } = useProfile();
  const [globalResume, setGlobalResume] = useState("");

  useEffect(() => {
    if (profile?.resumeText) setGlobalResume(profile.resumeText);
  }, [profile]);

  return (
    <div className="min-h-screen md:ml-64 xl:mr-72 p-6 md:p-8 space-y-6" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, var(--accent-deep), var(--accent))", boxShadow: "0 4px 14px -4px var(--glow-accent)" }}
          >
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Power Tools</h1>
            <p className="text-sm text-slate-400">8 AI weapons to dominate your job search — powered by multi-LLM consolidated intelligence</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {["Hiring Manager Decoder", "Resume Surgeon", "LinkedIn Infiltrator", "Interview Trap Detector", "Cold Email Weapon", "Offer Negotiator", "Gap Killer", "48-Hour Attack Plan"].map((label, i) => (
            <span key={i} className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: "var(--bg-elevated)", color: "var(--accent-bright)", border: "1px solid var(--border)" }}>
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Global Profile + Resume panel */}
      <div className="max-w-3xl">
        <ProfileBanner
          profile={profile}
          globalResume={globalResume}
          onResumeChange={setGlobalResume}
        />
      </div>

      {/* Tool Grid */}
      <div className="space-y-3 max-w-3xl">
        {TOOLS.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            globalResume={globalResume}
            profile={profile}
          />
        ))}
      </div>
    </div>
  );
}
