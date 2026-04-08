"use client";
import { use, useState, useEffect } from "react";
import Link from "next/link";
import {
  Globe, Github, Linkedin, ExternalLink, Star,
  BookOpen, Award, Zap,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PublicPortfolio {
  slug: string;
  headline: string;
  bio: string;
  ai_bio?: string;
  avatar_url?: string;
  linkedin_url?: string;
  github_url?: string;
  website_url?: string;
  theme?: string;
  skills: string[];
  certifications: string[];
  view_count: number;
  projects: Array<{
    id: string;
    title: string;
    description: string;
    ai_impact?: string;
    tech_stack: string[];
    demo_url?: string;
    github_url?: string;
    image_url?: string;
    featured: boolean;
  }>;
}

export default function PublicPortfolioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [portfolio, setPortfolio] = useState<PublicPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/portfolio/public/${slug}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null; }
        if (!r.ok) throw new Error("Error");
        return r.json();
      })
      .then(data => { if (data) setPortfolio(data); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin"
          style={{ borderTopColor: "var(--accent)" }} />
      </div>
    );
  }

  if (notFound || !portfolio) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "var(--bg-base)" }}>
        <Zap className="w-12 h-12 text-slate-600" />
        <p className="text-lg font-semibold text-white">Portfolio not found</p>
        <p className="text-sm text-slate-400">This portfolio doesn&apos;t exist or is private.</p>
        <Link href="/" className="px-4 py-2 rounded-xl text-sm"
          style={{ background: "var(--accent)", color: "white" }}>
          Go Home
        </Link>
      </div>
    );
  }

  const displayBio = portfolio.ai_bio || portfolio.bio;
  const featured = portfolio.projects.filter(p => p.featured);
  const others = portfolio.projects.filter(p => !p.featured);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, var(--accent-deep) 0%, var(--bg-card) 60%)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center shrink-0 text-3xl font-bold text-white"
              style={{
                background: "linear-gradient(135deg, var(--accent-deep), var(--accent), var(--accent-secondary))",
                boxShadow: "0 8px 24px -4px var(--glow-accent)",
              }}>
              {portfolio.headline?.[0] ?? slug[0].toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                {portfolio.headline || slug}
              </h1>
              {displayBio && (
                <p className="mt-2 text-sm md:text-base text-slate-300 leading-relaxed max-w-xl">
                  {displayBio}
                </p>
              )}

              {/* Social links */}
              <div className="flex flex-wrap items-center gap-3 mt-4">
                {portfolio.linkedin_url && (
                  <a href={portfolio.linkedin_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors">
                    <Linkedin className="w-4 h-4" /> LinkedIn
                  </a>
                )}
                {portfolio.github_url && (
                  <a href={portfolio.github_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors">
                    <Github className="w-4 h-4" /> GitHub
                  </a>
                )}
                {portfolio.website_url && (
                  <a href={portfolio.website_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors">
                    <Globe className="w-4 h-4" /> Website
                  </a>
                )}
                <span className="text-[10px] text-slate-500 ml-auto">
                  {portfolio.view_count} views
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">

        {/* Skills */}
        {portfolio.skills.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {portfolio.skills.map(skill => (
                <span key={skill} className="px-3 py-1.5 rounded-xl text-xs font-medium"
                  style={{
                    background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                    color: "var(--accent-bright)",
                    border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                  }}>
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Certifications */}
        {portfolio.certifications.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Certifications</h2>
            <div className="flex flex-wrap gap-2">
              {portfolio.certifications.map(cert => (
                <span key={cert} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--accent-bright)",
                    border: "1px solid var(--border)",
                  }}>
                  <Award className="w-3 h-3" /> {cert}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Featured Projects */}
        {featured.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Featured Projects
            </h2>
            <div className="grid md:grid-cols-2 gap-5">
              {featured.map(proj => (
                <ProjectCard key={proj.id} proj={proj} featured />
              ))}
            </div>
          </section>
        )}

        {/* Other Projects */}
        {others.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Other Projects
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {others.map(proj => (
                <ProjectCard key={proj.id} proj={proj} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {portfolio.projects.length === 0 && (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-slate-400">No projects added yet.</p>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center pt-6" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-[11px] text-slate-600">
            Built with{" "}
            <span style={{ color: "var(--accent-bright)" }}>JobIntel AI</span>
            {" "}· Career Intelligence Platform
          </p>
        </footer>
      </div>
    </div>
  );
}

function ProjectCard({
  proj, featured = false,
}: {
  proj: PublicPortfolio["projects"][number];
  featured?: boolean;
}) {
  return (
    <div className="rounded-2xl overflow-hidden transition-all hover:scale-[1.01]"
      style={{
        background: "var(--bg-card)",
        border: featured ? "1px solid var(--border-hover)" : "1px solid var(--border)",
        boxShadow: featured ? "0 4px 20px -6px var(--glow-accent)" : "none",
      }}>
      {proj.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={proj.image_url} alt={proj.title}
          className="w-full h-36 object-cover" />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-white">{proj.title}</h3>
          {featured && <Star className="w-4 h-4 shrink-0" style={{ color: "var(--accent-bright)" }} />}
        </div>

        {proj.ai_impact ? (
          <p className="text-xs text-slate-300 leading-relaxed mb-2">{proj.ai_impact}</p>
        ) : (
          <p className="text-xs text-slate-400 leading-relaxed mb-2 line-clamp-3">{proj.description}</p>
        )}

        {proj.tech_stack.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {proj.tech_stack.slice(0, 5).map(tech => (
              <span key={tech} className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: "var(--border)", color: "#94a3b8" }}>
                {tech}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {proj.demo_url && (
            <a href={proj.demo_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg transition-colors"
              style={{ background: "var(--accent)", color: "white" }}>
              <ExternalLink className="w-3 h-3" /> Live Demo
            </a>
          )}
          {proj.github_url && (
            <a href={proj.github_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg transition-colors"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "#94a3b8" }}>
              <Github className="w-3 h-3" /> Code
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
