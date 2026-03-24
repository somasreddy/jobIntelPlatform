"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/ProfileContext";
import { CandidateProfile } from "@/lib/types";
import { getQuestionsForRole, getAllQuestionsForDomain, QuestionBankItem, ALL_DOMAINS } from "@/lib/questionBank";
import {
  Brain, Sparkles, ChevronDown, ChevronUp,
  MessageSquare, Code2, Users, Lightbulb, Target,
  Star, UserCircle2, RefreshCw, ClipboardList, Trophy,
  BookOpen, Cpu, GitMerge, Database, Cloud, Globe2, TestTube2, BarChart2,
  Timer, Zap, Coffee, MousePointerClick, Shield,
} from "lucide-react";

// ─── Local interview question type (profile-personalised behavioral) ───────────
interface LocalQuestion {
  id: string;
  domain: string;
  type: "behavioral" | "technical" | "situational" | "leadership";
  difficulty: "Easy" | "Medium" | "Hard";
  question: string;
  hint: string;
  keyPoints: string[];
  modelAnswer?: string;
  starTemplate?: { situation: string; task: string; action: string; result: string };
}

type AnyQuestion = LocalQuestion | QuestionBankItem;

const TYPE_META = {
  behavioral:  { label: "Behavioural",  icon: Users,    color: "text-indigo-400",  bg: "bg-indigo-500/10 border-indigo-500/25" },
  technical:   { label: "Technical",    icon: Code2,    color: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/25" },
  situational: { label: "Situational",  icon: Lightbulb, color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/25" },
  leadership:  { label: "Leadership",   icon: Trophy,   color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/25" },
};

const DIFF_COLOR = { Easy: "text-emerald-400", Medium: "text-amber-400", Hard: "text-rose-400" };

const DOMAIN_META: Record<string, { icon: React.ComponentType<{ className?: string }>, color: string }> = {
  "Behavioral":        { icon: Users,      color: "text-indigo-400" },
  "Leadership":        { icon: Trophy,     color: "text-purple-400" },
  "DSA":               { icon: Cpu,        color: "text-cyan-400" },
  "System Design":     { icon: BarChart2,  color: "text-violet-400" },
  "CI/CD & DevOps":    { icon: GitMerge,   color: "text-orange-400" },
  "B2B Integration":   { icon: Globe2,     color: "text-emerald-400" },
  "API Management":    { icon: Cloud,      color: "text-sky-400" },
  "Databases":         { icon: Database,   color: "text-amber-400" },
  "Cloud":             { icon: Cloud,      color: "text-blue-400" },
  "QA & Testing":        { icon: TestTube2,        color: "text-rose-400" },
  "Java & OOP":          { icon: Coffee,           color: "text-orange-400" },
  "Selenium & Testing":  { icon: MousePointerClick, color: "text-pink-400" },
  "Manual Testing":      { icon: ClipboardList,      color: "text-teal-400" },
  "Security Testing":    { icon: Shield,             color: "text-red-400" },
};

// ─── Profile-personalised behavioral + situational questions ──────────────────
function buildProfileQuestions(
  profile: CandidateProfile,
  company: string,
  exp: number,
): LocalQuestion[] {
  const skills = profile.skills ?? [];
  const s1 = skills[0] || "your primary stack";
  const s2 = skills[1] || "automation frameworks";
  const s3 = skills[2] || "cloud infrastructure";
  const resumeHint = profile.resumeText && !profile.resumeText.startsWith("[Resume file:")
    ? profile.resumeText.slice(0, 400) : "";
  const prevProject =
    resumeHint.match(/(?:built|designed|led|developed|implemented)\s+([^.,;]{10,50})/i)?.[1] ||
    `a ${s1} solution`;

  const questions: LocalQuestion[] = [
    {
      id: "b1", domain: "Behavioral", type: "behavioral", difficulty: "Medium",
      question: `Tell me about a time you delivered a complex ${s1} project under a tight deadline. How did you manage it?`,
      starTemplate: {
        situation: `We had a critical ${s1} feature that needed to ship in 2 weeks due to a client commitment.`,
        task: `I was responsible for ${prevProject} while coordinating with 3 other engineers.`,
        action: `I broke the work into daily milestones, unblocked team members proactively, and cut scope on non-essential features after aligning with the PM.`,
        result: `We shipped on time with zero regressions. The client extended the contract by 12 months as a result.`,
      },
      hint: "Focus on your decision-making process, not just the outcome. Interviewers want to see how you think under pressure.",
      keyPoints: ["Scoping & prioritisation", "Communication under pressure", "Quantified outcome"],
    },
    {
      id: "b2", domain: "Behavioral", type: "behavioral", difficulty: "Medium",
      question: `Describe a situation where you disagreed with a technical decision made by your team lead. What did you do?`,
      starTemplate: {
        situation: `Our team was adopting a new ${s2} approach I believed would create long-term maintenance issues.`,
        task: `I needed to raise the concern without undermining the team lead or damaging relationships.`,
        action: `I prepared a written comparison with pros/cons, requested a 30-min sync, and proposed a pilot on a low-risk service first.`,
        result: `The lead agreed to the pilot. Results confirmed my concerns and the team adopted my approach for all new services.`,
      },
      hint: `${company || "Top companies"} values people who push back constructively with data. Show you're principled but collaborative.`,
      keyPoints: ["Data-driven advocacy", "Diplomacy", "Outcome focus"],
    },
    {
      id: "b3", domain: "Behavioral", type: "behavioral", difficulty: "Hard",
      question: `Tell me about the most impactful project you've led in your ${exp}+ year career. What was your specific contribution?`,
      starTemplate: {
        situation: `At my previous role, the team was struggling with slow release cycles — deployments took 4 days due to manual ${s1} processes.`,
        task: `I proposed and led an initiative to automate the end-to-end pipeline using ${s2} and ${s3}.`,
        action: `Over 6 weeks, I designed the architecture, wrote the core framework, onboarded 4 engineers, and created runbooks. I presented weekly updates to stakeholders.`,
        result: `Deployment time dropped from 4 days to 45 minutes. Engineering satisfaction scores increased 30%. The approach was adopted company-wide.`,
      },
      hint: "This is your 'hero' story. Quantify impact with real numbers — time saved, defects reduced, revenue protected.",
      keyPoints: ["Leadership scope", "Technical depth", "Business impact with numbers"],
    },
    {
      id: "b4", domain: "Behavioral", type: "behavioral", difficulty: "Medium",
      question: `Tell me about a time you had to learn a new technology quickly to deliver a project. How did you approach it?`,
      starTemplate: {
        situation: `I joined a project that required ${s3}, which I hadn't used in production before.`,
        task: `I had 2 weeks to become proficient enough to deliver the integration component.`,
        action: `I followed the official documentation, built a proof-of-concept in week 1, paired with a colleague who had experience, and documented my learnings for the team.`,
        result: `Delivered the component on time with no production incidents. Created an internal guide that reduced onboarding time for two subsequent team members by 50%.`,
      },
      hint: "Highlight your learning methodology, not just that you learned it. Interviewers are assessing your growth mindset.",
      keyPoints: ["Self-directed learning", "Knowledge sharing", "Adaptability"],
    },
    {
      id: "s1", domain: "Behavioral", type: "situational", difficulty: "Medium",
      question: `You join ${company || "this company"} and discover the codebase has significant technical debt slowing the team down. The business wants features, not refactoring. How do you handle this?`,
      starTemplate: {
        situation: `Technical debt is creating a 30% overhead on every feature — bugs are frequent and onboarding takes 4 weeks.`,
        task: `I need to make the case for refactoring while keeping business stakeholders satisfied.`,
        action: `I'd quantify the debt's cost in eng hours, propose a "20% time" model embedding refactoring into feature sprints, and pick one high-leverage area to prove ROI quickly.`,
        result: `After the first 6-week cycle, feature velocity increases by 25%, which makes the business case self-evident.`,
      },
      hint: `${company || "Top engineering companies"} values engineers who balance technical excellence with business pragmatism. Show both sides.`,
      keyPoints: ["Quantifying tech debt", "Stakeholder management", "Incremental improvement"],
    },
    {
      id: "s2", domain: "Behavioral", type: "situational", difficulty: "Hard",
      question: `A critical bug is found in production 2 hours before a major product launch. Your fix is ready but needs 30 minutes of testing. The CEO wants to launch on time. What do you do?`,
      starTemplate: {
        situation: `Launch is at noon. The bug affects 20% of checkout flows. My fix is written but untested.`,
        task: `I need to make a risk assessment and communicate it clearly to leadership.`,
        action: `I run focused smoke tests on the critical path (15 min), prepare a rollback plan, brief engineering leadership with clear risk levels, and present the option: delay 45 min OR launch with a feature flag disabling the affected flow.`,
        result: `We launch on time with the flow disabled, affecting 0 customers at launch. Fix is deployed 2 hours later with full test coverage.`,
      },
      hint: "CEOs respect engineers who give clear options with trade-offs, not just 'yes' or 'no'. Show structured risk thinking.",
      keyPoints: ["Risk assessment framework", "Communication under pressure", "Rollback planning"],
    },
    ...(exp >= 4 ? [
      {
        id: "l1", domain: "Leadership", type: "leadership" as const, difficulty: "Hard" as const,
        question: `How do you build a high-performing engineering team culture? What concrete practices have you implemented?`,
        starTemplate: {
          situation: `I inherited a team of 6 engineers with low morale, 40% test coverage, and no clear engineering standards.`,
          task: `Transform team culture and output quality within 6 months.`,
          action: `I introduced weekly 1:1s focused on growth, blameless post-mortems, a team charter for engineering standards, pairing sessions, and quarterly retros with action items. I also created growth ladders so engineers knew their paths forward.`,
          result: `Attrition dropped to zero, test coverage reached 82%, and the team shipped 40% more features in H2 vs H1. Two engineers got promotions.`,
        },
        hint: "Great teams are built through psychological safety, clear expectations, and growth opportunities — not just process.",
        keyPoints: ["Psychological safety", "1:1 frameworks", "Engineering standards", "Growth paths & retention"],
      },
      {
        id: "l2", domain: "Leadership", type: "leadership" as const, difficulty: "Medium" as const,
        question: `Tell me about a time you had to influence a major technical decision without direct authority.`,
        starTemplate: {
          situation: `Three engineering teams were independently building similar ${s2} solutions, creating duplication and inconsistency.`,
          task: `Propose a shared platform without the authority to mandate it.`,
          action: `I built a prototype, ran a workshop showing the cost of fragmentation (6 engineer-months/year), proposed a joint working group, and secured buy-in from two senior engineers who became advocates.`,
          result: `All three teams adopted the shared platform within 2 quarters. Maintenance cost dropped by 60%.`,
        },
        hint: "Influence without authority is a top leadership skill. Focus on building coalitions, not issuing directives.",
        keyPoints: ["Coalition building", "Data-driven persuasion", "Stakeholder mapping"],
      },
      {
        id: "l3", domain: "Leadership", type: "leadership" as const, difficulty: "Hard" as const,
        question: `Describe how you approach hiring and growing engineers on your team. What signals do you look for in interviews?`,
        hint: "Cover your hiring criteria beyond technical skills — curiosity, ownership, collaboration. Discuss how you onboard and develop engineers.",
        starTemplate: undefined,
        keyPoints: ["Technical + cultural bar", "Structured onboarding (30/60/90 day plan)", "Mentorship vs stretch assignments", "Promotion criteria clarity"],
        modelAnswer: `I look for three things beyond technical fundamentals: **curiosity** (do they explore why, not just how?), **ownership** (do they care about outcomes, not just tasks?), and **communication clarity** (can they explain complex ideas simply?).

In interviews, I use structured questions with consistent rubrics — avoids bias and enables calibration across interviewers. I favour pair-problem-solving over "gotcha" algorithm questions — it shows how the candidate thinks collaboratively.

**Onboarding**: 30/60/90 day plan. Week 1: set up environment, read architecture docs, shadow teammates. By day 30: own a small, well-scoped ticket end-to-end. By day 60: propose improvements they noticed. By day 90: lead a feature with guidance.

**Growth**: Bi-annual calibrations with clear, level-specific expectations written down. Stretch assignments slightly beyond their current level. Regular 1:1s focused on career goals, not just task updates. Internal conference talks or blog posts to build visibility.

**Result**: Teams I've built consistently have low attrition (<10% annually) and multiple internal promotions per year. I measure team health via quarterly anonymous surveys (safety, clarity, growth, belonging).`,
      },
    ] : []),
  ];

  return questions;
}

// ─── Page Component ───────────────────────────────────────────────────────────
export default function InterviewPrepPage() {
  const router = useRouter();
  const { profile, loading } = useProfile();
  const [targetRole, setTargetRole] = useState("");
  const [targetCompany, setTargetCompany] = useState("");
  const [questions, setQuestions] = useState<AnyQuestion[] | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [filterDomain, setFilterDomain] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [generating, setGenerating] = useState(false);
  const [questionSeed, setQuestionSeed] = useState(0);
  const [mockMode, setMockMode] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timerQuestionId, setTimerQuestionId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [browseMode, setBrowseMode] = useState(false);

  const MOCK_TIMER_SECS = 120; // 2 minutes per question

  useEffect(() => {
    if (loading || !profile) return;
    setTargetRole(profile.currentRole || "");
  }, [loading, profile]);

  // Countdown tick
  useEffect(() => {
    if (timerSeconds === null) return;
    if (timerSeconds <= 0) {
      setTimerSeconds(null);
      setTimerQuestionId(null);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimerSeconds((s) => (s !== null && s > 0 ? s - 1 : null));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerSeconds === null ? null : timerQuestionId]); // restart only when question changes

  const startTimer = (id: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerQuestionId(id);
    setTimerSeconds(MOCK_TIMER_SECS);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerSeconds(null);
    setTimerQuestionId(null);
  };

  const browseDomain = (domain: string) => {
    const qs = getAllQuestionsForDomain(domain);
    setQuestions(qs);
    setFilterDomain(domain);
    setFilterType("all");
    setExpanded({});
    setAnswers({});
    setScores({});
    setBrowseMode(true);
    stopTimer();
    setMockMode(false);
    // Scroll to questions section smoothly
    setTimeout(() => window.scrollTo({ top: 300, behavior: "smooth" }), 100);
  };

  const clearAll = () => {
    setQuestions(null);
    setFilterDomain("all");
    setFilterType("all");
    setExpanded({});
    setAnswers({});
    setScores({});
    setBrowseMode(false);
    stopTimer();
    setMockMode(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGenerate = async (seedOverride?: number) => {
    if (!profile) return;
    setGenerating(true);
    setQuestions(null);
    setExpanded({});
    setAnswers({});
    setScores({});
    setBrowseMode(false);
    setFilterDomain("all");
    setFilterType("all");
    const activeSeed = seedOverride ?? questionSeed;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) {
      try {
        const res = await fetch(`${apiUrl}/api/interview/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile, target_role: targetRole, target_company: targetCompany }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.questions?.length) {
            setQuestions(data.questions);
            setGenerating(false);
            return;
          }
        }
      } catch { /* fall through to local generation */ }
    }

    await new Promise((r) => setTimeout(r, 1600));
    const profileQs = buildProfileQuestions(profile, targetCompany, profile.experienceYears ?? 0);
    const bankQs = getQuestionsForRole(targetRole, profile.skills ?? [], profile.experienceYears ?? 0, activeSeed);
    setQuestions([...profileQs, ...bankQs]);
    setGenerating(false);
  };

  const scoreAnswer = (id: string, answer: string) => {
    if (!answer.trim()) return;
    let pts = 0;
    if (answer.length > 100) pts += 20;
    if (answer.length > 300) pts += 15;
    const starWords = ["situation", "task", "action", "result", "led", "designed", "built", "improved", "reduced", "increased", "delivered"];
    pts += Math.min(starWords.filter(w => answer.toLowerCase().includes(w)).length * 5, 30);
    const nums = answer.match(/\d+[%$kKLM]?/g)?.length ?? 0;
    pts += Math.min(nums * 7, 35);
    setScores(p => ({ ...p, [id]: Math.min(pts, 100) }));
  };

  const toggle = (id: string) => {
    const opening = !expanded[id];
    setExpanded(p => ({ ...p, [id]: !p[id] }));
    if (mockMode) {
      if (opening) startTimer(id);
      else stopTimer();
    }
  };

  const domains = questions
    ? ["all", ...Array.from(new Set(questions.map(q => q.domain)))]
    : ["all"];

  const filtered = (questions ?? []).filter(q => {
    const domainMatch = filterDomain === "all" || q.domain === filterDomain;
    const typeMatch = filterType === "all" || q.type === filterType;
    return domainMatch && typeMatch;
  });

  const completedCount = Object.keys(scores).length;
  const avgScore = completedCount > 0
    ? Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / completedCount)
    : 0;

  if (!loading && !profile) {
    return (
      <div className="flex min-h-screen bg-transparent">
        <main className="md:ml-64 xl:mr-72 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-8 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              <UserCircle2 className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-white font-semibold text-xl mb-2">No profile found</h2>
            <p className="text-slate-400 text-sm mb-6">Set up your career profile first to get personalised interview questions.</p>
            <button onClick={() => router.push("/")} className="btn-primary text-sm px-6 py-2.5">Set Up Profile</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 xl:mr-72 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium mb-2">
            <Brain className="w-4 h-4" /> AI Interview Coach
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Interview <span className="gradient-text">Preparation</span>
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Click any domain below to instantly browse all questions for that topic — or enter your role and generate a personalised set.
          </p>
        </div>

        {/* Clickable Domain Filter Chips */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Practice by Domain</p>
            {(browseMode || filterDomain !== "all") && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-white border border-slate-600 hover:border-slate-400 rounded-full px-2 py-0.5 transition-all"
              >
                ✕ Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_DOMAINS.filter(d => DOMAIN_META[d]).map((d) => {
              const meta = DOMAIN_META[d];
              const Icon = meta.icon;
              const isActive = filterDomain === d && browseMode;
              return (
                <button
                  key={d}
                  onClick={() => isActive ? clearAll() : browseDomain(d)}
                  className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition-all cursor-pointer ${
                    isActive
                      ? `border-current bg-white/10 ${meta.color}`
                      : `border-slate-700/60 ${meta.color} hover:border-current hover:bg-white/5`
                  }`}
                >
                  <Icon className="w-3 h-3" />{d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Setup Card */}
        <div className="card mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Target Role</label>
              <input
                className="input text-sm"
                placeholder="e.g. webMethods Integration Developer"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Target Company</label>
              <input
                className="input text-sm"
                placeholder="e.g. Bosch, IBM, Capgemini"
                value={targetCompany}
                onChange={(e) => setTargetCompany(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={() => handleGenerate()}
                disabled={generating}
                className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
              >
                {generating
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</>
                  : <><Sparkles className="w-4 h-4" /> Generate Questions</>}
              </button>
              {questions && !generating && (
                <>
                  <button
                    onClick={() => {
                      const nextSeed = questionSeed + 1;
                      setQuestionSeed(nextSeed);
                      handleGenerate(nextSeed);
                    }}
                    title="Get a fresh set of questions"
                    className="btn-secondary px-3 py-2.5 flex items-center gap-1.5 text-xs shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> New Set
                  </button>
                  <button
                    onClick={() => { setMockMode(m => !m); stopTimer(); setExpanded({}); }}
                    title={mockMode ? "Switch to Study Mode" : "Switch to Mock Interview Mode (2-min timer per question)"}
                    className={`px-3 py-2.5 flex items-center gap-1.5 text-xs shrink-0 rounded-lg border transition-all ${
                      mockMode
                        ? "bg-rose-600/20 border-rose-500/50 text-rose-300 hover:bg-rose-600/30"
                        : "btn-secondary"
                    }`}
                  >
                    {mockMode ? <><Zap className="w-3.5 h-3.5" /> Mock On</> : <><Timer className="w-3.5 h-3.5" /> Mock</>}
                  </button>
                </>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Profile: <span className="text-slate-300">{profile?.name || "—"}</span>
            {" · "}<span className="text-slate-300">{profile?.experienceYears}yr exp</span>
            {" · "}<span className="text-slate-300">{(profile?.skills ?? []).slice(0, 3).join(", ")}</span>
            {profile?.resumeText && !profile.resumeText.startsWith("[Resume file:") && (
              <span className="text-emerald-400 ml-2">· Resume enriched ✓</span>
            )}
          </p>
        </div>

        {/* Progress bar */}
        {questions && completedCount > 0 && (
          <div className="card mb-4 py-3">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">{completedCount}/{questions.length} practiced</span>
                  <span className={`text-xs font-bold ${avgScore >= 70 ? "text-emerald-400" : avgScore >= 50 ? "text-amber-400" : "text-rose-400"}`}>
                    Avg Score: {avgScore}/100
                  </span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(completedCount / questions.length) * 100}%`,
                      background: avgScore >= 70 ? "#10b981" : avgScore >= 50 ? "#f59e0b" : "#f43f5e",
                    }}
                  />
                </div>
              </div>
              <Trophy className={`w-5 h-5 ${avgScore >= 70 ? "text-emerald-400" : "text-slate-600"}`} />
            </div>
          </div>
        )}

        {/* Generating state */}
        {generating && (
          <div className="card text-center py-16">
            <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              <Brain className="w-7 h-7 text-indigo-400 animate-pulse" />
            </div>
            <p className="text-white font-semibold mb-1">Analysing your profile & crafting questions…</p>
            <p className="text-slate-400 text-sm">
              Selecting DSA, System Design, {targetRole || "role-specific"}, and Behavioural questions
              tailored to your skills
            </p>
          </div>
        )}

        {/* Browse Mode Banner */}
        {browseMode && questions && !generating && (
          <div className="mb-4 p-3 rounded-lg bg-indigo-500/8 border border-indigo-500/25 flex items-center gap-3">
            <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-indigo-300">
                Browsing: <span className={DOMAIN_META[filterDomain]?.color ?? "text-white"}>{filterDomain}</span>
                <span className="text-slate-400 font-normal ml-1">— {questions.length} questions</span>
              </p>
              <p className="text-[11px] text-slate-400">Showing all questions for this domain regardless of role. Click another chip to switch domain.</p>
            </div>
            <button onClick={clearAll} className="text-[11px] text-slate-500 hover:text-slate-300 border border-slate-600 hover:border-slate-400 rounded px-2 py-0.5 shrink-0 transition-all">
              ✕ Clear
            </button>
          </div>
        )}

        {/* Mock Mode Banner */}
        {mockMode && questions && !generating && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/8 border border-rose-500/25 flex items-center gap-3">
            <Timer className="w-4 h-4 text-rose-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-rose-300">Mock Interview Mode — 2 min per question</p>
              <p className="text-[11px] text-slate-400">Open a question to start its timer. Try to answer before time runs out.</p>
            </div>
            <button onClick={() => { setMockMode(false); stopTimer(); }} className="text-[11px] text-slate-500 hover:text-slate-300 shrink-0">
              Exit
            </button>
          </div>
        )}

        {/* Filters */}
        {questions && !generating && (
          <>
            {/* Filter header with clear button */}
            {(filterDomain !== "all" || filterType !== "all") && (
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">
                  Filters active
                  {filterDomain !== "all" && <span className="ml-1 normal-case font-normal text-slate-400">· {filterDomain}</span>}
                  {filterType !== "all" && <span className="ml-1 normal-case font-normal text-slate-400">· {filterType}</span>}
                </p>
                <button
                  onClick={() => { setFilterDomain("all"); setFilterType("all"); }}
                  className="flex items-center gap-1 text-[10px] font-semibold text-rose-400 hover:text-rose-300 border border-rose-500/40 hover:border-rose-400 rounded-full px-2 py-0.5 transition-all"
                >
                  ✕ Clear Filters
                </button>
              </div>
            )}

            {/* Domain filter */}
            <div className="mb-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Filter by Domain</p>
              <div className="flex gap-2 flex-wrap">
                {domains.map((d) => {
                  const meta = d !== "all" ? DOMAIN_META[d] : null;
                  const Icon = meta?.icon;
                  const count = d === "all" ? questions.length : questions.filter(q => q.domain === d).length;
                  return (
                    <button
                      key={d}
                      onClick={() => setFilterDomain(d)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        filterDomain === d
                          ? "bg-indigo-600 text-white border-indigo-500"
                          : "bg-transparent text-slate-400 border-slate-700 hover:text-white hover:border-slate-500"
                      }`}
                    >
                      {Icon && <Icon className="w-3 h-3" />}
                      {d === "all" ? `All (${count})` : `${d} (${count})`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Type filter */}
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Filter by Type</p>
              <div className="flex gap-2 flex-wrap">
                {(["all", "behavioral", "technical", "situational", "leadership"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterType(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      filterType === f
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-transparent text-slate-400 border-slate-700 hover:text-white hover:border-slate-500"
                    }`}
                  >
                    {f === "all"
                      ? `All Types (${questions.length})`
                      : `${TYPE_META[f]?.label} (${questions.filter(q => q.type === f).length})`}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Cards */}
            <div className="space-y-3">
              {filtered.map((q, idx) => {
                const meta = TYPE_META[q.type];
                const TypeIcon = meta.icon;
                const domainMeta = DOMAIN_META[q.domain];
                const DomainIcon = domainMeta?.icon;
                const isOpen = expanded[q.id];
                const myAnswer = answers[q.id] ?? "";
                const myScore = scores[q.id];

                return (
                  <div key={q.id} className={`card border transition-all ${
                    isOpen && mockMode && timerQuestionId === q.id && timerSeconds !== null && timerSeconds <= 30
                      ? "border-rose-500/40"
                      : isOpen ? "border-indigo-500/30" : ""
                  }`}>
                    {/* Question Header */}
                    <button onClick={() => toggle(q.id)} className="w-full text-left flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${meta.bg}`}>
                        <TypeIcon className={`w-4 h-4 ${meta.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${meta.color}`}>{meta.label}</span>
                          <span className={`text-[10px] font-semibold ${DIFF_COLOR[q.difficulty]}`}>· {q.difficulty}</span>
                          {DomainIcon && (
                            <span className={`flex items-center gap-1 text-[10px] font-medium ${domainMeta.color}`}>
                              · <DomainIcon className="w-2.5 h-2.5" /> {q.domain}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-600">Q{idx + 1}</span>
                          {myScore !== undefined && (
                            <span className={`text-[10px] font-bold ml-auto ${myScore >= 70 ? "text-emerald-400" : myScore >= 50 ? "text-amber-400" : "text-rose-400"}`}>
                              Score: {myScore}/100
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-white leading-relaxed pr-8">{q.question}</p>
                      </div>
                      <div className="shrink-0 mt-1 flex flex-col items-end gap-1">
                        {isOpen
                          ? <ChevronUp className="w-4 h-4 text-slate-400" />
                          : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        {mockMode && isOpen && timerQuestionId === q.id && timerSeconds !== null && (
                          <span className={`text-[11px] font-mono font-bold tabular-nums ${
                            timerSeconds <= 30 ? "text-rose-400" : timerSeconds <= 60 ? "text-amber-400" : "text-emerald-400"
                          }`}>
                            {String(Math.floor(timerSeconds / 60)).padStart(2, "0")}:{String(timerSeconds % 60).padStart(2, "0")}
                          </span>
                        )}
                        {mockMode && isOpen && timerQuestionId === q.id && timerSeconds === 0 && (
                          <span className="text-[11px] font-bold text-rose-400">Time up!</span>
                        )}
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isOpen && (
                      <div className="mt-4 border-t border-slate-700/60 pt-4 space-y-4">
                        {/* Key Points */}
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Target className="w-3 h-3" /> What interviewers are looking for
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {q.keyPoints.map((pt) => (
                              <span key={pt} className="tag text-[11px]">{pt}</span>
                            ))}
                          </div>
                        </div>

                        {/* Hint */}
                        <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                          <p className="text-[10px] font-semibold text-amber-400 mb-1 flex items-center gap-1">
                            <Lightbulb className="w-3 h-3" /> Coaching tip
                          </p>
                          <p className="text-xs text-slate-300 leading-relaxed">{q.hint}</p>
                        </div>

                        {/* Model Answer (technical questions) */}
                        {q.modelAnswer && (
                          <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
                            <p className="text-[10px] font-semibold text-cyan-400 mb-2 flex items-center gap-1">
                              <BookOpen className="w-3 h-3" /> Model Answer
                            </p>
                            <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-mono bg-slate-900/40 rounded-lg p-3 border border-slate-700/40 max-h-80 overflow-y-auto">
                              {q.modelAnswer}
                            </div>
                          </div>
                        )}

                        {/* STAR Template */}
                        {q.starTemplate && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                              <ClipboardList className="w-3 h-3" /> STAR Answer Template (pre-filled from your profile)
                            </p>
                            {(["situation", "task", "action", "result"] as const).map((key) => (
                              <div key={key} className="flex gap-2">
                                <span className="text-[10px] font-bold uppercase text-slate-500 w-16 shrink-0 pt-1">{key}</span>
                                <p className="text-xs text-slate-300 leading-relaxed flex-1 bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50">
                                  {q.starTemplate![key]}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Practice Answer */}
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> Practice your answer
                          </p>
                          <textarea
                            className="input text-sm resize-none leading-relaxed"
                            rows={5}
                            placeholder="Type your answer here — use the STAR template or model answer above as a guide. Include specific numbers, technologies, and outcomes..."
                            value={myAnswer}
                            onChange={(e) => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                          />
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[11px] text-slate-600">{myAnswer.length} characters</span>
                            <button
                              onClick={() => scoreAnswer(q.id, myAnswer)}
                              disabled={myAnswer.length < 30}
                              className="btn-secondary py-1.5 px-4 text-xs flex items-center gap-1.5 disabled:opacity-40"
                            >
                              <Star className="w-3.5 h-3.5" /> Rate My Answer
                            </button>
                          </div>
                          {myScore !== undefined && (
                            <div className={`mt-2 p-3 rounded-lg border text-xs ${
                              myScore >= 70 ? "bg-emerald-500/8 border-emerald-500/25 text-emerald-300" :
                              myScore >= 50 ? "bg-amber-500/8 border-amber-500/25 text-amber-300" :
                              "bg-rose-500/8 border-rose-500/25 text-rose-300"
                            }`}>
                              <span className="font-bold">{myScore}/100 — </span>
                              {myScore >= 70
                                ? "Strong answer! Good use of specifics and structure."
                                : myScore >= 50
                                ? "Decent. Add quantified outcomes (numbers, percentages) to strengthen it."
                                : "Needs improvement. Use the STAR format or model answer above and add concrete metrics."}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <div className="card text-center py-12 text-slate-400">
                <p>No questions match the selected filters.</p>
              </div>
            )}
          </>
        )}

        {/* Pre-generate empty state */}
        {!questions && !generating && (
          <div className="card text-center py-12 border-dashed border-slate-700">
            <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              <Brain className="w-7 h-7 text-indigo-400" />
            </div>
            <p className="text-white font-semibold mb-2">One-stop interview destination</p>
            <p className="text-slate-400 text-sm max-w-md mx-auto mb-4">
              <strong className="text-white">Option 1</strong> — Click a domain chip above to instantly browse all questions for that topic.
            </p>
            <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
              <strong className="text-white">Option 2</strong> — Enter your role and click <strong className="text-white">Generate Questions</strong> for a personalised set.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto text-xs text-slate-400">
              {ALL_DOMAINS.filter(d => DOMAIN_META[d]).map((d) => {
                const meta = DOMAIN_META[d];
                const Icon = meta.icon;
                return (
                  <button
                    key={d}
                    onClick={() => browseDomain(d)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border border-slate-700/50 hover:border-current transition-all cursor-pointer ${meta.color}`}
                    style={{ background: "rgba(255,255,255,0.02)" }}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px]">{d}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {questions && !generating && (
          <p className="text-xs text-slate-600 text-center mt-8">
            {questions.length} questions generated · {domains.length - 1} domains covered
            {" · "}{profile?.skills?.length} skills in profile · {profile?.experienceYears}yr exp
            {profile?.resumeText && !profile.resumeText.startsWith("[Resume file:") ? " · Resume enriched" : ""}
          </p>
        )}
      </main>
    </div>
  );
}
