"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/ProfileContext";
import {
  Brain, ChevronRight, CheckCircle2,
  Star, BookmarkPlus, ArrowLeft, RotateCcw, Zap,
  AlertTriangle, Play, Pause, SkipForward, Trophy,
  TrendingUp, MessageSquare, Target, Lightbulb,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface SimQuestion {
  id: string;
  domain: string;
  type: string;
  difficulty: "Easy" | "Medium" | "Hard";
  question: string;
  hint: string;
  keyPoints: string[];
}

interface DimensionScore {
  clarity: number;      // 0-100: clear structure, logical flow
  specificity: number;  // 0-100: uses numbers, real examples, names
  relevance: number;    // 0-100: answers what was asked, key points hit
}

interface AnswerRecord {
  question: SimQuestion;
  answer: string;
  scores: DimensionScore;
  overall: number;
  savedToBank: boolean;
  timeTaken: number; // seconds
}

type Phase = "setup" | "thinking" | "answering" | "scoring" | "summary";

// ── Scoring logic ──────────────────────────────────────────────────────────────
function scoreAnswer(answer: string, question: SimQuestion): DimensionScore {
  const text = answer.toLowerCase();
  const words = answer.trim().split(/\s+/).length;

  // Clarity: structure signals, length, coherence
  const claritySignals = [
    "first", "then", "after", "as a result", "therefore", "finally",
    "situation", "task", "action", "result", "i ", "we ", "my ", "our ",
  ];
  const clarityHits = claritySignals.filter(s => text.includes(s)).length;
  const clarityFromLength = Math.min(words / 2, 30); // up to 30 pts for length
  const clarity = Math.min(Math.round(clarityFromLength + clarityHits * 5), 100);

  // Specificity: numbers, percentages, company names, timeframes, tools
  const numbers = (answer.match(/\d+[%$kKMmx]?|\d+\s*(percent|days|weeks|months|hours|years)/gi) ?? []).length;
  const techTerms = (answer.match(/\b(api|sql|git|ci\/cd|pipeline|framework|docker|kubernetes|aws|azure|gcp|react|python|java|typescript|redis|kafka|postgres|jira|sprint|agile|scrum)\b/gi) ?? []).length;
  const specificity = Math.min(Math.round(numbers * 12 + techTerms * 8 + (words > 80 ? 20 : 0)), 100);

  // Relevance: key points from question hit
  const keyPoints = question.keyPoints ?? [];
  const keyHits = keyPoints.filter(kp =>
    kp.toLowerCase().split(" ").filter(w => w.length > 4).some(w => text.includes(w))
  ).length;
  const keyScore = keyPoints.length > 0 ? Math.round((keyHits / keyPoints.length) * 60) : 40;
  const domainWords: Record<string, string[]> = {
    behavioral: ["led", "managed", "delivered", "collaborated", "improved"],
    technical: ["implemented", "designed", "optimized", "built", "resolved"],
    situational: ["would", "approach", "consider", "evaluate", "prioritize"],
    leadership: ["team", "mentored", "decision", "stakeholder", "direction"],
  };
  const dWords = domainWords[question.type as keyof typeof domainWords] ?? [];
  const dHits = dWords.filter(w => text.includes(w)).length;
  const relevance = Math.min(keyScore + dHits * 8, 100);

  return { clarity, specificity, relevance };
}

function overallScore(d: DimensionScore): number {
  return Math.round((d.clarity * 0.3 + d.specificity * 0.35 + d.relevance * 0.35));
}

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Excellent", color: "text-emerald-400" };
  if (score >= 65) return { label: "Good", color: "text-cyan-400" };
  if (score >= 45) return { label: "Fair", color: "text-amber-400" };
  return { label: "Needs Work", color: "text-rose-400" };
}


const THINK_SECS = 30;
const DEFAULT_ANSWER_SECS = 120;

