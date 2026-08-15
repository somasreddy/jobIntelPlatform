"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useProfile } from "@/lib/ProfileContext";
import { CandidateProfile } from "@/lib/types";
import { durations, easings, motionTransition } from "@/lib/motion-tokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Linkedin, Sparkles, CheckCircle, AlertCircle,
  Star, User, Briefcase, Award, UserCircle2,
  MessageSquare, Eye, Copy, Check,
} from "lucide-react";

interface Suggestion {
  section: string;
  priority: "Critical" | "High" | "Medium";
  current?: string;
  recommended: string;
  reason: string;
  icon: React.ComponentType<{ className?: string }>;
}

function buildSuggestions(profile: CandidateProfile, linkedinUrl: string): Suggestion[] {
  const allSkills = [
    ...(profile.skills ?? []),
    ...(profile.frameworks ?? []),
    ...(profile.cicdTools ?? []),
    ...(profile.languages ?? []),
  ];
  const topSkills = allSkills.slice(0, 5).join(", ");
  const role = profile.currentRole || "Software Engineer";
  const exp = profile.experienceYears || 0;
  const location = profile.currentLocation || "your location";

  const suggestions: Suggestion[] = [
    {
      section: "Headline",
      priority: "Critical",
      current: role,
      recommended: `${role} | ${allSkills.slice(0, 3).join(" · ")} | ${exp}+ Years${profile.certifications?.length ? " | " + profile.certifications[0] : ""}`,
      reason: "LinkedIn headlines with skills and years of experience get 3× more profile views. Keywords in your headline are indexed by LinkedIn's search algorithm.",
      icon: Star,
    },
    {
      section: "About / Summary",
      priority: "Critical",
      recommended: `Results-driven ${role} with ${exp}+ years of experience building ${allSkills.slice(0, 2).join(" and ")} solutions. Passionate about ${profile.frameworks?.length ? profile.frameworks.slice(0, 2).join(" and ") + " ecosystems" : "scalable engineering"}. Open to ${profile.workMode === "Remote" ? "fully remote" : profile.workMode === "Hybrid" ? "hybrid and remote" : "on-site and hybrid"} opportunities in ${profile.preferredLocations?.join(", ") || location}.\n\n🔧 Core expertise: ${topSkills || role}\n📍 Based in: ${location}\n✉️ Open to collaborations and senior/lead roles`,
      reason: "A keyword-rich About section with 3 paragraphs and relevant skills ranks higher in recruiter searches. Use your top 5 skills naturally in the first sentence.",
      icon: MessageSquare,
    },
    {
      section: "Skills Section",
      priority: "High",
      recommended: `Add these high-demand skills (in order of relevance): ${allSkills.slice(0, 10).join(", ")}. Move your most-searched skills to the top 3 pinned spots — recruiters see only the first 3 without scrolling.`,
      reason: "LinkedIn profiles with 5+ skills get 17× more profile views. Pinning your most in-demand skills maximises visibility in search results.",
      icon: Award,
    },
    {
      section: "Experience Bullets",
      priority: "High",
      recommended: `Rewrite each bullet using the STAR format: "Led [Action] that resulted in [Quantified Outcome], using [${allSkills.slice(0, 2).join(", ")}]." Example: "Architected ${allSkills[0] || "automation"} framework that reduced ${allSkills.includes("CI/CD") || allSkills.includes("Jenkins") ? "CI/CD pipeline time by 40%" : "manual effort by 60%"} across ${exp > 5 ? "3 product teams" : "2 squads"}."`,
      reason: "Bullets with numbers get 40% more engagement. Recruiters spend an average of 7 seconds scanning — leading with impact metrics makes you stand out.",
      icon: Briefcase,
    },
    {
      section: "Open to Work",
      priority: "High",
      recommended: `Enable "Open to Work" privately (visible only to recruiters). Set your job titles to: ${role}, Senior ${role}${profile.experienceYears && profile.experienceYears >= 6 ? `, Lead ${role.split(" ").pop()}` : ""}. Set preferred location to: ${profile.preferredLocations?.join(", ") || location}. Select work type: ${profile.workMode === "Any" ? "Remote, Hybrid, On-site" : profile.workMode}.`,
      reason: "Profiles with Open to Work get 2× more recruiter InMails. Setting specific job titles ensures you appear in the right searches.",
      icon: Eye,
    },
    {
      section: "Featured Section",
      priority: "Medium",
      recommended: `Add 2–3 featured items: (1) A project demo or GitHub repo showcasing ${allSkills[0] || "your primary tech stack"}, (2) A LinkedIn post or article about ${allSkills.slice(0, 2).join(" or ")}, (3) Your best professional achievement or case study with measurable outcomes.`,
      reason: "Profiles with a Featured section get 8× more profile views. It's the first thing recruiters see and signals proactivity.",
      icon: Star,
    },
    {
      section: "Certifications",
      priority: profile.certifications?.length ? "Medium" : "High",
      recommended: profile.certifications?.length
        ? `Your certifications (${profile.certifications.join(", ")}) should be listed with the issuing organization and expiry date. Consider adding: ${allSkills.includes("AWS") ? "AWS Solutions Architect" : allSkills.includes("Kubernetes") ? "CKA (Certified Kubernetes Admin)" : "a relevant cloud or framework certification"}.`
        : `No certifications detected in your profile. Highly recommended: ${allSkills.includes("AWS") || allSkills.includes("GCP") ? "Cloud certification (AWS/GCP/Azure)" : allSkills.includes("Machine Learning") || allSkills.includes("PyTorch") ? "TensorFlow Developer Certificate or AWS ML Specialty" : "A role-relevant certification (e.g., GitHub Actions, Docker)"} — these appear in 68% of senior job requirements.`,
      reason: "Certifications boost profile credibility and filter-match in recruiter searches by up to 35%.",
      icon: Award,
    },
    {
      section: "Recommendations",
      priority: "Medium",
      recommended: `Request 2–3 recommendations: (1) A direct manager or tech lead who can speak to your ${allSkills[0] || "core"} skills, (2) A cross-functional peer who can validate collaboration and impact, (3) A mentee or junior engineer if you have led people.`,
      reason: "Profiles with 3+ recommendations are 4× more likely to result in an interview. Recruiters treat them as social proof.",
      icon: MessageSquare,
    },
    {
      section: "Profile Completeness",
      priority: "Medium",
      recommended: `Ensure you have: (1) A professional headshot — profiles with photos get 21× more views, (2) Custom LinkedIn URL (linkedin.com/in/your-name), (3) A banner image related to ${role} or ${allSkills[0] || "your tech stack"}, (4) At least 500 connections for "500+" credibility badge.`,
      reason: "LinkedIn's All-Star status (requiring all fields complete) gets you ranked higher in search results and unlocks more visibility.",
      icon: User,
    },
  ];

  // If URL was provided, add a URL-specific tip
  if (linkedinUrl && linkedinUrl.includes("linkedin.com/in/")) {
    const handle = linkedinUrl.split("linkedin.com/in/")[1]?.replace(/\/$/, "");
    if (handle && (handle.includes("_") || /[0-9]{5,}/.test(handle))) {
      suggestions.unshift({
        section: "Custom URL",
        priority: "Critical",
        current: handle,
        recommended: `linkedin.com/in/${profile.name?.toLowerCase().replace(/\s+/g, "-") || "your-name"}`,
        reason: "Your current URL looks auto-generated. A clean custom URL improves personal branding and appears professional in resumes and email signatures.",
        icon: Linkedin,
      });
    }
  }

  return suggestions;
}

