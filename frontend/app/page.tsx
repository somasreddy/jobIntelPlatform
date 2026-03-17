"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import {
  User, Briefcase, DollarSign, MapPin, Clock,
  Plus, X, Upload, ChevronRight, Sparkles, CheckCircle
} from "lucide-react";

const ALL_SKILLS = [
  "Selenium", "Playwright", "Cypress", "Appium", "REST Assured",
  "Postman", "JMeter", "K6", "TestNG", "JUnit", "Pytest", "Cucumber BDD",
  "Robot Framework", "Java", "Python", "JavaScript", "TypeScript", "SQL",
  "Jenkins", "GitHub Actions", "Docker", "Kubernetes", "AWS", "Azure DevOps",
  "Maven", "Gradle", "JIRA", "Git", "GraphQL Testing", "Performance Testing",
];

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    currentRole: "Senior QA Engineer",
    currentSalary: "",
    currency: "USD",
    experienceYears: "",
    currentLocation: "",
    preferredLocations: [] as string[],
    preferredLocation: "",
    skills: [] as string[],
    workMode: "Any",
    resumeFile: null as File | null,
  });
  const [dragging, setDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");

  const addSkill = (skill: string) => {
    if (!form.skills.includes(skill)) {
      setForm((p) => ({ ...p, skills: [...p.skills, skill] }));
    }
  };
  const removeSkill = (skill: string) =>
    setForm((p) => ({ ...p, skills: p.skills.filter((s) => s !== skill) }));

  const addLocation = () => {
    const loc = form.preferredLocation.trim();
    if (loc && !form.preferredLocations.includes(loc)) {
      setForm((p) => ({
        ...p,
        preferredLocations: [...p.preferredLocations, loc],
        preferredLocation: "",
      }));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setForm((p) => ({ ...p, resumeFile: f }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Save profile to sessionStorage for use across pages
    sessionStorage.setItem("candidateProfile", JSON.stringify(form));
    setSubmitted(true);
    setTimeout(() => router.push("/jobs"), 1200);
  };

  const filteredSkills = ALL_SKILLS.filter(
    (s) =>
      s.toLowerCase().includes(skillSearch.toLowerCase()) &&
      !form.skills.includes(s)
  );

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Navbar />
      <main className="ml-64 flex-1 px-8 py-8 max-w-5xl">
        {/* Hero header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-cyan-400 text-sm font-medium mb-2">
            <Sparkles className="w-4 h-4" /> AI-Powered Career Uplift Engine
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Tell us about your <span className="gradient-text">career profile</span>
          </h1>
          <p className="text-slate-400 text-base">
            We&apos;ll find verified jobs at the{" "}
            <span className="text-indigo-300 font-medium">same level with higher salary</span>{" "}
            or{" "}
            <span className="text-emerald-300 font-medium">next career level</span>{" "}
            you&apos;re ready for — and generate tailored ATS resumes, cover letters, and recruiter emails for each.
          </p>
        </div>

        {submitted ? (
          <div className="card flex flex-col items-center justify-center py-16 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Profile Saved!</h2>
            <p className="text-slate-400">Finding your best job matches…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Personal Info */}
            <div className="card">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-400" /> Personal Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
                  <input
                    className="input"
                    placeholder="Somas V"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Current Role</label>
                  <input
                    className="input"
                    placeholder="Senior QA Engineer"
                    value={form.currentRole}
                    onChange={(e) => setForm((p) => ({ ...p, currentRole: e.target.value }))}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Career Details */}
            <div className="card">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-400" /> Career Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    <DollarSign className="w-3 h-3 inline mr-0.5" /> Current Salary
                  </label>
                  <div className="flex gap-2">
                    <select
                      className="input w-20 flex-shrink-0"
                      value={form.currency}
                      onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                    >
                      <option value="USD">USD</option>
                      <option value="INR">INR</option>
                      <option value="GBP">GBP</option>
                      <option value="EUR">EUR</option>
                      <option value="AUD">AUD</option>
                    </select>
                    <input
                      className="input"
                      type="number"
                      placeholder="95000"
                      value={form.currentSalary}
                      onChange={(e) => setForm((p) => ({ ...p, currentSalary: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    <Clock className="w-3 h-3 inline mr-0.5" /> Relevant Experience (years)
                  </label>
                  <input
                    className="input"
                    type="number"
                    placeholder="8"
                    value={form.experienceYears}
                    onChange={(e) => setForm((p) => ({ ...p, experienceYears: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Preferred Work Mode</label>
                  <select
                    className="input"
                    value={form.workMode}
                    onChange={(e) => setForm((p) => ({ ...p, workMode: e.target.value }))}
                  >
                    <option value="Any">Any</option>
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="On-site">On-site</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: Location */}
            <div className="card">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-400" /> Location Preferences
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Current Location</label>
                  <input
                    className="input"
                    placeholder="Hyderabad, India"
                    value={form.currentLocation}
                    onChange={(e) => setForm((p) => ({ ...p, currentLocation: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Preferred Job Locations</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      className="input"
                      placeholder="e.g. Remote, Bangalore, London"
                      value={form.preferredLocation}
                      onChange={(e) => setForm((p) => ({ ...p, preferredLocation: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLocation(); } }}
                    />
                    <button type="button" onClick={addLocation} className="btn-secondary px-3">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.preferredLocations.map((loc) => (
                      <span key={loc} className="flex items-center gap-1 badge badge-tech">
                        {loc}
                        <button type="button" onClick={() => setForm((p) => ({ ...p, preferredLocations: p.preferredLocations.filter((l) => l !== loc) }))}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Skills & Technologies */}
            <div className="card">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" /> Known Technologies & Skills
              </h2>
              <input
                className="input mb-3"
                placeholder="Search technologies (e.g. Selenium, Playwright, Docker)…"
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
              />
              {/* Suggestions */}
              {skillSearch && filteredSkills.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {filteredSkills.slice(0, 10).map((s) => (
                    <button
                      key={s} type="button"
                      onClick={() => { addSkill(s); setSkillSearch(""); }}
                      className="tag cursor-pointer hover:bg-indigo-500/20 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> {s}
                    </button>
                  ))}
                </div>
              )}
              {/* Quick add all */}
              {!skillSearch && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {ALL_SKILLS.filter((s) => !form.skills.includes(s)).slice(0, 16).map((s) => (
                    <button key={s} type="button" onClick={() => addSkill(s)}
                      className="tag cursor-pointer hover:bg-indigo-500/20 transition-colors text-[11px]">
                      + {s}
                    </button>
                  ))}
                </div>
              )}
              {/* Selected skills */}
              {form.skills.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-2">Selected ({form.skills.length}):</p>
                  <div className="flex flex-wrap gap-2">
                    {form.skills.map((s) => (
                      <span key={s} className="flex items-center gap-1 badge badge-verified text-xs">
                        {s}
                        <button type="button" onClick={() => removeSkill(s)}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Section 5: Resume Upload */}
            <div className="card">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-400" /> Upload Your Current Resume
              </h2>
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  dragging
                    ? "border-indigo-400 bg-indigo-500/10"
                    : "border-slate-600 hover:border-slate-500"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                {form.resumeFile ? (
                  <div className="flex items-center justify-center gap-3 text-emerald-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">{form.resumeFile.name}</span>
                    <button type="button" onClick={() => setForm((p) => ({ ...p, resumeFile: null }))} className="text-slate-400 hover:text-rose-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm mb-1">Drag & drop your resume here</p>
                    <p className="text-slate-500 text-xs mb-3">PDF or DOCX up to 5MB</p>
                    <label className="btn-secondary text-sm cursor-pointer">
                      Browse File
                      <input type="file" accept=".pdf,.docx,.doc" className="hidden"
                        onChange={(e) => e.target.files?.[0] && setForm((p) => ({ ...p, resumeFile: e.target.files![0] }))} />
                    </label>
                  </>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                * Resume upload is optional. We&apos;ll use your profile data to generate ATS resumes even without it.
              </p>
            </div>

            {/* Submit */}
            <button type="submit" className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              Find My Best Job Matches
              <ChevronRight className="w-5 h-5" />
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
