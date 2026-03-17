"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { loadProfile } from "@/lib/profile";
import { CandidateProfile } from "@/lib/types";
import {
  Brain, Sparkles, ChevronDown, ChevronUp, CheckCircle,
  MessageSquare, Code2, Users, Lightbulb, Target,
  Star, UserCircle2, RefreshCw, ClipboardList, Trophy
} from "lucide-react";

interface InterviewQuestion {
  id: string;
  type: "behavioral" | "technical" | "situational" | "leadership";
  difficulty: "Easy" | "Medium" | "Hard";
  question: string;
  starTemplate?: { situation: string; task: string; action: string; result: string };
  hint: string;
  keyPoints: string[];
}

const TYPE_META = {
  behavioral:  { label: "Behavioural",  icon: Users,      color: "text-indigo-400",  bg: "bg-indigo-500/10 border-indigo-500/25" },
  technical:   { label: "Technical",    icon: Code2,      color: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/25" },
  situational: { label: "Situational",  icon: Lightbulb,  color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/25" },
  leadership:  { label: "Leadership",   icon: Trophy,     color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/25" },
};

const DIFF_COLOR = { Easy: "text-emerald-400", Medium: "text-amber-400", Hard: "text-rose-400" };

function buildQuestions(profile: CandidateProfile, targetRole: string, company: string): InterviewQuestion[] {
  const role = targetRole || profile.currentRole || "Software Engineer";
  const skills = profile.skills ?? [];
  const exp = profile.experienceYears ?? 0;
  const s1 = skills[0] || "your primary stack";
  const s2 = skills[1] || "automation frameworks";
  const s3 = skills[2] || "cloud infrastructure";
  const resumeHint = profile.resumeText && !profile.resumeText.startsWith("[Resume file:")
    ? profile.resumeText.slice(0, 400)
    : "";

  const prevProject = resumeHint.match(/(?:built|designed|led|developed|implemented)\s+([^.,;]{10,50})/i)?.[1] || `a ${s1} solution`;

  return [
    // ── Behavioural ──────────────────────────────────────────────────────────
    {
      id: "b1",
      type: "behavioral",
      difficulty: "Medium",
      question: `Tell me about a time you had to deliver a complex ${s1} project under a tight deadline. How did you manage it?`,
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
      id: "b2",
      type: "behavioral",
      difficulty: "Medium",
      question: `Describe a situation where you disagreed with a technical decision made by your team lead. What did you do?`,
      starTemplate: {
        situation: `Our team was adopting a new ${s2} approach that I believed would create long-term maintenance issues.`,
        task: `I needed to raise the concern without undermining the team lead or damaging relationships.`,
        action: `I prepared a written comparison with pros/cons, requested a 30-min sync, and proposed a pilot on a low-risk service first.`,
        result: `The lead agreed to the pilot. Results confirmed my concerns, and the team adopted my approach for all new services.`,
      },
      hint: "Show that you're principled but collaborative. ${company || 'Top companies'} values people who push back constructively.",
      keyPoints: ["Data-driven advocacy", "Diplomacy", "Outcome focus"],
    },
    {
      id: "b3",
      type: "behavioral",
      difficulty: "Hard",
      question: `Tell me about the most impactful project you've led in your ${exp}+ year career. What was your specific contribution?`,
      starTemplate: {
        situation: `At my previous role, the team was struggling with slow release cycles — deployments took 4 days due to manual ${s1} processes.`,
        task: `I proposed and led an initiative to automate the end-to-end pipeline using ${s2} and ${s3}.`,
        action: `Over 6 weeks, I designed the architecture, wrote the core framework, onboarded 4 engineers, and created runbooks. I presented weekly updates to stakeholders.`,
        result: `Deployment time dropped from 4 days to 45 minutes. Engineering satisfaction scores increased 30%. The approach was adopted company-wide.`,
      },
      hint: "This is your 'hero' story. Quantify impact with real numbers — time saved, defects reduced, revenue protected, team size.",
      keyPoints: ["Leadership scope", "Technical depth", "Business impact with numbers"],
    },
    // ── Technical ────────────────────────────────────────────────────────────
    {
      id: "t1",
      type: "technical",
      difficulty: "Hard",
      question: `How would you design a scalable ${s1} system that handles 10 million events per day? Walk me through your architecture.`,
      starTemplate: undefined,
      hint: `Think in layers: ingestion → processing → storage → serving. For ${s1} at scale, discuss trade-offs on consistency vs. availability.`,
      keyPoints: [`${s1} internals`, "Distributed systems trade-offs", "Scaling patterns (horizontal vs. vertical)", "Monitoring & observability"],
    },
    {
      id: "t2",
      type: "technical",
      difficulty: "Medium",
      question: `Walk me through how you would debug a critical production issue in a ${s1} service that is causing intermittent failures affecting 5% of users.`,
      starTemplate: undefined,
      hint: "Start with observability — logs, metrics, traces. Explain your hypothesis-driven debugging approach and how you'd minimize blast radius.",
      keyPoints: ["Observability tooling", "Incident management process", "Root cause analysis methodology", "Communication during incidents"],
    },
    {
      id: "t3",
      type: "technical",
      difficulty: "Medium",
      question: `${skills.includes("AWS") || skills.includes("GCP") || skills.includes("Azure") ? `Explain how you would architect a CI/CD pipeline on cloud that supports blue-green deployments for a microservices application.` : `How do you ensure code quality and prevent regressions in a fast-moving engineering team?`}`,
      starTemplate: undefined,
      hint: "Draw on your hands-on experience. Mention specific tools you've used, trade-offs you've made, and lessons learned from production.",
      keyPoints: ["Pipeline stages", "Rollback strategy", "Testing gates", "Feature flags"],
    },
    // ── Situational ──────────────────────────────────────────────────────────
    {
      id: "s1",
      type: "situational",
      difficulty: "Medium",
      question: `You join ${company || "this company"} and discover the codebase has significant technical debt that's slowing the team down. The business wants features, not refactoring. How do you handle this?`,
      starTemplate: {
        situation: `Technical debt is creating a 30% overhead on every feature — bugs are frequent and onboarding takes 4 weeks.`,
        task: `I need to make the case for refactoring while keeping business stakeholders satisfied.`,
        action: `I'd quantify the debt's cost in eng hours, propose a "20% time" model where refactoring is embedded into feature sprints rather than separate, and pick one high-leverage area to prove ROI quickly.`,
        result: `After the first 6-week cycle, feature velocity increases by 25%, which makes the business case self-evident.`,
      },
      hint: `${company || "Top engineering companies"} values engineers who balance technical excellence with business pragmatism. Show both sides.`,
      keyPoints: ["Quantifying tech debt", "Stakeholder management", "Incremental improvement strategy"],
    },
    {
      id: "s2",
      type: "situational",
      difficulty: "Hard",
      question: `A critical bug is found in production 2 hours before a major product launch. Your fix is ready but needs 30 minutes of testing. The CEO wants to launch on time. What do you do?`,
      starTemplate: {
        situation: `Launch is at noon. The bug affects 20% of checkout flows. My fix is written but untested.`,
        task: `I need to make a risk assessment and communicate it clearly to leadership.`,
        action: `I run focused smoke tests on the critical path (15 min), prepare a rollback plan, brief engineering leadership with clear risk levels, and present the option to either delay 45 min or launch with a feature flag disabling the affected flow.`,
        result: `We launch on time with the flow disabled, affecting 0 customers at launch. Fix is deployed 2 hours later with full test coverage.`,
      },
      hint: "Demonstrate structured risk thinking. CEOs respect engineers who give clear options with trade-offs, not just 'yes' or 'no'.",
      keyPoints: ["Risk assessment framework", "Communication under pressure", "Rollback planning"],
    },
    // ── Leadership ───────────────────────────────────────────────────────────
    ...(exp >= 4 ? [
      {
        id: "l1",
        type: "leadership" as const,
        difficulty: "Hard" as const,
        question: `How do you build a high-performing engineering team culture? What concrete practices have you implemented?`,
        starTemplate: {
          situation: `I inherited a team of 6 engineers with low morale, 40% test coverage, and no clear engineering standards.`,
          task: `Transform team culture and output quality within 6 months.`,
          action: `I introduced: weekly 1:1s focused on growth not status, blameless post-mortems, a team charter for engineering standards, pairing sessions for knowledge sharing, and quarterly team retros with action items. I also created growth ladders so engineers knew their paths forward.`,
          result: `Attrition dropped to zero, test coverage reached 82%, and the team shipped 40% more features in H2 vs H1. Two engineers got promotions.`,
        },
        hint: "Show you understand that great teams are built through psychological safety, clear expectations, and growth opportunities — not just process.",
        keyPoints: ["Psychological safety", "1:1 frameworks", "Engineering standards", "Growth paths & retention"],
      },
      {
        id: "l2",
        type: "leadership" as const,
        difficulty: "Medium" as const,
        question: `Tell me about a time you had to influence a major technical decision without direct authority.`,
        starTemplate: {
          situation: `Three engineering teams were independently building similar data pipeline solutions, creating duplication and inconsistency.`,
          task: `Propose a shared platform without the authority to mandate it.`,
          action: `I built a prototype, ran a workshop showing the cost of fragmentation (6 engineer-months/year), proposed a joint working group, and secured buy-in from two senior engineers who became advocates.`,
          result: `All three teams adopted the shared platform within 2 quarters. Maintenance cost dropped by 60%.`,
        },
        hint: "Influence without authority is a top leadership skill. Focus on building coalitions, not issuing directives.",
        keyPoints: ["Coalition building", "Data-driven persuasion", "Stakeholder mapping"],
      },
    ] : []),
  ];
}

export default function InterviewPrepPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [targetRole, setTargetRole] = useState("");
  const [targetCompany, setTargetCompany] = useState("");
  const [questions, setQuestions] = useState<InterviewQuestion[] | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [filterType, setFilterType] = useState<string>("all");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const p = loadProfile();
    setProfile(p);
    setProfileChecked(true);
    if (p) {
      setTargetRole(p.currentRole || "");
    }
  }, []);

  const handleGenerate = async () => {
    if (!profile) return;
    setGenerating(true);
    setQuestions(null);
    setExpanded({});
    setAnswers({});
    setScores({});

    // Try API
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
      } catch { /* fall through */ }
    }

    await new Promise((r) => setTimeout(r, 1600));
    setQuestions(buildQuestions(profile, targetRole, targetCompany));
    setGenerating(false);
  };

  const scoreAnswer = (id: string, answer: string) => {
    if (!answer.trim()) return;
    // Heuristic scoring: length, STAR keywords, quantification
    let pts = 0;
    if (answer.length > 100) pts += 20;
    if (answer.length > 300) pts += 15;
    const starWords = ["situation", "task", "action", "result", "led", "designed", "built", "improved", "reduced", "increased", "delivered"];
    pts += Math.min(starWords.filter(w => answer.toLowerCase().includes(w)).length * 5, 30);
    const numRegex = /\d+[%$kKLM]?/g;
    const nums = answer.match(numRegex)?.length ?? 0;
    pts += Math.min(nums * 7, 35);
    setScores(p => ({ ...p, [id]: Math.min(pts, 100) }));
  };

  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const filtered = questions?.filter(q => filterType === "all" || q.type === filterType) ?? [];

  if (profileChecked && !profile) {
    return (
      <div className="flex min-h-screen bg-transparent">
        <Navbar />
        <main className="ml-64 flex-1 px-8 py-8 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              <UserCircle2 className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-white font-semibold text-xl mb-2">No profile found</h2>
            <p className="text-slate-400 text-sm mb-6">Set up your career profile first — we use your skills and experience to generate personalised interview questions.</p>
            <button onClick={() => router.push("/")} className="btn-primary text-sm px-6 py-2.5">Set Up Profile</button>
          </div>
        </main>
      </div>
    );
  }

  const completedCount = Object.keys(scores).length;
  const avgScore = completedCount > 0 ? Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / completedCount) : 0;

  return (
    <div className="flex min-h-screen bg-transparent">
      <Navbar />
      <main className="ml-64 flex-1 px-8 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium mb-2">
            <Brain className="w-4 h-4" /> AI Interview Coach
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Interview <span className="gradient-text">Preparation</span>
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            AI-generated questions tailored to your role, experience, and skills — with pre-filled STAR answer templates from your profile. Practice, self-score, and ace your next interview.
          </p>
        </div>

        {/* Setup Card */}
        <div className="card mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Target Role</label>
              <input
                className="input text-sm"
                placeholder="e.g. Senior Backend Engineer"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Target Company</label>
              <input
                className="input text-sm"
                placeholder="e.g. Stripe, Google, Atlassian"
                value={targetCompany}
                onChange={(e) => setTargetCompany(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
              >
                {generating ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Generate Questions</>
                )}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Profile: <span className="text-slate-300">{profile?.name || "—"}</span> · <span className="text-slate-300">{profile?.experienceYears}yr exp</span> · <span className="text-slate-300">{(profile?.skills ?? []).slice(0, 3).join(", ")}</span>
            {profile?.resumeText && !profile.resumeText.startsWith("[Resume file:") && (
              <span className="text-emerald-400 ml-2">· Resume text loaded ✓</span>
            )}
          </p>
        </div>

        {/* Progress bar when questions exist */}
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
            <p className="text-slate-400 text-sm">Tailoring STAR templates to your experience at {targetCompany || "your target company"}</p>
          </div>
        )}

        {/* Filter tabs */}
        {questions && !generating && (
          <>
            <div className="flex gap-2 mb-4 flex-wrap">
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
                  {f === "all" ? `All (${questions.length})` : `${TYPE_META[f]?.label} (${questions.filter(q => q.type === f).length})`}
                </button>
              ))}
            </div>

            {/* Question Cards */}
            <div className="space-y-3">
              {filtered.map((q, idx) => {
                const meta = TYPE_META[q.type];
                const Icon = meta.icon;
                const isOpen = expanded[q.id];
                const myAnswer = answers[q.id] ?? "";
                const myScore = scores[q.id];

                return (
                  <div key={q.id} className={`card border transition-all ${isOpen ? "border-indigo-500/30" : ""}`}>
                    {/* Question Header */}
                    <button
                      onClick={() => toggle(q.id)}
                      className="w-full text-left flex items-start gap-3"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${meta.bg}`}>
                        <Icon className={`w-4 h-4 ${meta.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${meta.color}`}>{meta.label}</span>
                          <span className={`text-[10px] font-semibold ${DIFF_COLOR[q.difficulty]}`}>· {q.difficulty}</span>
                          <span className="text-[10px] text-slate-600">Q{idx + 1}</span>
                          {myScore !== undefined && (
                            <span className={`text-[10px] font-bold ml-auto ${myScore >= 70 ? "text-emerald-400" : myScore >= 50 ? "text-amber-400" : "text-rose-400"}`}>
                              Score: {myScore}/100
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-white leading-relaxed pr-8">{q.question}</p>
                      </div>
                      <div className="shrink-0 mt-1">
                        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
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
                            placeholder="Type your answer here — use the STAR template above as a guide. Include specific numbers, technologies, and outcomes..."
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
                                ? "Decent answer. Add quantified outcomes (numbers, percentages) to strengthen it."
                                : "Needs improvement. Use the STAR format above and add concrete metrics."}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Empty state for filter */}
            {filtered.length === 0 && (
              <div className="card text-center py-12 text-slate-400">
                <p>No {filterType} questions generated for your profile level.</p>
              </div>
            )}
          </>
        )}

        {/* Pre-generate empty state */}
        {!questions && !generating && (
          <div className="card text-center py-16 border-dashed border-slate-700">
            <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              <Brain className="w-7 h-7 text-indigo-400" />
            </div>
            <p className="text-white font-semibold mb-2">Ready to prepare</p>
            <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
              Enter the role and company above, then click <strong className="text-white">Generate Questions</strong> to get a personalised set of behavioural, technical, situational, and leadership questions with STAR templates built from your profile.
            </p>
            <div className="flex items-center justify-center gap-6 text-xs text-slate-500 flex-wrap">
              {(["behavioral", "technical", "situational", "leadership"] as const).map((t) => {
                const Icon = TYPE_META[t].icon;
                return (
                  <span key={t} className={`flex items-center gap-1.5 ${TYPE_META[t].color}`}>
                    <Icon className="w-3.5 h-3.5" /> {TYPE_META[t].label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {questions && !generating && (
          <p className="text-xs text-slate-600 text-center mt-8">
            {questions.length} questions generated · Based on {profile?.skills?.length} skills & {profile?.experienceYears}yr exp
            {profile?.resumeText && !profile.resumeText.startsWith("[Resume file:") ? " · Resume enriched" : ""}
          </p>
        )}
      </main>
    </div>
  );
}