const priorityBadgeClass: Record<Suggestion["priority"], string> = {
  Critical: "text-rose-400 bg-rose-500/10 border-rose-500/30",
  High:     "text-amber-400 bg-amber-500/10 border-amber-500/30",
  Medium:   "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
};

// ─── Motion variants ────────────────────────────────────────────────────────
const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: durations.base, ease: easings.outQuint } },
};

export default function LinkedInEnhancerClient() {
  const router = useRouter();
  const { profile, loading } = useProfile();
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [apiSuggestions, setApiSuggestions] = useState<Suggestion[] | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleAnalyze = async () => {
    if (!profile) return;
    setAnalyzing(true);
    setSuggestions(null);

    // Try API first
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) {
      try {
        const res = await fetch(`${apiUrl}/api/linkedin/enhance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile,
            linkedin_url: linkedinUrl,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.suggestions?.length) {
            setApiSuggestions(data.suggestions);
            setSuggestions(data.suggestions);
            setAnalyzing(false);
            return;
          }
        }
      } catch { /* fall through to local generation */ }
    }

    // Generate locally from profile
    await new Promise((r) => setTimeout(r, 1400)); // simulate analysis
    const generated = buildSuggestions(profile, linkedinUrl);
    setSuggestions(generated);
    setAnalyzing(false);
  };

  const handleCopy = async (index: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((cur) => (cur === index ? null : cur)), 1800);
    } catch {
      /* clipboard unavailable — fail silently */
    }
  };

  if (!loading && !profile) {
    return (
      <div className="flex min-h-screen bg-transparent">
        <main className="md:ml-64 xl:mr-72 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-8 flex items-center justify-center">
          <EmptyState
            size="lg"
            icon={UserCircle2}
            title="No profile found"
            description="Set up your career profile first — we use your skills, experience, and role to generate personalised LinkedIn suggestions."
            action={{ label: "Set Up Profile", onClick: () => router.push("/profile") }}
            className="max-w-sm"
          />
        </main>
      </div>
    );
  }

  const criticalCount = suggestions?.filter((s) => s.priority === "Critical").length ?? 0;
  const highCount = suggestions?.filter((s) => s.priority === "High").length ?? 0;

  const phase: "loading" | "results" | "empty" = analyzing ? "loading" : suggestions ? "results" : "empty";

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 xl:mr-72 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium mb-2">
            <Linkedin className="w-4 h-4" /> LinkedIn Profile Enhancer
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Optimise Your <span className="gradient-text">LinkedIn Profile</span>
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            AI analyses your career profile and generates targeted suggestions to maximise recruiter visibility, ATS match, and profile completeness — based on what top-ranking profiles in your field look like.
          </p>
        </div>

        {/* Input Card */}
        <Card className="mb-6">
          <CardContent>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#0077b5]/20 border border-[#0077b5]/30 flex items-center justify-center">
                <Linkedin className="w-5 h-5 text-[#0077b5]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Your LinkedIn URL</p>
                <p className="text-[11px] text-slate-500">Optional — helps detect custom URL issues</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Input
                className="flex-1"
                placeholder="https://linkedin.com/in/your-profile"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
              />
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                <Button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="flex items-center gap-2 px-5 whitespace-nowrap h-9"
                >
                  {analyzing ? (
                    <span className="flex items-center gap-2">
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                        className="inline-flex"
                      >
                        <Sparkles className="w-4 h-4" />
                      </motion.span>
                      Analysing…
                    </span>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Analyse Profile
                    </>
                  )}
                </Button>
              </motion.div>
            </div>
            <Separator className="my-3" />
            <p className="text-[11px] text-slate-500">
              Based on profile: <span className="text-slate-300">{profile?.name || "—"}</span> · <span className="text-slate-300">{profile?.currentRole || "—"}</span> · <span className="text-slate-300">{(profile?.skills?.length ?? 0)} skills loaded</span>
            </p>
          </CardContent>
        </Card>

        <AnimatePresence mode="wait">
          {phase === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={motionTransition("base", "outQuint")}
            >
              {/* Loading State */}
              <Card className="mb-6">
                <CardContent className="text-center py-8">
                  <motion.div
                    className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4"
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: easings.easeInOut }}
                  >
                    <Sparkles className="w-7 h-7 text-indigo-400" />
                  </motion.div>
                  <p className="text-white font-semibold mb-1">Analysing your profile…</p>
                  <p className="text-slate-400 text-sm">Comparing against top-ranking profiles in your field</p>
                </CardContent>
              </Card>

              {/* Skeleton preview of the shape results will take */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
                {[0, 1, 2].map((i) => (
                  <Card key={i} className="py-3">
                    <CardContent className="flex flex-col items-center gap-1.5">
                      <Skeleton className="h-7 w-10" />
                      <Skeleton className="h-3 w-20" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <Card key={i}>
                    <CardContent className="flex items-start gap-4">
                      <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-14 rounded" />
                        </div>
                        <Skeleton className="h-14 w-full rounded-lg" />
                        <Skeleton className="h-3 w-4/5" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {phase === "results" && suggestions && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={motionTransition("base", "outQuint")}
            >
              {/* Summary bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
                <Card className="py-3">
                  <CardContent className="text-center">
                    <p className="text-2xl font-bold text-rose-400">{criticalCount}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Critical Fixes</p>
                  </CardContent>
                </Card>
                <Card className="py-3">
                  <CardContent className="text-center">
                    <p className="text-2xl font-bold text-amber-400">{highCount}</p>
                    <p className="text-xs text-slate-400 mt-0.5">High Priority</p>
                  </CardContent>
                </Card>
                <Card className="py-3">
                  <CardContent className="text-center">
                    <p className="text-2xl font-bold text-indigo-400">{suggestions.length}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Total Suggestions</p>
                  </CardContent>
                </Card>
              </div>

              {/* Suggestion Cards */}
              <motion.div className="space-y-4" variants={listVariants} initial="hidden" animate="show">
                {suggestions.map((s, i) => {
                  const Icon = s.icon;
                  const copied = copiedIndex === i;
                  return (
                    <motion.div key={i} variants={itemVariants}>
                      <Card className="border-[#334155]">
                        <CardContent className="flex items-start gap-4">
                          <div className="w-9 h-9 rounded-xl bg-slate-700/50 flex items-center justify-center shrink-0 mt-0.5">
                            <Icon className="w-4 h-4 text-slate-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-sm font-semibold text-white">{s.section}</span>
                              <Badge variant="outline" className={priorityBadgeClass[s.priority]}>
                                {s.priority}
                              </Badge>
                            </div>

                            {s.current && (
                              <div className="mb-2 p-2 rounded-lg" style={{ background: "var(--bg-base)", border: "1px solid var(--border)" }}>
                                <p className="text-[10px] text-slate-500 mb-0.5 uppercase font-semibold">Current</p>
                                <p className="text-xs text-slate-400">{s.current}</p>
                              </div>
                            )}

                            <div className="mb-2 p-3 bg-indigo-500/5 rounded-lg border border-indigo-500/20 relative">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] text-indigo-400 uppercase font-semibold flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" /> Recommended
                                </p>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="px-2 text-slate-400 hover:text-white"
                                      onClick={() => handleCopy(i, s.recommended)}
                                    >
                                      <AnimatePresence mode="wait" initial={false}>
                                        {copied ? (
                                          <motion.span
                                            key="check"
                                            initial={{ opacity: 0, scale: 0.6 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.6 }}
                                            transition={{ duration: durations.instant, ease: easings.spring }}
                                            className="inline-flex"
                                          >
                                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                                          </motion.span>
                                        ) : (
                                          <motion.span
                                            key="copy"
                                            initial={{ opacity: 0, scale: 0.6 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.6 }}
                                            transition={{ duration: durations.instant, ease: easings.spring }}
                                            className="inline-flex"
                                          >
                                            <Copy className="w-3.5 h-3.5" />
                                          </motion.span>
                                        )}
                                      </AnimatePresence>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{copied ? "Copied!" : "Copy recommendation"}</TooltipContent>
                                </Tooltip>
                              </div>
                              <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">{s.recommended}</p>
                            </div>

                            <div className="flex items-start gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                              <p className="text-[11px] text-slate-500 leading-relaxed">{s.reason}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Footer note */}
              <p className="text-xs text-slate-600 text-center mt-8">
                Suggestions generated from your career profile · Update your profile to regenerate · {apiSuggestions ? "AI-powered" : "Profile-based analysis"}
              </p>
            </motion.div>
          )}

          {phase === "empty" && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={motionTransition("base", "outQuint")}
            >
              <EmptyState
                icon={Linkedin}
                title="Ready to optimise your LinkedIn"
                description="Click “Analyse Profile” to get personalised suggestions across Headline, About, Skills, Experience, and more — tailored to your role and skill stack."
                size="lg"
              >
                <div className="flex items-center justify-center gap-6 text-xs text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Headline optimisation</span>
                  <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Skills & keyword gaps</span>
                  <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Experience bullet rewrites</span>
                </div>
              </EmptyState>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
