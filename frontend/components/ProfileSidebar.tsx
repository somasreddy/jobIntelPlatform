"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/ProfileContext";
import {
  User, Briefcase, Clock, MapPin, Award, Zap, TrendingUp,
  ChevronRight, ChevronDown, Cpu
} from "lucide-react";

const AI_TOOL_KEYWORDS = [
  // AI Developer / Engineering
  "langchain", "langgraph", "llamaindex", "openai api", "anthropic api",
  "claude api", "hugging face", "groq", "mistral ai", "google ai", "vertex ai",
  "aws bedrock", "azure openai", "rag", "vector database", "prompt engineering",
  "fine-tuning", "agent development", "crewai", "autogen", "semantic kernel",
  "langsmith", "ollama", "llm", "llms", "pinecone", "weaviate", "chroma",
  "pgvector", "embeddings", "ai agents", "multimodal",
  // AI User Skills
  "vibe coding", "ai prompting", "chatgpt", "copilot", "midjourney",
  "stable diffusion", "dall-e", "perplexity", "cursor ide", "windsurf ide",
  "claude (anthropic)", "gemini", "ai-assisted", "no-code ai", "low-code ai",
  "ai automation", "ai generalist", "ai application", "ai workflow",
  "ai content", "ai image", "ai video", "runway ml", "elevenlabs",
  "github copilot", "notion ai", "make (integromat)", "zapier ai", "n8n ai",
];

function isAiTool(skill: string): boolean {
  return AI_TOOL_KEYWORDS.some((k) => skill.toLowerCase().includes(k));
}

function SkillPill({ label, variant = "default" }: { label: string; variant?: "default" | "ai" | "cert" }) {
  const styles: Record<string, string> = {
    default: "bg-white/5 text-slate-300 border-white/10",
    ai: "border-violet-500/30 text-violet-300",
    cert: "border-amber-500/30 text-amber-300",
  };
  const bg: Record<string, string> = {
    default: "bg-white/5",
    ai: "bg-violet-500/10",
    cert: "bg-amber-500/10",
  };
  return (
    <span
      className={`inline-block text-[10px] px-2 py-0.5 rounded-full border font-medium leading-5 ${styles[variant]} ${bg[variant]}`}
    >
      {label}
    </span>
  );
}

function SectionHeader({
  title,
  count,
  open,
  onToggle,
  icon,
  accentColor,
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-1.5 mb-2 group"
      type="button"
    >
      {icon}
      <span className="text-xs font-semibold text-white flex-1 text-left">{title}</span>
      {count !== undefined && (
        <span className="text-[10px] font-medium mr-1" style={{ color: accentColor || "var(--accent-bright)" }}>
          {count}
        </span>
      )}
      <ChevronDown
        className="w-3 h-3 text-slate-500 collapse-chevron group-hover:text-slate-300 transition-colors"
        data-open={open ? "true" : "false"}
      />
    </button>
  );
}

