"use client";
import Navbar from "@/components/Navbar";
import { mockSkillGaps, mockRoadmap, demoProfile } from "@/lib/mockData";
import { BrainCircuit, Target, BookOpen, AlertCircle, ArrowRight, Zap, GraduationCap } from "lucide-react";
import { useState, useEffect } from "react";

export default function IntelligencePage() {
  const [profile] = useState(demoProfile);
  const [apiGaps, setApiGaps] = useState<typeof mockSkillGaps | null>(null);
  const [apiStrengths, setApiStrengths] = useState<typeof mockSkillGaps | null>(null);
  const [apiRoadmap, setApiRoadmap] = useState<typeof mockRoadmap | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("candidateProfile");
    const prof = saved ? (() => { try { return JSON.parse(saved); } catch { return demoProfile; } })() : demoProfile;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;
    fetch(`${apiUrl}/api/skill-gap/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_skills: prof.skills ?? [], target_role: prof.currentRole ?? "QA Automation Engineer" }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        if (d.missing_high_demand_skills) setApiGaps(d.missing_high_demand_skills);
        if (d.strengths) setApiStrengths(d.strengths);
        if (d.roadmap) setApiRoadmap(d.roadmap);
      })
      .catch(() => {});
  }, []);

  const gaps = apiGaps ?? mockSkillGaps.filter(g => !g.inProfile);
  const strengths = apiStrengths ?? mockSkillGaps.filter(g => g.inProfile);
  const roadmap = apiRoadmap ?? mockRoadmap;

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Navbar />
      <main className="ml-64 flex-1 px-8 py-8 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium mb-2">
            <BrainCircuit className="w-4 h-4" /> Career Intelligence Engine
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Skill Gap <span className="gradient-text">Analysis & Roadmap</span>
          </h1>
          <p className="text-slate-400 text-sm">
            AI constantly analyzes the requirements of verified high-paying jobs to find missing skills in your profile.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Col: Skill Gap Analysis */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-rose-400" /> Missing High-Demand Skills
                </h2>
                <span className="badge badge-hot">Based on 1,420 parsed JDs</span>
              </div>

              <div className="grid gap-3">
                {gaps.map((gap) => (
                  <div key={gap.skill} className="bg-[#1e293b] border border-[#334155] rounded-xl p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base font-medium text-white">{gap.skill}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-500 bg-[#0f172a] px-2 py-0.5 rounded">
                          {gap.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 max-w-[200px] h-1.5 bg-[#0f172a] rounded-full overflow-hidden">
                          <div className="h-full bg-linear-to-r from-rose-500 to-amber-500" style={{ width: `${gap.demandScore}%` }} />
                        </div>
                        <span className="text-xs text-rose-400 font-medium">{gap.demandScore}% Market Demand</span>
                      </div>
                    </div>
                    {gap.learningResource && (
                      <button 
                        onClick={() => {
                          const url = gap.learningResource?.startsWith('http') ? gap.learningResource : `https://${gap.learningResource}`;
                          window.open(url, '_blank');
                        }}
                        className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <BookOpen className="w-3.5 h-3.5" /> Start Learning
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="card border-emerald-500/20 bg-emerald-500/5">
              <h2 className="text-lg font-semibold text-emerald-400 mb-2 flex items-center gap-2">
                <Zap className="w-5 h-5" /> Your Strengths (In High Demand)
              </h2>
              <div className="flex flex-wrap gap-2 mt-4">
                {strengths.map(gap => (
                  <span key={gap.skill} className="badge badge-verified text-sm px-3 py-1">
                    {gap.skill} ({gap.demandScore}% Demand)
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Col: Learning Roadmap */}
          <div className="space-y-6">
            <div className="card relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full" />
              
              <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2 relative">
                <GraduationCap className="w-5 h-5 text-indigo-400" /> AI Learning Roadmap
              </h2>

              <div className="relative pl-6 border-l-2 border-[#334155] space-y-8">
                {roadmap.map((phase, i) => (
                  <div key={phase.phase} className="relative">
                    <div className={`absolute -left-[35px] w-4 h-4 rounded-full border-4 border-[#1e293b] ${i === 0 ? 'bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)]' : 'bg-[#334155]'}`} />
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Phase {phase.phase} · {phase.duration}</span>
                    <h3 className="text-base font-semibold text-white mt-1 mb-2">{phase.title}</h3>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {phase.skills.map(s => (
                        <span key={s} className="tag bg-[#0f172a] border-slate-700 text-slate-300">{s}</span>
                      ))}
                    </div>
                    {phase.resources && phase.resources.length > 0 && (
                      <button 
                        onClick={() => {
                          const url = phase.resources[0].startsWith('http') ? phase.resources[0] : `https://${phase.resources[0]}`;
                          window.open(url, '_blank');
                        }}
                        className="text-xs text-indigo-300 hover:text-indigo-200 flex items-center gap-1 font-medium transition-colors"
                      >
                        View Resources <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="card bg-linear-to-br from-indigo-900/40 to-cyan-900/20 border-indigo-500/20">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-cyan-400" /> Career Insight
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Adding <strong className="text-white">Kubernetes</strong> and <strong className="text-white">K6</strong> to your profile will unlock <strong>45% more Sr. QA Automation</strong> roles with salaries &gt; $150k.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
