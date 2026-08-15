"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { toast } from "sonner";
import { motionTransition } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ArrowLeft, Terminal, Play, Square, RotateCcw, Info,
  CheckCircle2, XCircle, AlertTriangle, Loader2, ShieldCheck, Code2,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Problem bank — a small, built-in set of classic DSA problems. Each defines
// an `entry` function name; the sandbox calls it with real example inputs
// and compares the actual return value against the expected one with a plain
// JSON-equality check. That's a real, deterministic pass/fail — not an AI or
// fabricated grade. `entry: null` is the freeform Scratchpad (no test cases).
// ─────────────────────────────────────────────────────────────────────────────

interface DsaTestCase {
  args: unknown[];
  expected: unknown;
}

interface DsaExample {
  input: string;
  output: string;
}

interface DsaProblem {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Freeform";
  entry: string | null;
  description: string;
  examples: DsaExample[];
  starterCode: string;
  tests: DsaTestCase[];
}

const PROBLEMS: DsaProblem[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    entry: "twoSum",
    description:
      "Given an array of integers nums and an integer target, return the indices of the two numbers that add up to target. Assume exactly one valid answer exists and you may not use the same element twice.",
    examples: [
      { input: "nums = [2,7,11,15], target = 9", output: "[0,1]" },
      { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
    ],
    starterCode: `/**
 * Return the indices of the two numbers in nums that add up to target.
 * Exactly one valid answer exists; don't use the same element twice.
 * Return the two indices in ascending order, e.g. [0, 1].
 */
function twoSum(nums, target) {
  // your code here

}`,
    tests: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { args: [[3, 2, 4], 6], expected: [1, 2] },
      { args: [[3, 3], 6], expected: [0, 1] },
    ],
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    entry: "isValid",
    description:
      "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the brackets are closed in the correct order.",
    examples: [
      { input: "s = \"()[]{}\"", output: "true" },
      { input: "s = \"(]\"", output: "false" },
    ],
    starterCode: `/**
 * Return true if every bracket in s is closed in the correct order.
 */
function isValid(s) {
  // your code here

}`,
    tests: [
      { args: ["()"], expected: true },
      { args: ["()[]{}"], expected: true },
      { args: ["(]"], expected: false },
      { args: ["([)]"], expected: false },
      { args: ["{[]}"], expected: true },
    ],
  },
  {
    id: "binary-search",
    title: "Binary Search",
    difficulty: "Easy",
    entry: "binarySearch",
    description:
      "sortedArr is sorted in ascending order. Return the index of target in sortedArr, or -1 if it isn't present. Aim for O(log n).",
    examples: [
      { input: "sortedArr = [-1,0,3,5,9,12], target = 9", output: "4" },
      { input: "sortedArr = [-1,0,3,5,9,12], target = 2", output: "-1" },
    ],
    starterCode: `/**
 * sortedArr is sorted ascending. Return the index of target, or -1 if
 * it isn't present. Aim for O(log n).
 */
function binarySearch(sortedArr, target) {
  // your code here

}`,
    tests: [
      { args: [[-1, 0, 3, 5, 9, 12], 9], expected: 4 },
      { args: [[-1, 0, 3, 5, 9, 12], 2], expected: -1 },
      { args: [[5], 5], expected: 0 },
    ],
  },
  {
    id: "merge-intervals",
    title: "Merge Intervals",
    difficulty: "Medium",
    entry: "mergeIntervals",
    description:
      "intervals is an array of [start, end] pairs. Merge all overlapping intervals and return the result sorted by start.",
    examples: [
      { input: "[[1,3],[2,6],[8,10],[15,18]]", output: "[[1,6],[8,10],[15,18]]" },
      { input: "[[1,4],[4,5]]", output: "[[1,5]]" },
    ],
    starterCode: `/**
 * intervals: number[][] like [[1,3],[2,6],[8,10],[15,18]].
 * Return the merged, non-overlapping intervals sorted by start.
 */
function mergeIntervals(intervals) {
  // your code here

}`,
    tests: [
      { args: [[[1, 3], [2, 6], [8, 10], [15, 18]]], expected: [[1, 6], [8, 10], [15, 18]] },
      { args: [[[1, 4], [4, 5]]], expected: [[1, 5]] },
    ],
  },
  {
    id: "max-subarray",
    title: "Maximum Subarray",
    difficulty: "Medium",
    entry: "maxSubArray",
    description:
      "Return the largest possible sum of any contiguous subarray of nums (Kadane's algorithm — aim for O(n)).",
    examples: [
      { input: "nums = [-2,1,-3,4,-1,2,1,-5,4]", output: "6" },
      { input: "nums = [5,4,-1,7,8]", output: "23" },
    ],
    starterCode: `/**
 * Return the largest sum of any contiguous subarray of nums.
 */
function maxSubArray(nums) {
  // your code here

}`,
    tests: [
      { args: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], expected: 6 },
      { args: [[1]], expected: 1 },
      { args: [[5, 4, -1, 7, 8]], expected: 23 },
    ],
  },
  {
    id: "scratchpad",
    title: "Scratchpad",
    difficulty: "Freeform",
    entry: null,
    description:
      "No test cases here — just experiment. Write any JavaScript, use console.log to inspect values, and optionally end with a return statement to see a final result.",
    examples: [],
    starterCode: `// Freeform scratchpad — no test cases here, just run and see what happens.
console.log("Hello from the sandbox!");

function sum(a, b) {
  return a + b;
}

console.log("2 + 3 =", sum(2, 3));

return sum(2, 3);`,
    tests: [],
  },
];