export default function ProfileSidebar() {
  const { profile } = useProfile();
  const router = useRouter();

  // Per-section collapse state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    ai: true, skills: true, frameworks: false, languages: false, cicd: false, certs: true,
  });

  const toggleSection = (key: string) =>
    setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  if (!profile?.name) {
    return (
      <aside
        className="hidden xl:flex fixed right-0 top-0 h-screen w-72 flex-col z-30 overflow-y-auto pb-10"
        style={{ background: "var(--bg-card)", borderLeft: "1px solid var(--border)" }}
      >
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", border: "1px solid var(--border-hover)" }}
          >
            <User className="w-6 h-6" style={{ color: "var(--accent-bright)" }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">No Profile Yet</p>
            <p className="text-xs text-slate-400 mt-1">Set up your profile to see your skills summary here</p>
          </div>
          <button
            onClick={() => router.push("/profile")}
            className="text-xs px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-1.5 mac-press"
            style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent-bright)", border: "1px solid var(--border-hover)" }}
          >
            Set Up Profile <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </aside>
    );
  }

  const allSkills = profile.skills || [];
  const aiSkills = [
    ...(profile.aiTools || []),
    ...allSkills.filter(isAiTool),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const techSkills = allSkills.filter((s) => !isAiTool(s));
  const frameworks = profile.frameworks || [];
  const languages = profile.languages || [];
  const cicd = profile.cicdTools || [];
  const certs = profile.certifications || [];

  const totalSkills = allSkills.length + frameworks.length + languages.length + cicd.length + aiSkills.length;

  const scoreItems = [
    { label: "Skills", score: Math.min(35, Math.round((totalSkills / 20) * 35)), max: 35, color: "#6366f1" },
    { label: "Experience", score: (profile.experienceYears || 0) >= 8 ? 20 : (profile.experienceYears || 0) >= 4 ? 16 : (profile.experienceYears || 0) >= 1 ? 8 : 0, max: 20, color: "#06b6d4" },
    { label: "AI Tools", score: Math.min(15, aiSkills.length * 3), max: 15, color: "#a78bfa" },
    { label: "Certs", score: Math.min(10, certs.length * 5), max: 10, color: "#10b981" },
  ];
  const totalScore = Math.min(100, scoreItems.reduce((s, i) => s + i.score, 0) + (profile.currentLocation ? 5 : 0));
  const level = totalScore >= 80 ? "Expert" : totalScore >= 60 ? "Advanced" : totalScore >= 35 ? "Intermediate" : "Beginner";
  const levelColor = totalScore >= 80 ? "#10b981" : totalScore >= 60 ? "#6366f1" : totalScore >= 35 ? "#f59e0b" : "#f43f5e";
  const circ = 2 * Math.PI * 22;
  const fill = (totalScore / 100) * circ;

  return (
    <aside
      className="hidden xl:flex fixed right-0 top-0 h-screen w-72 flex-col z-30 overflow-y-auto pb-10"
      style={{ background: "var(--bg-card)", borderLeft: "1px solid var(--border)" }}
    >
      {/* Profile Header */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <svg width="48" height="48" className="-rotate-90">
              <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(30,41,59,0.8)" strokeWidth="3" />
              <circle cx="24" cy="24" r="22" fill="none"
                stroke={levelColor} strokeWidth="3"
                strokeDasharray={circ}
                strokeDashoffset={circ - fill}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1s ease-out" }}
              />
            </svg>
            <div
              className="absolute inset-0 flex items-center justify-center rounded-full text-white text-xs font-bold"
              style={{ background: "var(--bg-elevated)" }}
            >
              {profile.name?.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">{profile.name}</p>
            <p className="text-xs text-slate-400 truncate">{profile.currentRole}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: `${levelColor}20`, color: levelColor }}>
                {level}
              </span>
              <span className="text-[10px] text-slate-500">{totalScore}/100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-px" style={{ borderBottom: "1px solid var(--border)", background: "var(--border)" }}>
        {[
          { icon: Clock, label: "Experience", value: profile.experienceYears ? `${profile.experienceYears} yrs` : "—" },
          { icon: MapPin, label: "Location", value: profile.currentLocation || "—" },
          { icon: Briefcase, label: "Work Mode", value: profile.workMode || "Any" },
          { icon: Award, label: "Certs", value: certs.length > 0 ? `${certs.length} cert${certs.length > 1 ? "s" : ""}` : "None" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="px-3 py-2.5" style={{ background: "var(--bg-card)" }}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Icon className="w-3 h-3 text-slate-500" />
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">{label}</span>
            </div>
            <p className="text-xs text-slate-200 font-medium truncate">{value}</p>
          </div>
        ))}
      </div>

      {/* Score breakdown */}
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-1.5 mb-2">
          <TrendingUp className="w-3.5 h-3.5" style={{ color: "var(--accent-bright)" }} />
          <span className="text-xs font-semibold text-white">Career Score</span>
        </div>
        <div className="space-y-1.5">
          {scoreItems.map(({ label, score, max, color }) => (
            <div key={label}>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-slate-400">{label}</span>
                <span style={{ color }}>{score}/{max}</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
                <div className="h-full rounded-full" style={{ width: `${(score / max) * 100}%`, background: color, transition: "width 0.5s ease" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Tools */}
      {aiSkills.length > 0 && (
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <SectionHeader
            title="AI Tools & Skills"
            count={aiSkills.length}
            open={openSections.ai}
            onToggle={() => toggleSection("ai")}
            icon={<Cpu className="w-3.5 h-3.5 text-violet-400 shrink-0" />}
            accentColor="#a78bfa"
          />
          <div
            className="collapsible-content"
            data-open={openSections.ai ? "true" : "false"}
            style={{ maxHeight: openSections.ai ? "500px" : "0px" }}
          >
            <div className="flex flex-wrap gap-1 pt-0.5">
              {aiSkills.map((s) => <SkillPill key={s} label={s} variant="ai" />)}
            </div>
          </div>
        </div>
      )}

      {/* Tech Skills */}
      {techSkills.length > 0 && (
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <SectionHeader
            title="Skills"
            count={techSkills.length}
            open={openSections.skills}
            onToggle={() => toggleSection("skills")}
            icon={<Zap className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent-bright)" }} />}
          />
          <div
            className="collapsible-content"
            data-open={openSections.skills ? "true" : "false"}
            style={{ maxHeight: openSections.skills ? "500px" : "0px" }}
          >
            <div className="flex flex-wrap gap-1 pt-0.5">
              {techSkills.slice(0, 24).map((s) => <SkillPill key={s} label={s} />)}
              {techSkills.length > 24 && (
                <span className="text-[10px] text-slate-500 self-center">+{techSkills.length - 24} more</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Frameworks */}
      {frameworks.length > 0 && (
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <SectionHeader
            title="Frameworks"
            count={frameworks.length}
            open={openSections.frameworks}
            onToggle={() => toggleSection("frameworks")}
            icon={<span className="w-3.5 h-3.5 text-[10px] font-bold text-cyan-400 shrink-0">{"{}"}</span>}
            accentColor="#22d3ee"
          />
          <div
            className="collapsible-content"
            data-open={openSections.frameworks ? "true" : "false"}
            style={{ maxHeight: openSections.frameworks ? "500px" : "0px" }}
          >
            <div className="flex flex-wrap gap-1 pt-0.5">
              {frameworks.map((s) => <SkillPill key={s} label={s} />)}
            </div>
          </div>
        </div>
      )}

      {/* Languages */}
      {languages.length > 0 && (
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <SectionHeader
            title="Languages"
            count={languages.length}
            open={openSections.languages}
            onToggle={() => toggleSection("languages")}
            icon={<span className="w-3.5 h-3.5 text-[10px] font-bold text-emerald-400 shrink-0">{"<>"}</span>}
            accentColor="#34d399"
          />
          <div
            className="collapsible-content"
            data-open={openSections.languages ? "true" : "false"}
            style={{ maxHeight: openSections.languages ? "500px" : "0px" }}
          >
            <div className="flex flex-wrap gap-1 pt-0.5">
              {languages.map((s) => <SkillPill key={s} label={s} />)}
            </div>
          </div>
        </div>
      )}

      {/* CI/CD */}
      {cicd.length > 0 && (
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <SectionHeader
            title="CI/CD & DevOps"
            count={cicd.length}
            open={openSections.cicd}
            onToggle={() => toggleSection("cicd")}
            icon={<span className="w-3.5 h-3.5 text-[10px] font-bold text-orange-400 shrink-0">{"⚙"}</span>}
            accentColor="#fb923c"
          />
          <div
            className="collapsible-content"
            data-open={openSections.cicd ? "true" : "false"}
            style={{ maxHeight: openSections.cicd ? "500px" : "0px" }}
          >
            <div className="flex flex-wrap gap-1 pt-0.5">
              {cicd.map((s) => <SkillPill key={s} label={s} />)}
            </div>
          </div>
        </div>
      )}

      {/* Certifications */}
      {certs.length > 0 && (
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <SectionHeader
            title="Certifications"
            count={certs.length}
            open={openSections.certs}
            onToggle={() => toggleSection("certs")}
            icon={<Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
            accentColor="#fbbf24"
          />
          <div
            className="collapsible-content"
            data-open={openSections.certs ? "true" : "false"}
            style={{ maxHeight: openSections.certs ? "500px" : "0px" }}
          >
            <div className="flex flex-wrap gap-1 pt-0.5">
              {certs.map((s) => <SkillPill key={s} label={s} variant="cert" />)}
            </div>
          </div>
        </div>
      )}

      {/* Edit profile link */}
      <div className="px-4 py-3 mt-auto">
        <button
          onClick={() => router.push("/profile")}
          className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-xl font-medium transition-all mac-press"
          style={{
            background: "color-mix(in srgb, var(--accent) 10%, transparent)",
            color: "var(--accent-bright)",
            border: "1px solid var(--border)",
          }}
        >
          <User className="w-3.5 h-3.5" />
          Edit Profile
        </button>
      </div>
    </aside>
  );
}