// ── Component ─────────────────────────────────────────────────────────────────
export default function InterviewSimulatorPage() {
  const router = useRouter();
  const { profile, loading } = useProfile();

  // Setup state
  const [targetRole, setTargetRole] = useState("");
  const [targetCompany, setTargetCompany] = useState("");
  const [answerTimeSecs, setAnswerTimeSecs] = useState(DEFAULT_ANSWER_SECS);
  const [questionCount, setQuestionCount] = useState(5);
  const [questions, setQuestions] = useState<SimQuestion[]>([]);
  const [loadingQs, setLoadingQs] = useState(false);

  // Simulation state
  const [phase, setPhase] = useState<Phase>("setup");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [timerSecs, setTimerSecs] = useState(0);
  const [timerPaused, setTimerPaused] = useState(false);
  const [savingToBank, setSavingToBank] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!loading && profile) setTargetRole(profile.currentRole ?? "");
  }, [loading, profile]);

  // ── Timer ──────────────────────────────────────────────────────────────────
  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const startCountdown = useCallback((secs: number, onExpire: () => void) => {
    stopTimer();
    setTimerSecs(secs);
    setTimerPaused(false);
    timerRef.current = setInterval(() => {
      setTimerSecs(prev => {
        if (prev <= 1) {
          stopTimer();
          onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopTimer]);

  useEffect(() => () => stopTimer(), [stopTimer]);

  // ── Load questions ─────────────────────────────────────────────────────────
  const loadQuestions = async () => {
    if (!profile) return;
    setLoadingQs(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    try {
      const res = await fetch(`${apiUrl}/api/interview/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, target_role: targetRole, target_company: targetCompany }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.questions?.length) {
          setQuestions(data.questions.slice(0, questionCount));
          setLoadingQs(false);
          return;
        }
      }
    } catch { /* fall through */ }

    // Fallback: local question bank
    const { getQuestionsForRole } = await import("@/lib/questionBank").catch(() => ({ getQuestionsForRole: null }));
    const bankQs = getQuestionsForRole ? getQuestionsForRole(targetRole, profile.skills ?? [], profile.experienceYears ?? 0, Date.now()) : [];
    setQuestions(bankQs.slice(0, questionCount));
    setLoadingQs(false);
  };

  // ── Simulation flow ────────────────────────────────────────────────────────
  const startSimulation = async () => {
    await loadQuestions();
    setCurrentIdx(0);
    setRecords([]);
    setAnswer("");
    beginThinking();
  };

  const beginThinking = () => {
    setPhase("thinking");
    startCountdown(THINK_SECS, beginAnswering);
  };

  const beginAnswering = useCallback(() => {
    setPhase("answering");
    setAnswer("");
    startCountdown(answerTimeSecs, submitAnswer);
    setTimeout(() => textareaRef.current?.focus(), 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerTimeSecs, startCountdown]);

  const submitAnswer = useCallback(() => {
    stopTimer();
    setPhase("scoring");
    setTimerSecs(0);
  }, [stopTimer]);

  const confirmScore = (q: SimQuestion, timeTaken: number) => {
    const dims = scoreAnswer(answer, q);
    const overall = overallScore(dims);
    const record: AnswerRecord = { question: q, answer, scores: dims, overall, savedToBank: false, timeTaken };
    setRecords(prev => [...prev, record]);
    setAnswer("");
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(i => i + 1);
      beginThinking();
    } else {
      stopTimer();
      setPhase("summary");
    }
  };

  const skipQuestion = () => {
    stopTimer();
    const q = questions[currentIdx];
    const record: AnswerRecord = {
      question: q, answer: "", scores: { clarity: 0, specificity: 0, relevance: 0 },
      overall: 0, savedToBank: false, timeTaken: 0,
    };
    setRecords(prev => [...prev, record]);
    setAnswer("");
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(i => i + 1);
      beginThinking();
    } else {
      setPhase("summary");
    }
  };

  const togglePause = () => {
    if (timerPaused) {
      setTimerPaused(false);
      timerRef.current = setInterval(() => {
        setTimerSecs(prev => {
          if (prev <= 1) { stopTimer(); submitAnswer(); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      stopTimer();
      setTimerPaused(true);
    }
  };

  // ── Save to story bank ─────────────────────────────────────────────────────
  const saveToStoryBank = async (record: AnswerRecord) => {
    if (!profile || !record.answer.trim()) return;
    const qId = record.question.id;
    setSavingToBank(qId);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      await fetch(`${apiUrl}/api/interview/stories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: record.question.question.slice(0, 80),
          situation: record.answer,
          task: "",
          action: "",
          result: `Score: ${record.overall}/100 (Clarity ${record.scores.clarity}, Specificity ${record.scores.specificity}, Relevance ${record.scores.relevance})`,
          tags: [record.question.domain, record.question.type, record.question.difficulty],
        }),
      });
      setSavedIds(prev => new Set([...prev, qId]));
    } catch { /* silent */ }
    setSavingToBank(null);
  };

  const restart = () => {
    stopTimer();
    setPhase("setup");
    setCurrentIdx(0);
    setRecords([]);
    setAnswer("");
    setQuestions([]);
    setSavedIds(new Set());
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const currentQ = questions[currentIdx];
  const answeredRecords = records.filter(r => r.answer.trim());
  const avgOverall = answeredRecords.length
    ? Math.round(answeredRecords.reduce((s, r) => s + r.overall, 0) / answeredRecords.length)
    : 0;
  const timerPct = phase === "thinking"
    ? (timerSecs / THINK_SECS) * 100
    : (timerSecs / answerTimeSecs) * 100;
  const timerUrgent = timerSecs <= 15 && phase === "answering";
  const timeTakenSecs = answerTimeSecs - timerSecs;

  // ── Render helpers ─────────────────────────────────────────────────────────
  const ScoreBar = ({ label, value }: { label: string; value: number }) => {
    const { color } = scoreLabel(value);
    return (
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">{label}</span>
          <span className={`font-semibold ${color}`}>{value}</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-700/60">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${value}%`, background: value >= 65 ? "var(--accent)" : value >= 45 ? "#f59e0b" : "#f43f5e" }}
          />
        </div>
      </div>
    );
  };

  const TimerRing = ({ pct, urgent }: { pct: number; urgent: boolean }) => {
    const r = 28;
    const circ = 2 * Math.PI * r;
    return (
      <svg width={72} height={72} className="-rotate-90">
        <circle cx={36} cy={36} r={r} fill="none" stroke="#1e293b" strokeWidth={5} />
        <circle
          cx={36} cy={36} r={r} fill="none"
          stroke={urgent ? "#f43f5e" : "var(--accent)"}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct / 100)}
          className="transition-all duration-1000"
        />
      </svg>
    );
  };

  // ─── No profile guard ──────────────────────────────────────────────────────
  if (!loading && !profile) {
    return (
      <div className="flex min-h-screen bg-transparent">
        <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-8 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <Brain className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
            <h2 className="text-white font-semibold text-xl mb-2">No profile found</h2>
            <p className="text-slate-400 text-sm mb-6">Set up your career profile first.</p>
            <button onClick={() => router.push("/")} className="btn-primary text-sm px-6 py-2.5">Set Up Profile</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-12 max-w-3xl">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => phase === "setup" ? router.push("/interview") : restart()}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-medium mb-1">
              <Brain className="w-3.5 h-3.5" /> Interview Simulator
            </div>
            <h1 className="text-2xl font-bold text-white">
              Live <span className="gradient-text">Mock Session</span>
            </h1>
          </div>
        </div>

        {/* ── SETUP PHASE ──────────────────────────────────────────────────── */}
        {phase === "setup" && (
          <div className="space-y-5">
            <div className="card p-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-400" /> Session Setup
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Target Role</label>
                  <input
                    className="input-field w-full"
                    placeholder="e.g. Senior QA Engineer"
                    value={targetRole}
                    onChange={e => setTargetRole(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Target Company</label>
                  <input
                    className="input-field w-full"
                    placeholder="e.g. Stripe (optional)"
                    value={targetCompany}
                    onChange={e => setTargetCompany(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Answer Time Limit
                  </label>
                  <select
                    className="input-field w-full"
                    value={answerTimeSecs}
                    onChange={e => setAnswerTimeSecs(Number(e.target.value))}
                  >
                    <option value={60}>1 minute</option>
                    <option value={120}>2 minutes</option>
                    <option value={180}>3 minutes</option>
                    <option value={300}>5 minutes (relaxed)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Number of Questions
                  </label>
                  <select
                    className="input-field w-full"
                    value={questionCount}
                    onChange={e => setQuestionCount(Number(e.target.value))}
                  >
                    <option value={3}>3 (quick drill)</option>
                    <option value={5}>5 (standard)</option>
                    <option value={8}>8 (deep prep)</option>
                    <option value={10}>10 (full mock)</option>
                  </select>
                </div>
              </div>

              {/* Rules */}
              <div className="rounded-xl p-4 mb-5" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> How it works
                </p>
                <ul className="space-y-1.5 text-xs text-slate-400">
                  <li className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">1.</span> You get <strong className="text-slate-300">30 seconds</strong> to read & think about each question</li>
                  <li className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">2.</span> Timer starts — type your answer before time runs out</li>
                  <li className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">3.</span> Each answer is scored on <strong className="text-slate-300">Clarity · Specificity · Relevance</strong></li>
                  <li className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">4.</span> Save your best answers to your <strong className="text-slate-300">Story Bank</strong> for interviews</li>
                </ul>
              </div>

              <button
                onClick={startSimulation}
                disabled={loadingQs || !targetRole.trim()}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
              >
                {loadingQs ? (
                  <><RotateCcw className="w-4 h-4 animate-spin" /> Loading questions…</>
                ) : (
                  <><Play className="w-4 h-4" /> Start Simulation</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── THINKING PHASE ───────────────────────────────────────────────── */}
        {phase === "thinking" && currentQ && (
          <div className="space-y-4">
            {/* Progress */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Question {currentIdx + 1} of {questions.length}</span>
              <div className="flex-1 h-1 rounded-full bg-slate-700/60">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${((currentIdx) / questions.length) * 100}%`, background: "var(--accent)" }}
                />
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    currentQ.difficulty === "Easy" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
                    currentQ.difficulty === "Medium" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" :
                    "border-rose-500/30 bg-rose-500/10 text-rose-400"
                  }`}>{currentQ.difficulty}</span>
                  <span className="text-xs text-slate-500">{currentQ.domain}</span>
                </div>
                <div className="ml-auto">
                  <button onClick={skipQuestion} className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
                    <SkipForward className="w-3.5 h-3.5" /> Skip
                  </button>
                </div>
              </div>

              <h2 className="text-white text-lg font-semibold leading-snug mb-6">
                {currentQ.question}
              </h2>

              {/* Hint */}
              <div className="rounded-xl p-3 mb-6" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                <p className="text-xs text-slate-400"><span className="text-amber-400 font-medium">Hint: </span>{currentQ.hint}</p>
              </div>

              {/* Thinking timer */}
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Thinking Time</p>
                <div className="relative w-[72px] h-[72px]">
                  <TimerRing pct={timerPct} urgent={false} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-white">{timerSecs}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500">Answer starts automatically</p>
                <button
                  onClick={beginAnswering}
                  className="btn-primary text-sm px-5 py-2 flex items-center gap-1.5 mt-1"
                >
                  <Zap className="w-3.5 h-3.5" /> Start Answering Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── ANSWERING PHASE ──────────────────────────────────────────────── */}
        {phase === "answering" && currentQ && (
          <div className="space-y-4">
            {/* Progress */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Question {currentIdx + 1} of {questions.length}</span>
              <div className="flex-1 h-1 rounded-full bg-slate-700/60">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${((currentIdx) / questions.length) * 100}%`, background: "var(--accent)" }}
                />
              </div>
            </div>

            <div className="card p-6">
              {/* Question + timer row */}
              <div className="flex items-start gap-4 mb-5">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      currentQ.difficulty === "Easy" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
                      currentQ.difficulty === "Medium" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" :
                      "border-rose-500/30 bg-rose-500/10 text-rose-400"
                    }`}>{currentQ.difficulty}</span>
                    <span className="text-xs text-slate-500">{currentQ.domain}</span>
                  </div>
                  <p className="text-white font-semibold leading-snug">{currentQ.question}</p>
                </div>

                {/* Timer */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className="relative w-[72px] h-[72px]">
                    <TimerRing pct={timerPct} urgent={timerUrgent} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-lg font-bold ${timerUrgent ? "text-rose-400" : "text-white"}`}>
                        {timerSecs}
                      </span>
                    </div>
                  </div>
                  <button onClick={togglePause} className="text-slate-500 hover:text-white transition-colors">
                    {timerPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Key points reminder */}
              {currentQ.keyPoints?.length > 0 && (
                <div className="rounded-xl p-3 mb-4" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Cover these points</p>
                  <div className="flex flex-wrap gap-1.5">
                    {currentQ.keyPoints.map((kp, i) => (
                      <span key={i} className="text-xs text-slate-400 bg-slate-700/40 px-2 py-0.5 rounded-full">{kp}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Answer textarea */}
              <textarea
                ref={textareaRef}
                className="input-field w-full resize-none text-sm leading-relaxed"
                rows={8}
                placeholder="Type your answer here… Use STAR format: Situation → Task → Action → Result. Include specific numbers, tools, and outcomes."
                value={answer}
                onChange={e => setAnswer(e.target.value)}
              />
              <div className="flex items-center justify-between mt-1 mb-4">
                <span className="text-[10px] text-slate-500">{answer.trim().split(/\s+/).filter(Boolean).length} words</span>
                {timerPaused && <span className="text-[10px] text-amber-400 flex items-center gap-1"><Pause className="w-3 h-3" /> Paused</span>}
              </div>

              <div className="flex gap-3">
                <button onClick={skipQuestion} className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 px-3">
                  <SkipForward className="w-3.5 h-3.5" /> Skip
                </button>
                <button
                  onClick={submitAnswer}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> Submit Answer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SCORING PHASE ────────────────────────────────────────────────── */}
        {phase === "scoring" && currentQ && (
          <div className="space-y-4">
            {(() => {
              const dims = scoreAnswer(answer, currentQ);
              const overall = overallScore(dims);
              const { label, color } = scoreLabel(overall);
              return (
                <div className="card p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">Your Score</p>
                      <div className="flex items-end gap-2">
                        <span className={`text-5xl font-bold ${color}`}>{overall}</span>
                        <span className="text-slate-500 text-lg mb-1">/100</span>
                      </div>
                      <span className={`text-sm font-semibold ${color}`}>{label}</span>
                    </div>
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border-2 ${
                      overall >= 80 ? "border-emerald-500/40 bg-emerald-500/10" :
                      overall >= 65 ? "border-cyan-500/40 bg-cyan-500/10" :
                      overall >= 45 ? "border-amber-500/40 bg-amber-500/10" :
                      "border-rose-500/40 bg-rose-500/10"
                    }`}>
                      {overall >= 65 ? <Trophy className={`w-8 h-8 ${color}`} /> : <AlertTriangle className={`w-8 h-8 ${color}`} />}
                    </div>
                  </div>

                  {/* Dimension bars */}
                  <div className="space-y-3 mb-5">
                    <ScoreBar label="Clarity (structure, flow, length)" value={dims.clarity} />
                    <ScoreBar label="Specificity (numbers, tools, names)" value={dims.specificity} />
                    <ScoreBar label="Relevance (answered the question)" value={dims.relevance} />
                  </div>

                  {/* Your answer preview */}
                  <div className="rounded-xl p-4 mb-5" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Your Answer</p>
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {answer.trim() || <span className="text-slate-500 italic">No answer submitted</span>}
                    </p>
                  </div>

                  {/* Action row */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => saveToStoryBank({ question: currentQ, answer, scores: dims, overall, savedToBank: false, timeTaken: timeTakenSecs })}
                      disabled={!answer.trim() || savedIds.has(currentQ.id) || savingToBank === currentQ.id}
                      className="flex items-center gap-1.5 text-xs font-medium px-4 py-2.5 rounded-xl border transition-all disabled:opacity-40"
                      style={{ border: "1px solid var(--border)", color: "var(--accent-bright)" }}
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      {savedIds.has(currentQ.id) ? "Saved!" : savingToBank === currentQ.id ? "Saving…" : "Save to Story Bank"}
                    </button>
                    <button
                      onClick={() => confirmScore(currentQ, timeTakenSecs)}
                      className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5"
                    >
                      {currentIdx + 1 < questions.length ? (
                        <><ChevronRight className="w-4 h-4" /> Next Question</>
                      ) : (
                        <><Trophy className="w-4 h-4" /> See Results</>
                      )}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── SUMMARY PHASE ────────────────────────────────────────────────── */}
        {phase === "summary" && (
          <div className="space-y-5">
            {/* Overall result card */}
            <div className="card p-6 text-center">
              <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", border: "1px solid var(--border-hover)" }}
              >
                <Trophy className="w-10 h-10" style={{ color: "var(--accent-bright)" }} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">Session Complete!</h2>
              <p className="text-slate-400 text-sm mb-5">
                {answeredRecords.length} of {questions.length} questions answered
              </p>
              <div className="flex items-end justify-center gap-2 mb-2">
                <span className={`text-6xl font-bold ${scoreLabel(avgOverall).color}`}>{avgOverall}</span>
                <span className="text-slate-500 text-xl mb-2">/100</span>
              </div>
              <p className={`text-lg font-semibold ${scoreLabel(avgOverall).color}`}>{scoreLabel(avgOverall).label}</p>

              {/* Dimension averages */}
              {answeredRecords.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mt-6">
                  {[
                    { label: "Clarity", key: "clarity" as const, icon: MessageSquare },
                    { label: "Specificity", key: "specificity" as const, icon: Target },
                    { label: "Relevance", key: "relevance" as const, icon: TrendingUp },
                  ].map(({ label, key, icon: Icon }) => {
                    const avg = Math.round(answeredRecords.reduce((s, r) => s + r.scores[key], 0) / answeredRecords.length);
                    const { color } = scoreLabel(avg);
                    return (
                      <div key={key} className="rounded-xl p-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                        <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
                        <p className={`text-xl font-bold ${color}`}>{avg}</p>
                        <p className="text-[10px] text-slate-500">{label}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Per-question breakdown */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" /> Question Breakdown
              </h3>
              <div className="space-y-3">
                {records.map((rec, idx) => {
                  const { color } = scoreLabel(rec.overall);
                  const saved = savedIds.has(rec.question.id);
                  return (
                    <div
                      key={idx}
                      className="rounded-xl p-4"
                      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-xs text-white font-medium leading-snug flex-1">{rec.question.question.slice(0, 90)}…</p>
                        <span className={`text-sm font-bold shrink-0 ${color}`}>{rec.overall}</span>
                      </div>
                      {rec.answer ? (
                        <>
                          <div className="flex gap-3 mb-2 text-[10px] text-slate-400">
                            <span>Clarity <strong className={scoreLabel(rec.scores.clarity).color}>{rec.scores.clarity}</strong></span>
                            <span>Specificity <strong className={scoreLabel(rec.scores.specificity).color}>{rec.scores.specificity}</strong></span>
                            <span>Relevance <strong className={scoreLabel(rec.scores.relevance).color}>{rec.scores.relevance}</strong></span>
                          </div>
                          <button
                            onClick={() => saveToStoryBank(rec)}
                            disabled={saved || savingToBank === rec.question.id}
                            className="text-[10px] flex items-center gap-1 transition-colors disabled:opacity-40"
                            style={{ color: saved ? "#10b981" : "var(--accent-bright)" }}
                          >
                            <BookmarkPlus className="w-3 h-3" />
                            {saved ? "Saved to Story Bank" : savingToBank === rec.question.id ? "Saving…" : "Save to Story Bank"}
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">Skipped</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button onClick={restart} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all text-sm font-medium text-slate-300 hover:text-white" style={{ border: "1px solid var(--border)" }}>
                <RotateCcw className="w-4 h-4" /> New Session
              </button>
              <button onClick={() => router.push("/interview")} className="flex-1 btn-primary flex items-center justify-center gap-2 py-3">
                <BookmarkPlus className="w-4 h-4" /> View Story Bank
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
