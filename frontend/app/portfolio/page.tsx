"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  Globe, Github, Linkedin, Plus, Trash2, Loader2,
  CheckCircle2, Eye, EyeOff, Zap, ExternalLink, Star,
  Code2,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
               : { "Content-Type": "application/json" };
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  ai_impact: string | null;
  tech_stack: string[];
  demo_url: string | null;
  github_url: string | null;
  featured: boolean;
}

interface PortfolioData {
  id: string;
  slug: string;
  headline: string | null;
  bio: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  website_url: string | null;
  theme: string;
  is_public: boolean;
  view_count: number;
  skills: string[];
  certifications: string[];
  public_url: string;
  projects: Project[];
}

export default function PortfolioPage() {
  const { token } = useAuth();
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingBio, setGeneratingBio] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "projects">("editor");

  // Portfolio form
  const [form, setForm] = useState({
    headline: "", bio: "", linkedin_url: "", github_url: "", website_url: "",
    is_public: false, skills: "", certifications: "",
  });

  // New project form
  const [newProject, setNewProject] = useState({
    title: "", description: "", tech_stack: "", demo_url: "", github_url: "", featured: false,
  });
  const [addingProject, setAddingProject] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);

  const fetchPortfolio = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/portfolio/`, { headers: authHeaders(token) });
      if (res.ok) {
        const data: PortfolioData = await res.json();
        setPortfolio(data);
        setForm({
          headline: data.headline || "",
          bio: data.bio || "",
          linkedin_url: data.linkedin_url || "",
          github_url: data.github_url || "",
          website_url: data.website_url || "",
          is_public: data.is_public,
          skills: (data.skills || []).join(", "),
          certifications: (data.certifications || []).join(", "),
        });
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchPortfolio(); }, [fetchPortfolio]);

  const savePortfolio = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/api/portfolio/`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({
          headline: form.headline || null,
          bio: form.bio || null,
          linkedin_url: form.linkedin_url || null,
          github_url: form.github_url || null,
          website_url: form.website_url || null,
          is_public: form.is_public,
          skills: form.skills.split(",").map(s => s.trim()).filter(Boolean),
          certifications: form.certifications.split(",").map(s => s.trim()).filter(Boolean),
        }),
      });
      await fetchPortfolio();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const generateBio = async () => {
    setGeneratingBio(true);
    try {
      const res = await fetch(`${API}/api/portfolio/generate-bio`, {
        method: "POST",
        headers: authHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.bio) setForm(p => ({ ...p, bio: data.bio }));
      }
    } catch (e) { console.error(e); }
    finally { setGeneratingBio(false); }
  };

  const addProject = async () => {
    if (!newProject.title.trim()) return;
    setAddingProject(true);
    try {
      await fetch(`${API}/api/portfolio/projects`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          title: newProject.title,
          description: newProject.description || null,
          tech_stack: newProject.tech_stack.split(",").map(s => s.trim()).filter(Boolean),
          demo_url: newProject.demo_url || null,
          github_url: newProject.github_url || null,
          featured: newProject.featured,
        }),
      });
      setNewProject({ title: "", description: "", tech_stack: "", demo_url: "", github_url: "", featured: false });
      setShowProjectForm(false);
      await fetchPortfolio();
    } catch (e) { console.error(e); }
    finally { setAddingProject(false); }
  };

  const deleteProject = async (id: string) => {
    await fetch(`${API}/api/portfolio/projects/${id}`, { method: "DELETE", headers: authHeaders(token) });
    await fetchPortfolio();
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-6 pb-8 max-w-4xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Globe className="w-6 h-6" style={{ color: "var(--accent)" }} />
              Portfolio Builder
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">Your public career portfolio</p>
          </div>
          <div className="flex items-center gap-2">
            {portfolio?.is_public && (
              <a href={portfolio.public_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-all"
                style={{ background: "var(--bg-elevated)", color: "var(--accent-bright)" }}>
                <ExternalLink className="w-3.5 h-3.5" /> View Public
              </a>
            )}
            {portfolio && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Eye className="w-3.5 h-3.5" /> {portfolio.view_count} views
              </div>
            )}
          </div>
        </div>

        {/* Slug + visibility banner */}
        {portfolio && (
          <div className="card p-4 mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Your portfolio URL</p>
              <p className="text-sm font-mono text-white">/portfolio/{portfolio.slug}</p>
            </div>
            <button
              onClick={() => { setForm(p => ({ ...p, is_public: !p.is_public })); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={form.is_public ? {
                background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981",
              } : { background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "#94a3b8" }}>
              {form.is_public ? <><Eye className="w-4 h-4" /> Public</> : <><EyeOff className="w-4 h-4" /> Private</>}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
          {(["editor", "projects"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all"
              style={activeTab === tab ? {
                background: "color-mix(in srgb, var(--accent) 20%, transparent)",
                color: "var(--accent-bright)",
                border: "1px solid var(--border-hover)",
              } : { color: "#94a3b8" }}>
              {tab === "editor" ? "Profile" : "Projects"}
            </button>
          ))}
        </div>

        {/* ── EDITOR TAB ── */}
        {activeTab === "editor" && (
          <div className="card p-6 space-y-5">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Headline</label>
              <input className="input-field w-full" placeholder="Senior Engineer · Building AI products"
                value={form.headline} onChange={e => setForm(p => ({ ...p, headline: e.target.value }))} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-400">Bio</label>
                <button onClick={generateBio} disabled={generatingBio}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all"
                  style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent-bright)" }}>
                  {generatingBio ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  AI Generate
                </button>
              </div>
              <textarea className="input-field w-full resize-none text-sm" rows={4}
                placeholder="Write your bio or click AI Generate…"
                value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} />
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">LinkedIn URL</label>
                <div className="relative">
                  <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input className="input-field w-full pl-9 text-sm" placeholder="linkedin.com/in/..."
                    value={form.linkedin_url} onChange={e => setForm(p => ({ ...p, linkedin_url: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">GitHub URL</label>
                <div className="relative">
                  <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input className="input-field w-full pl-9 text-sm" placeholder="github.com/..."
                    value={form.github_url} onChange={e => setForm(p => ({ ...p, github_url: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Website</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input className="input-field w-full pl-9 text-sm" placeholder="https://..."
                    value={form.website_url} onChange={e => setForm(p => ({ ...p, website_url: e.target.value }))} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Skills <span className="text-slate-600">(comma-separated)</span></label>
              <input className="input-field w-full" placeholder="Python, TypeScript, AWS, React"
                value={form.skills} onChange={e => setForm(p => ({ ...p, skills: e.target.value }))} />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Certifications <span className="text-slate-600">(comma-separated)</span></label>
              <input className="input-field w-full" placeholder="AWS Solutions Architect, CKA"
                value={form.certifications} onChange={e => setForm(p => ({ ...p, certifications: e.target.value }))} />
            </div>

            <button onClick={savePortfolio} disabled={saving}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 font-semibold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save Portfolio
            </button>
          </div>
        )}

        {/* ── PROJECTS TAB ── */}
        {activeTab === "projects" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowProjectForm(p => !p)}
                className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
                <Plus className="w-4 h-4" /> Add Project
              </button>
            </div>

            {showProjectForm && (
              <div className="card p-5 space-y-3">
                <h3 className="text-sm font-semibold text-white">New Project</h3>
                <input className="input-field w-full text-sm" placeholder="Project title"
                  value={newProject.title} onChange={e => setNewProject(p => ({ ...p, title: e.target.value }))} />
                <textarea className="input-field w-full text-sm resize-none" rows={3}
                  placeholder="What did you build? What problem did it solve? What was the impact?"
                  value={newProject.description} onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))} />
                <input className="input-field w-full text-sm" placeholder="Tech stack (comma-separated)"
                  value={newProject.tech_stack} onChange={e => setNewProject(p => ({ ...p, tech_stack: e.target.value }))} />
                <div className="grid sm:grid-cols-2 gap-3">
                  <input className="input-field text-sm" placeholder="Demo URL"
                    value={newProject.demo_url} onChange={e => setNewProject(p => ({ ...p, demo_url: e.target.value }))} />
                  <input className="input-field text-sm" placeholder="GitHub URL"
                    value={newProject.github_url} onChange={e => setNewProject(p => ({ ...p, github_url: e.target.value }))} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="featured" checked={newProject.featured}
                    onChange={e => setNewProject(p => ({ ...p, featured: e.target.checked }))} />
                  <label htmlFor="featured" className="text-xs text-slate-400">Feature this project</label>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowProjectForm(false)} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
                  <button onClick={addProject} disabled={addingProject || !newProject.title.trim()}
                    className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
                    {addingProject ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    Add with AI Enhancement
                  </button>
                </div>
              </div>
            )}

            {(portfolio?.projects ?? []).length === 0 && !showProjectForm && (
              <div className="card p-8 text-center">
                <Code2 className="w-8 h-8 mx-auto mb-3 text-slate-600" />
                <p className="text-sm text-slate-500">No projects yet — add your best work</p>
              </div>
            )}

            {(portfolio?.projects ?? []).map(project => (
              <div key={project.id} className="card p-5">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-white">{project.title}</h3>
                      {project.featured && <Star className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    {project.ai_impact && (
                      <p className="text-xs text-emerald-300 mb-2 font-medium italic">&quot;{project.ai_impact}&quot;</p>
                    )}
                    {project.description && !project.ai_impact && (
                      <p className="text-xs text-slate-400 mb-2">{project.description}</p>
                    )}
                    {project.tech_stack.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {project.tech_stack.map(t => <span key={t} className="tag">{t}</span>)}
                      </div>
                    )}
                    <div className="flex gap-3">
                      {project.demo_url && (
                        <a href={project.demo_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs" style={{ color: "var(--accent-bright)" }}>
                          <ExternalLink className="w-3 h-3" /> Demo
                        </a>
                      )}
                      {project.github_url && (
                        <a href={project.github_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">
                          <Github className="w-3 h-3" /> Code
                        </a>
                      )}
                    </div>
                  </div>
                  <button onClick={() => deleteProject(project.id)} className="text-slate-600 hover:text-rose-400 transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
