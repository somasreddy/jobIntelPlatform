"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useProfile } from "@/lib/ProfileContext";
import { useAppData } from "@/lib/AppDataContext";
import { motionTransition } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Brain, ChevronRight, CheckCircle2,
  Star, BookmarkPlus, ArrowLeft, RotateCcw, Zap,
  AlertTriangle, Play, Pause, SkipForward, Trophy,
  TrendingUp, MessageSquare, Target, Lightbulb,
  Mic, MicOff, Volume2, VolumeX, Info,
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

// ── Voice practice metrics (honest, transcript-derived — see info tooltip) ─────
// These are simple, real counts over the actual browser-transcribed text: a
// word-count-over-elapsed-mic-time speaking rate, and a keyword-frequency
// filler count. No AI scoring, no fabricated "confidence" numbers.
interface VoiceMetrics {
  wpm: number;
  fillerTotal: number;
  fillerBreakdown: { term: string; count: number }[];
  speakingSecs: number;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

const FILLER_TERMS: { term: string; regex: RegExp }[] = [
  { term: "um", regex: /\bums?\b/gi },
  { term: "uh", regex: /\buhs?\b/gi },
  { term: "er", regex: /\bers?\b/gi },
  { term: "like", regex: /\blike\b/gi },
  { term: "you know", regex: /\byou know\b/gi },
  { term: "i mean", regex: /\bi mean\b/gi },
  { term: "sort of", regex: /\bsort of\b/gi },
  { term: "kind of", regex: /\bkind of\b/gi },
  { term: "basically", regex: /\bbasically\b/gi },
  { term: "actually", regex: /\bactually\b/gi },
];

function countFillerWords(text: string): { total: number; breakdown: { term: string; count: number }[] } {
  const breakdown: { term: string; count: number }[] = [];
  let total = 0;
  for (const { term, regex } of FILLER_TERMS) {
    const matches = text.match(regex);
    const count = matches ? matches.length : 0;
    if (count > 0) {
      breakdown.push({ term, count });
      total += count;
    }
  }
  return { total, breakdown };
}

const THINK_SECS = 30;
const DEFAULT_ANSWER_SECS = 120;

// ── Component ─────────────────────────────────────────────────────────────────
export default function InterviewSimulatorPage() {
  const router = useRouter();
  const { profile, loading } = useProfile();
  const { refreshStories, authHeaders } = useAppData();

  // Setup state
  const [targetRole, setTargetRole] = useState("");
  const [targetCompany, setTargetCompany] = useState("");
  const [answerTimeSecs, setAnswerTimeSecs] = useState(DEFAULT_ANSWER_SECS);
  const [questionCount, setQuestionCount] = useState(5);
  const [questions, setQuestions] = useState<SimQuestion[]>([]);
  const [loadingQs, setLoadingQs] = useState(false);
  const [interviewMode, setInterviewMode] = useState<"standard" | "case_study" | "stress_test" | "panel">("standard");
  const [panelPersona, setPanelPersona] = useState<string>("Hiring Manager");

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

  // ── Voice state ────────────────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceMetrics, setVoiceMetrics] = useState<VoiceMetrics | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  // Elapsed mic-on time for the current question, accumulated across
  // start/stop toggles; used to derive an honest words-per-minute figure.
  const speakingSessionStartRef = useRef<number | null>(null);
  const speakingElapsedMsRef = useRef(0);

  useEffect(() => {
    // Check browser support
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = typeof window !== "undefined" ? (window as any) : null;
    const SpeechRecognitionAPI = w && (w.SpeechRecognition || w.webkitSpeechRecognition);
    setVoiceSupported(!!SpeechRecognitionAPI && typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  // Recomputes the honest WPM/filler metrics from whatever text is currently
  // in the transcript, using total mic-on time (previous sessions this
  // question + however long the current session has been running).
  const updateVoiceMetrics = useCallback((text: string) => {
    const words = countWords(text);
    const sessionMs = speakingSessionStartRef.current != null
      ? performance.now() - speakingSessionStartRef.current
      : 0;
    const totalMs = speakingElapsedMsRef.current + sessionMs;
    const minutes = totalMs / 60000;
    // Guard against wildly inflated WPM from a handful of words over a
    // near-zero duration (e.g. the very first recognized word).
    const wpm = minutes > 0.05 ? Math.round(words / minutes) : 0;
    const { total, breakdown } = countFillerWords(text);
    setVoiceMetrics({ wpm, fillerTotal: total, fillerBreakdown: breakdown, speakingSecs: Math.round(totalMs / 1000) });
  }, []);

  const finalizeSpeakingSession = useCallback((finalAnswerText: string) => {
    if (speakingSessionStartRef.current != null) {
      speakingElapsedMsRef.current += Math.max(performance.now() - speakingSessionStartRef.current, 0);
      speakingSessionStartRef.current = null;
    }
    updateVoiceMetrics(finalAnswerText);
  }, [updateVoiceMetrics]);

  const startListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      return; // isListening + metrics are finalized in recognition.onend below
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalText = answer;
    speakingSessionStartRef.current = performance.now();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += (finalText ? " " : "") + transcript;
        } else {
          interim = transcript;
        }
      }
      const combined = finalText + (interim ? " " + interim : "");
      setAnswer(combined);
      updateVoiceMetrics(combined);
    };

    recognition.onend = () => {
      setIsListening(false);
      const trimmed = finalText.trim();
      setAnswer(trimmed);
      finalizeSpeakingSession(trimmed);
    };

    recognition.onerror = () => {
      setIsListening(false);
      finalizeSpeakingSession(finalText.trim());
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, answer, updateVoiceMetrics, finalizeSpeakingSession]);