function difficultyClass(difficulty: DsaProblem["difficulty"]): string {
  switch (difficulty) {
    case "Easy": return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    case "Medium": return "border-amber-500/30 bg-amber-500/10 text-amber-400";
    default: return "border-indigo-500/30 bg-indigo-500/10 text-indigo-400";
  }
}

function difficultyTextClass(difficulty: DsaProblem["difficulty"]): string {
  switch (difficulty) {
    case "Easy": return "text-emerald-400";
    case "Medium": return "text-amber-400";
    default: return "text-indigo-400";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sandbox runner: a static HTML/JS document loaded via iframe.srcDoc into an
// iframe with sandbox="allow-scripts" (no allow-same-origin — it gets a
// unique opaque origin and cannot read this page's cookies, storage, or DOM).
// It only receives the submitted code via postMessage and only ever talks
// back the same way: captured console.log lines, a stringified return value,
// and per-example pass/fail results. Nothing here runs on a server.
// ─────────────────────────────────────────────────────────────────────────────

const EXEC_TIMEOUT_MS = 4000;

const RUNNER_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body>
<script>
(function () {
  function safeStringify(value) {
    try {
      if (value === undefined) return "undefined";
      if (typeof value === "function") return value.toString();
      if (typeof value === "number" && Number.isNaN(value)) return "NaN";
      return JSON.stringify(value);
    } catch (e) {
      try { return String(value); } catch (e2) { return "[unserializable value]"; }
    }
  }

  window.addEventListener("message", function (event) {
    var data = event.data || {};
    if (data.type !== "run") return;

    var logs = [];
    var originalLog = console.log;
    console.log = function () {
      try {
        logs.push(Array.prototype.map.call(arguments, safeStringify).join(" "));
      } catch (e) {
        logs.push("[log error]");
      }
    };

    var response = {
      type: "result",
      runId: data.runId,
      logs: [],
      testResults: [],
      error: null,
      returnValue: undefined
    };

    try {
      if (!data.entry) {
        var freeformFn = new Function(data.code);
        response.returnValue = safeStringify(freeformFn());
      } else {
        var factory = new Function(
          data.code + ";return (typeof " + data.entry + " === 'function') ? " + data.entry + " : null;"
        );
        var entryFn = factory();
        if (typeof entryFn !== "function") {
          response.error = "No function named '" + data.entry + "' was found. Make sure your solution defines it exactly as shown in the starter code.";
        } else {
          var tests = data.tests || [];
          for (var i = 0; i < tests.length; i++) {
            var t = tests[i];
            var tr = { input: t.args, expected: t.expected, actual: undefined, passed: false, error: null };
            try {
              var actual = entryFn.apply(null, t.args);
              tr.actual = safeStringify(actual);
              tr.passed = JSON.stringify(actual) === JSON.stringify(t.expected);
            } catch (err) {
              tr.error = (err && err.message) ? err.message : String(err);
            }
            response.testResults.push(tr);
          }
        }
      }
    } catch (err) {
      response.error = (err && err.message) ? err.message : String(err);
    }

    console.log = originalLog;
    response.logs = logs;
    parent.postMessage(response, "*");
  });

  parent.postMessage({ type: "ready" }, "*");
})();
</script>
</body>
</html>`;

interface DsaTestResultView {
  input: unknown[];
  expected: unknown;
  actual?: string;
  passed: boolean;
  error?: string | null;
}

interface RunResultView {
  logs: string[];
  testResults: DsaTestResultView[];
  error: string | null;
  returnValue?: string;
  timedOut?: boolean;
}

interface SandboxMessage {
  type?: string;
  runId?: number;
  logs?: string[];
  testResults?: DsaTestResultView[];
  error?: string | null;
  returnValue?: string;
}

export default function DsaSandboxPage() {
  const [selectedId, setSelectedId] = useState<string>(PROBLEMS[0].id);
  const [codeByProblem, setCodeByProblem] = useState<Record<string, string>>(() =>
    Object.fromEntries(PROBLEMS.map(p => [p.id, p.starterCode]))
  );
  const [status, setStatus] = useState<"idle" | "running" | "done" | "timeout">("idle");
  const [result, setResult] = useState<RunResultView | null>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [sandboxGen, setSandboxGen] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const runIdRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const problem = useMemo(
    () => PROBLEMS.find(p => p.id === selectedId) ?? PROBLEMS[0],
    [selectedId]
  );
  const code = codeByProblem[selectedId] ?? problem.starterCode;

  // Forcibly tears down and reloads the sandbox document — the only reliable
  // way to interrupt a hung synchronous script (an infinite loop can't be
  // "messaged" out of; destroying its execution context is the real kill switch).
  const resetSandbox = useCallback(() => {
    setIframeReady(false);
    setSandboxGen(g => g + 1);
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      const data = event.data as SandboxMessage | null;
      if (!data || typeof data !== "object") return;

      if (data.type === "ready") {
        setIframeReady(true);
        return;
      }

      if (data.type === "result") {
        if (data.runId !== runIdRef.current) return; // stale reply from a run we already timed out
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        const testResults = data.testResults ?? [];
        setStatus("done");
        setResult({
          logs: data.logs ?? [],
          testResults,
          error: data.error ?? null,
          returnValue: data.returnValue,
        });

        if (data.error) {
          toast.error("Your code hit an error — check the output panel.");
        } else if (testResults.length > 0) {
          const passed = testResults.filter(t => t.passed).length;
          if (passed === testResults.length) {
            toast.success(`All ${testResults.length} example${testResults.length === 1 ? "" : "s"} passed.`);
          } else {
            toast.warning(`${passed}/${testResults.length} examples passed.`);
          }
        } else {
          toast.success("Code ran successfully.");
        }
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  const runCode = useCallback(() => {
    if (status === "running") return;
    if (!iframeReady) {
      toast.error("Sandbox is still starting up — try again in a second.");
      return;
    }
    const myRunId = ++runIdRef.current;
    setStatus("running");
    setResult(null);

    timeoutRef.current = setTimeout(() => {
      if (runIdRef.current !== myRunId) return;
      setStatus("timeout");
      setResult({ logs: [], testResults: [], error: null, timedOut: true });
      toast.error(`Stopped after ${EXEC_TIMEOUT_MS / 1000}s — likely an infinite loop. The sandbox was reset.`);
      resetSandbox();
    }, EXEC_TIMEOUT_MS);

    iframeRef.current?.contentWindow?.postMessage(
      { type: "run", runId: myRunId, code, entry: problem.entry, tests: problem.tests },
      "*"
    );
  }, [status, iframeReady, code, problem, resetSandbox]);

  const stopExecution = useCallback(() => {
    if (status !== "running") return;
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    runIdRef.current++; // invalidate any in-flight response that arrives after this
    setStatus("timeout");
    setResult({ logs: [], testResults: [], error: null, timedOut: true });
    toast("Execution stopped.");
    resetSandbox();
  }, [status, resetSandbox]);

  const selectProblem = (id: string) => {
    if (status === "running") return;
    setSelectedId(id);
    setStatus("idle");
    setResult(null);
  };

  const handleCodeChange = (value: string) => {
    setCodeByProblem(prev => ({ ...prev, [selectedId]: value }));
  };

  const resetToStarter = () => {
    setCodeByProblem(prev => ({ ...prev, [selectedId]: problem.starterCode }));
  };

  const handleEditorKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = code.slice(0, start) + "  " + code.slice(end);
    handleCodeChange(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 2;
    });
  };

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-12 max-w-6xl">

        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <Link href="/interview" className="text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-medium mb-1">
              <Code2 className="w-3.5 h-3.5" /> Interview Prep
            </div>
            <h1 className="text-2xl font-bold text-white">
              DSA <span className="gradient-text">Sandbox</span>
            </h1>
          </div>
        </div>

        {/* Scope / safety disclosure */}
        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3 mb-5 text-xs"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-slate-400 leading-relaxed">
            <span className="text-slate-200 font-semibold">Client-side only, sandboxed.</span> Your code runs entirely
            in your browser inside an iframe with <code className="text-cyan-300">sandbox=&quot;allow-scripts&quot;</code> and
            no same-origin access, plus a {EXEC_TIMEOUT_MS / 1000}s hard execution timeout — it never reaches our
            servers, and it can&apos;t read this page&apos;s cookies, local storage, or your account. JavaScript only for
            now; Python or other languages would need a WASM runtime like Pyodide, which isn&apos;t part of this MVP.
          </p>
        </div>

        {/* Problem picker */}
        <div className="mb-5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Choose a Problem</p>
          <div className="flex flex-wrap gap-2">
            {PROBLEMS.map(p => {
              const active = selectedId === p.id;
              return (
                <Badge
                  asChild
                  variant="outline"
                  key={p.id}
                  className={cn(
                    "cursor-pointer gap-1.5 rounded-full text-xs font-medium px-3 py-1.5 border transition-all",
                    difficultyTextClass(p.difficulty),
                    active
                      ? "border-current bg-white/10"
                      : "border-slate-700/60 hover:border-current hover:bg-white/5"
                  )}
                >
                  <button onClick={() => selectProblem(p.id)} disabled={status === "running"}>
                    {p.title}
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Problem detail */}
          <motion.div
            key={selectedId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionTransition("base", "outQuint")}
          >
            <Card className="backdrop-blur-xl p-6 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={cn("text-xs font-semibold rounded-full", difficultyClass(problem.difficulty))}>
                  {problem.difficulty}
                </Badge>
                <h2 className="text-white font-semibold text-lg">{problem.title}</h2>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">{problem.description}</p>

              {problem.entry && (
                <div className="rounded-xl p-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Your function must be named
                  </p>
                  <code className="text-xs text-cyan-300 font-mono">{problem.entry}(...)</code>
                </div>
              )}

              {problem.examples.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Examples</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" aria-label="How examples are checked" className="text-slate-600 hover:text-slate-400 transition-colors">
                          <Info className="w-3 h-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[240px] text-xs leading-relaxed">
                        Your function is really executed against these inputs and compared with exact deep equality —
                        a real pass/fail, not a fabricated score. Output order matters (e.g. index or interval order).
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="space-y-2">
                    {problem.examples.map((ex, i) => (
                      <div
                        key={i}
                        className="rounded-xl p-3 font-mono text-[11px] leading-relaxed"
                        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                      >
                        <p className="text-slate-400"><span className="text-slate-500">Input:</span> {ex.input}</p>
                        <p className="text-emerald-300 mt-1"><span className="text-slate-500">Output:</span> {ex.output}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Editor + Output */}
          <div className="space-y-5">
            <Card className="backdrop-blur-xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold flex items-center gap-2 text-sm">
                  <Code2 className="w-4 h-4" style={{ color: "var(--accent)" }} /> Your Solution
                </h3>
                <Button
                  variant="ghost"
                  onClick={resetToStarter}
                  className="h-auto text-xs text-slate-500 hover:text-slate-300 hover:bg-transparent transition-colors flex items-center gap-1 px-2 py-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </Button>
              </div>

              <Textarea
                value={code}
                onChange={e => handleCodeChange(e.target.value)}
                onKeyDown={handleEditorKeyDown}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                className="font-mono text-[13px] leading-relaxed min-h-[340px] resize-y"
              />

              <div className="flex items-center gap-2">
                <Button
                  onClick={runCode}
                  disabled={status === "running" || !iframeReady}
                  className="btn-primary h-auto flex-1 flex items-center justify-center gap-2 py-2.5"
                >
                  {status === "running" ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Running…</>
                  ) : (
                    <><Play className="w-4 h-4" /> Run {problem.tests.length > 0 ? "Examples" : "Code"}</>
                  )}
                </Button>
                {status === "running" && (
                  <Button
                    variant="outline"
                    onClick={stopExecution}
                    className="h-auto px-3 py-2.5 flex items-center gap-1.5 text-xs"
                  >
                    <Square className="w-3.5 h-3.5" /> Stop
                  </Button>
                )}
              </div>
              {!iframeReady && status !== "running" && (
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Preparing sandbox…
                </p>
              )}
            </Card>

            <Card className="backdrop-blur-xl p-6 space-y-4">
              <h3 className="text-white font-semibold flex items-center gap-2 text-sm">
                <Terminal className="w-4 h-4" style={{ color: "var(--accent)" }} /> Output
              </h3>

              {status === "idle" && !result && (
                <EmptyState
                  icon={Terminal}
                  title="No output yet"
                  description="Click Run to execute your code inside the sandbox."
                  bordered={false}
                />
              )}

              {status === "running" && (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Running in the sandbox…
                </div>
              )}

              {result?.timedOut && (
                <div
                  className="rounded-xl p-4 flex items-start gap-3"
                  style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.25)" }}
                >
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-300 leading-relaxed">
                    Execution was stopped after {EXEC_TIMEOUT_MS / 1000} seconds — likely an infinite loop, or code that
                    never returns. The sandbox has been reset; fix your code and run again.
                  </p>
                </div>
              )}

              {result && !result.timedOut && (
                <>
                  {result.error && (
                    <div
                      className="rounded-xl p-4 flex items-start gap-3"
                      style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.25)" }}
                    >
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-rose-300 leading-relaxed font-mono whitespace-pre-wrap">{result.error}</p>
                    </div>
                  )}

                  {result.testResults.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Examples</p>
                        <span className={cn(
                          "text-xs font-bold",
                          result.testResults.every(t => t.passed) ? "text-emerald-400" : "text-amber-400"
                        )}>
                          {result.testResults.filter(t => t.passed).length}/{result.testResults.length} passed
                        </span>
                      </div>
                      <div className="space-y-2">
                        {result.testResults.map((t, i) => (
                          <div
                            key={i}
                            className="rounded-xl p-3 text-[11px] font-mono leading-relaxed"
                            style={{
                              background: "var(--bg-elevated)",
                              border: `1px solid ${t.passed ? "rgba(16,185,129,0.25)" : "rgba(244,63,94,0.25)"}`,
                            }}
                          >
                            <div className="flex items-center gap-1.5 mb-1.5 font-sans">
                              {t.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                              <span className={t.passed ? "text-emerald-400" : "text-rose-400"}>Test {i + 1}</span>
                            </div>
                            <p className="text-slate-500">Input: <span className="text-slate-300">{JSON.stringify(t.input)}</span></p>
                            <p className="text-slate-500">Expected: <span className="text-slate-300">{JSON.stringify(t.expected)}</span></p>
                            {t.error ? (
                              <p className="text-rose-400 mt-1">Threw: {t.error}</p>
                            ) : (
                              <p className="text-slate-500">
                                Actual: <span className={t.passed ? "text-emerald-300" : "text-rose-300"}>{t.actual}</span>
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {problem.entry === null && (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Return Value</p>
                      <div
                        className="rounded-xl p-3 font-mono text-xs text-slate-300"
                        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                      >
                        {result.returnValue === "undefined" ? (
                          <span className="text-slate-500 italic">No value returned — add a return statement to see one here.</span>
                        ) : (
                          result.returnValue
                        )}
                      </div>
                    </div>
                  )}

                  {result.logs.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Console Output</p>
                      <div
                        className="rounded-xl p-3 font-mono text-xs text-slate-300 whitespace-pre-wrap max-h-56 overflow-y-auto"
                        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                      >
                        {result.logs.join("\n")}
                      </div>
                    </div>
                  )}

                  {!result.error && result.testResults.length === 0 && problem.entry !== null && (
                    <p className="text-xs text-slate-500 italic">Ran with no example test cases for this problem.</p>
                  )}
                </>
              )}
            </Card>
          </div>
        </div>
      </main>

      {/* Hidden execution sandbox. Remounting via `key` on timeout/stop fully
          destroys the old document (and any hung script) and boots a fresh one. */}
      <iframe
        key={sandboxGen}
        ref={iframeRef}
        sandbox="allow-scripts"
        srcDoc={RUNNER_HTML}
        title="DSA code execution sandbox"
        aria-hidden="true"
        tabIndex={-1}
        // Belt-and-suspenders readiness signal: the runner document's inline
        // script posts {type:"ready"} synchronously during parse, which can
        // race ahead of the message-listener useEffect (registered post-commit)
        // and get missed. onLoad is a native DOM event React attaches during
        // commit — before the browser can even start loading srcDoc — so it
        // is guaranteed to fire after the listener exists.
        onLoad={() => setIframeReady(true)}
        style={{ position: "absolute", width: 0, height: 0, border: "none", opacity: 0, pointerEvents: "none" }}
      />
    </div>
  );
}