  const speakQuestion = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (isSpeaking) {
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [isSpeaking]);

  // Stop listening/speaking when phase changes
  useEffect(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [phase, currentIdx]);

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
        body: JSON.stringify({
          profile,
          target_role: targetRole,
          target_company: targetCompany,
          mode: interviewMode,
          panel_persona: panelPersona,
        }),
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
    // Stress test: shrink timer
    if (interviewMode === "stress_test") {
      setAnswerTimeSecs(60);
    }
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
    // Fresh question — reset the speaking-time/word-count baseline used for
    // the honest WPM figure so previous questions don't bleed into this one.
    speakingElapsedMsRef.current = 0;
    speakingSessionStartRef.current = null;
    setVoiceMetrics(null);
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
      const res = await fetch(`${apiUrl}/api/interview/stories`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          title: record.question.question.slice(0, 80),
          situation: record.answer,
          task: "",
          action: "",
          result: `Score: ${record.overall}/100 (Clarity ${record.scores.clarity}, Specificity ${record.scores.specificity}, Relevance ${record.scores.relevance})`,
          tags: [record.question.domain, record.question.type, record.question.difficulty],
        }),
      });
      if (res.ok) {
        setSavedIds(prev => new Set([...prev, qId]));
        refreshStories(); // sync to AppDataContext so Interview page sees it instantly
      }
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
    speakingElapsedMsRef.current = 0;
    speakingSessionStartRef.current = null;
    setVoiceMetrics(null);
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
          <EmptyState
            icon={Brain}
            title="No profile found"
            description="Set up your career profile first."
            size="lg"
            action={{ label: "Set Up Profile", onClick: () => router.push("/profile") }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-12 max-w-3xl">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => phase === "setup" ? router.push("/interview") : restart()}
                className="h-auto w-auto p-0 text-slate-400 hover:text-white hover:bg-transparent transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{phase === "setup" ? "Back to Interview Prep" : "Restart session"}</TooltipContent>
          </Tooltip>
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-medium mb-1">
              <Brain className="w-3.5 h-3.5" /> Interview Simulator
              {interviewMode !== "standard" && (
                <Badge
                  className="ml-2 rounded-full text-[10px] font-bold border-none px-2 py-0.5"
                  style={{ background: "var(--accent)", color: "white" }}
                >
                  {interviewMode === "case_study" ? "📊 Case Study" :
                   interviewMode === "stress_test" ? "⚡ Stress Test" : "👥 Panel"}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white">
              Live <span className="gradient-text">Mock Session</span>
            </h1>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* ── SETUP PHASE ──────────────────────────────────────────────────── */}
          {phase === "setup" && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={motionTransition("base", "outQuint")}
              className="space-y-5"
            >
              <Card className="backdrop-blur-xl p-6">
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

                {/* Interview Mode */}
                <div className="mb-5">
                  <label className="block text-xs font-medium text-slate-400 mb-2">Interview Mode</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { value: "standard", label: "Standard", desc: "Behavioral & technical mix", emoji: "🎯" },
                      { value: "case_study", label: "Case Study", desc: "Business problem solving", emoji: "📊" },
                      { value: "stress_test", label: "Stress Test", desc: "Rapid-fire under pressure", emoji: "⚡" },
                      { value: "panel", label: "Panel", desc: "Multi-persona interviewers", emoji: "👥" },
                    ].map(mode => (
                      <button
                        key={mode.value}
                        onClick={() => setInterviewMode(mode.value as typeof interviewMode)}
                        className="p-3 rounded-xl text-left transition-all"
                        style={{
                          background: interviewMode === mode.value
                            ? "color-mix(in srgb, var(--accent) 15%, transparent)"
                            : "var(--bg-elevated)",
                          border: `1px solid ${interviewMode === mode.value ? "var(--border-hover)" : "var(--border)"}`,
                        }}>
                        <div className="text-base mb-1">{mode.emoji}</div>
                        <p className="text-xs font-semibold text-white">{mode.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{mode.desc}</p>
                      </button>
                    ))}
                  </div>
                  {interviewMode === "panel" && (
                    <div className="mt-3">
                      <label className="text-xs text-slate-400 mb-1 block">Current Interviewer Persona</label>
                      <select
                        className="input-field w-full"
                        value={panelPersona}
                        onChange={e => setPanelPersona(e.target.value)}>
                        <option>Hiring Manager</option>
                        <option>Technical Lead</option>
                        <option>HR / Recruiter</option>
                        <option>Executive / VP</option>
                        <option>Peer Engineer</option>
                      </select>
                    </div>
                  )}
                  {interviewMode === "stress_test" && (
                    <p className="text-[11px] text-amber-400 mt-2">
                      ⚡ Stress Test: shorter time limits, rapid follow-ups, unexpected pivots. Stay calm!
                    </p>
                  )}
                  {interviewMode === "case_study" && (
                    <p className="text-[11px] text-slate-400 mt-2">
                      📊 Case Study: you&apos;ll be asked to analyze business scenarios and present structured recommendations.
                    </p>
                  )}
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

                <Button
                  onClick={startSimulation}
                  disabled={loadingQs || !targetRole.trim()}
                  className="btn-primary h-auto w-full flex items-center justify-center gap-2 py-3 text-base"
                >
                  {loadingQs ? (
                    <><RotateCcw className="w-4 h-4 animate-spin" /> Loading questions…</>
                  ) : (
                    <><Play className="w-4 h-4" /> Start Simulation</>
                  )}
                </Button>
              </Card>
            </motion.div>
          )}

          {/* ── THINKING PHASE ───────────────────────────────────────────────── */}
          {phase === "thinking" && currentQ && (
            <motion.div
              key={`thinking-${currentIdx}`}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={motionTransition("base", "outQuint")}
              className="space-y-4"
            >
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

              <Card className="backdrop-blur-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn(
                      "text-xs font-semibold rounded-full",
                      currentQ.difficulty === "Easy" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
                      currentQ.difficulty === "Medium" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" :
                      "border-rose-500/30 bg-rose-500/10 text-rose-400"
                    )}>{currentQ.difficulty}</Badge>
                    <span className="text-xs text-slate-500">{currentQ.domain}</span>
                  </div>
                  <div className="ml-auto">
                    <Button variant="ghost" onClick={skipQuestion} className="h-auto p-0 text-xs text-slate-500 hover:text-slate-300 hover:bg-transparent transition-colors flex items-center gap-1">
                      <SkipForward className="w-3.5 h-3.5" /> Skip
                    </Button>
                  </div>
                </div>

                <div className="flex items-start gap-3 mb-3">
                  <h2 className="text-white text-lg font-semibold leading-snug flex-1">
                    {currentQ.question}
                  </h2>
                  {voiceSupported && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => speakQuestion(currentQ.question)}
                          className="shrink-0 h-auto w-auto p-2 rounded-lg transition-all mt-0.5 hover:bg-transparent"
                          style={{
                            background: isSpeaking ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "var(--bg-elevated)",
                            border: `1px solid ${isSpeaking ? "var(--border-hover)" : "var(--border)"}`,
                            color: isSpeaking ? "var(--accent-bright)" : "#64748b",
                          }}>
                          {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Read question aloud</TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {!voiceSupported && (
                  <p className="text-[11px] text-slate-500 mb-3 flex items-center gap-1.5">
                    <MicOff className="w-3 h-3 shrink-0" />
                    Voice practice (read-aloud + speech-to-text) isn&apos;t available in this browser.
                  </p>
                )}

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
                  <Button
                    onClick={beginAnswering}
                    className="btn-primary h-auto text-sm px-5 py-2 flex items-center gap-1.5 mt-1"
                  >
                    <Zap className="w-3.5 h-3.5" /> Start Answering Now
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── ANSWERING PHASE ──────────────────────────────────────────────── */}
          {phase === "answering" && currentQ && (
            <motion.div
              key={`answering-${currentIdx}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={motionTransition("base", "outQuint")}
              className="space-y-4"
            >
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

              <Card className="backdrop-blur-xl p-6">
                {/* Question + timer row */}
                <div className="flex items-start gap-4 mb-5">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={cn(
                        "text-xs font-semibold rounded-full",
                        currentQ.difficulty === "Easy" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
                        currentQ.difficulty === "Medium" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" :
                        "border-rose-500/30 bg-rose-500/10 text-rose-400"
                      )}>{currentQ.difficulty}</Badge>
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={togglePause} className="h-auto w-auto p-0 text-slate-500 hover:text-white hover:bg-transparent transition-colors">
                          {timerPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{timerPaused ? "Resume timer" : "Pause timer"}</TooltipContent>
                    </Tooltip>
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

                {/* Voice + Read controls */}
                {voiceSupported ? (
                  <div className="mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="ghost"
                        onClick={() => speakQuestion(currentQ.question)}
                        className="h-auto flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-all hover:bg-transparent"
                        style={{
                          background: isSpeaking ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "var(--bg-elevated)",
                          border: `1px solid ${isSpeaking ? "var(--border-hover)" : "var(--border)"}`,
                          color: isSpeaking ? "var(--accent-bright)" : "#64748b",
                        }}>
                        {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        {isSpeaking ? "Stop" : "Read aloud"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={startListening}
                        className="h-auto flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-all hover:bg-transparent"
                        style={{
                          background: isListening ? "#ef444420" : "var(--bg-elevated)",
                          border: `1px solid ${isListening ? "#ef4444" : "var(--border)"}`,
                          color: isListening ? "#ef4444" : "#64748b",
                        }}>
                        {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                        {isListening ? "Stop recording" : "Voice input"}
                      </Button>
                      {isListening && (
                        <span className="flex items-center gap-1 text-[10px] text-red-400 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          Listening…
                        </span>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="About voice practice accuracy"
                            className="text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[260px] text-xs leading-relaxed">
                          Uses your browser&apos;s built-in speech recognition (Web Speech API) — nothing is sent to a
                          speech-analysis service. Words-per-minute and filler-word counts are simple, honest counts
                          from the transcript, not a professional speech coach. Accuracy depends on your browser,
                          microphone, and accent.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    {voiceMetrics && (voiceMetrics.speakingSecs > 0 || voiceMetrics.fillerTotal > 0) && (
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Mic className="w-3 h-3 text-indigo-400" />
                          {voiceMetrics.wpm > 0 ? `~${voiceMetrics.wpm} WPM` : "Calculating pace…"}
                        </span>
                        <span>
                          {voiceMetrics.fillerTotal} filler word{voiceMetrics.fillerTotal === 1 ? "" : "s"}
                          {voiceMetrics.fillerBreakdown.length > 0 && (
                            <span className="text-slate-500">
                              {" "}({voiceMetrics.fillerBreakdown.map(f => `${f.term}×${f.count}`).join(", ")})
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 mb-2 flex items-center gap-1.5">
                    <MicOff className="w-3 h-3 shrink-0" />
                    Voice practice isn&apos;t available in this browser — it needs the Web Speech API (Chrome, Edge, or
                    another Chromium-based browser with microphone support). You can still type your answer below.
                  </p>
                )}

                {/* Answer textarea */}
                <textarea
                  ref={textareaRef}
                  className="input-field w-full resize-none text-sm leading-relaxed"
                  rows={8}
                  placeholder="Type your answer here… or use Voice Input above. Use STAR format: Situation → Task → Action → Result. Include specific numbers, tools, and outcomes."
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                />
                <div className="flex items-center justify-between mt-1 mb-4">
                  <span className="text-[10px] text-slate-500">{answer.trim().split(/\s+/).filter(Boolean).length} words</span>
                  {timerPaused && <span className="text-[10px] text-amber-400 flex items-center gap-1"><Pause className="w-3 h-3" /> Paused</span>}
                </div>

                <div className="flex gap-3">
                  <Button variant="ghost" onClick={skipQuestion} className="h-auto text-xs text-slate-500 hover:text-slate-300 hover:bg-transparent transition-colors flex items-center gap-1 px-3">
                    <SkipForward className="w-3.5 h-3.5" /> Skip
                  </Button>
                  <Button
                    onClick={submitAnswer}
                    className="btn-primary h-auto flex-1 flex items-center justify-center gap-2 py-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Submit Answer
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── SCORING PHASE ────────────────────────────────────────────────── */}
          {phase === "scoring" && currentQ && (() => {
            const dims = scoreAnswer(answer, currentQ);
            const overall = overallScore(dims);
            const { label, color } = scoreLabel(overall);
            return (
              <motion.div
                key={`scoring-${currentIdx}`}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={motionTransition("base", "outQuint")}
                className="space-y-4"
              >
                <Card className="backdrop-blur-xl p-6">
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
                    <Button
                      onClick={() => saveToStoryBank({ question: currentQ, answer, scores: dims, overall, savedToBank: false, timeTaken: timeTakenSecs })}
                      disabled={!answer.trim() || savedIds.has(currentQ.id) || savingToBank === currentQ.id}
                      variant="outline"
                      className="h-auto flex items-center gap-1.5 text-xs font-medium px-4 py-2.5 rounded-xl transition-all disabled:opacity-40"
                      style={{ border: "1px solid var(--border)", color: "var(--accent-bright)" }}
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      {savedIds.has(currentQ.id) ? "Saved!" : savingToBank === currentQ.id ? "Saving…" : "Save to Story Bank"}
                    </Button>
                    <Button
                      onClick={() => confirmScore(currentQ, timeTakenSecs)}
                      className="btn-primary h-auto flex-1 flex items-center justify-center gap-2 py-2.5"
                    >
                      {currentIdx + 1 < questions.length ? (
                        <><ChevronRight className="w-4 h-4" /> Next Question</>
                      ) : (
                        <><Trophy className="w-4 h-4" /> See Results</>
                      )}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })()}

          {/* ── SUMMARY PHASE ────────────────────────────────────────────────── */}
          {phase === "summary" && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={motionTransition("base", "outQuint")}
              className="space-y-5"
            >
              {/* Overall result card */}
              <Card className="backdrop-blur-xl p-6 text-center">
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
              </Card>

              {/* Per-question breakdown */}
              <Card className="backdrop-blur-xl p-5">
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
                            <Button
                              variant="ghost"
                              onClick={() => saveToStoryBank(rec)}
                              disabled={saved || savingToBank === rec.question.id}
                              className="h-auto p-0 text-[10px] flex items-center gap-1 transition-colors disabled:opacity-40 hover:bg-transparent"
                              style={{ color: saved ? "#10b981" : "var(--accent-bright)" }}
                            >
                              <BookmarkPlus className="w-3 h-3" />
                              {saved ? "Saved to Story Bank" : savingToBank === rec.question.id ? "Saving…" : "Save to Story Bank"}
                            </Button>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Skipped</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button onClick={restart} className="btn-secondary h-auto flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium">
                  <RotateCcw className="w-4 h-4" /> New Session
                </Button>
                <Button onClick={() => router.push("/interview")} className="btn-primary h-auto flex-1 flex items-center justify-center gap-2 py-3">
                  <BookmarkPlus className="w-4 h-4" /> View Story Bank
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── FALLBACK: no questions loaded for a non-setup, non-summary phase ── */}
          {phase !== "setup" && phase !== "summary" && !currentQ && (
            <motion.div
              key="no-questions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={motionTransition("base", "smooth")}
            >
              <EmptyState
                icon={AlertTriangle}
                title="No questions available"
                description="We couldn't load a question set for this session. Head back to setup and try again."
                action={{ label: "Back to Setup", onClick: restart }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
