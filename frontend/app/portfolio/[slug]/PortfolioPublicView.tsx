"use client";
import { useState } from "react";
import { motion } from "motion/react";
import {
  Globe, Github, Linkedin, ExternalLink, Star,
  BookOpen, Award, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import DataFreshness from "@/components/DataFreshness";
import { durations, easings, motionTransition } from "@/lib/motion-tokens";
import type { PublicPortfolio } from "./types";

interface PortfolioPublicViewProps {
  slug: string;
  portfolio: PublicPortfolio | null;
}

/**
 * Client-side render of the public portfolio. The parent Server Component
 * (page.tsx) already resolved the fetch (shared with generateMetadata via
 * Next's automatic fetch de-duplication) — this component is purely
 * presentational plus the Motion entrance choreography, which requires a
 * Client Component.
 */
export default function PortfolioPublicView({ slug, portfolio }: PortfolioPublicViewProps) {
  // Timestamp for the moment this client component actually received the
  // (server-fetched, `cache: "no-store"`) portfolio data — the fetch itself
  // happens in the parent Server Component (page.tsx), which is outside
  // this file's scope, so this is the earliest point a display timestamp
  // for "how fresh is this" can honestly be captured on the client.
  const [loadedAt] = useState<Date>(() => new Date());

  if (!portfolio) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <EmptyState
          icon={Zap}
          title="Portfolio not found"
          description="This portfolio doesn't exist or is private."
          action={{ label: "Go Home", href: "/" }}
          bordered={false}
          size="lg"
        />
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
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={motionTransition("slow", "spring")}
              className="w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center shrink-0 text-3xl font-bold text-white"
              style={{
                background: "linear-gradient(135deg, var(--accent-deep), var(--accent), var(--accent-secondary))",
                boxShadow: "0 8px 24px -4px var(--glow-accent)",
              }}
            >
              {portfolio.headline?.[0] ?? slug[0].toUpperCase()}
            </motion.div>

            <div className="flex-1 min-w-0">
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...motionTransition("slow", "outQuint"), delay: 0.08 }}
                className="text-2xl md:text-3xl font-bold text-white leading-tight"
              >
                {portfolio.headline || slug}
              </motion.h1>
              {displayBio && (
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...motionTransition("slow", "outQuint"), delay: 0.16 }}
                  className="mt-2 text-sm md:text-base text-slate-300 leading-relaxed max-w-xl"
                >
                  {displayBio}
                </motion.p>
              )}

              {/* Social links */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...motionTransition("slow", "outQuint"), delay: 0.24 }}
                className="flex flex-wrap items-center gap-3 mt-4"
              >
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
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">

        {/* Skills */}
        {portfolio.skills.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={motionTransition("slow", "outQuint")}
          >
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {portfolio.skills.map((skill, i) => (
                <motion.div
                  key={skill}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: durations.fast, ease: easings.easeOut, delay: Math.min(i * 0.02, 0.3) }}
                >
                  <Badge
                    className="rounded-xl px-3 py-1.5 text-xs font-medium border"
                    style={{
                      background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                      color: "var(--accent-bright)",
                      borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)",
                    }}
                  >
                    {skill}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Certifications */}
        {portfolio.certifications.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={motionTransition("slow", "outQuint")}
          >
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Certifications</h2>
            <div className="flex flex-wrap gap-2">
              {portfolio.certifications.map((cert, i) => (
                <motion.div
                  key={cert}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: durations.fast, ease: easings.easeOut, delay: Math.min(i * 0.02, 0.3) }}
                >
                  <Badge
                    className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium border"
                    style={{ background: "var(--bg-card)", color: "var(--accent-bright)", borderColor: "var(--border)" }}
                  >
                    <Award className="w-3 h-3" /> {cert}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Featured Projects */}
        {featured.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={motionTransition("slow", "outQuint")}
          >
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Featured Projects
            </h2>
            <div className="grid md:grid-cols-2 gap-5">
              {featured.map((proj, i) => (
                <ProjectCard key={proj.id} proj={proj} featured index={i} />
              ))}
            </div>
          </motion.section>
        )}

        {/* Other Projects */}
        {others.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={motionTransition("slow", "outQuint")}
          >
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Other Projects
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {others.map((proj, i) => (
                <ProjectCard key={proj.id} proj={proj} index={i} />
              ))}
            </div>
          </motion.section>
        )}

        {/* Empty state */}
        {portfolio.projects.length === 0 && (
          <EmptyState
            icon={BookOpen}
            title="No projects added yet"
            description="This portfolio doesn't have any public projects yet."
            bordered={false}
            size="lg"
          />
        )}

        {/* Footer */}
        <footer className="text-center pt-6 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex justify-center">
            <DataFreshness variant="live" source="this candidate's public portfolio record" timestamp={loadedAt} />
          </div>
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
  proj, featured = false, index = 0,
}: {
  proj: PublicPortfolio["projects"][number];
  featured?: boolean;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: durations.slow, ease: easings.outQuint, delay: Math.min(index * 0.06, 0.3) }}
      whileHover={{ y: -3 }}
    >
      <Card
        className="overflow-hidden p-0 gap-0 rounded-2xl transition-shadow"
        style={{
          border: featured ? "1px solid var(--border-hover)" : "1px solid var(--border)",
          boxShadow: featured ? "0 4px 20px -6px var(--glow-accent)" : "none",
        }}
      >
        {proj.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={proj.image_url} alt={proj.title} className="w-full h-36 object-cover" />
        )}
        <CardContent className="p-4">
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
                <Badge key={tech} className="rounded px-1.5 py-0.5 text-[10px] font-normal border-transparent"
                  style={{ background: "var(--border)", color: "#94a3b8" }}>
                  {tech}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            {proj.demo_url && (
              <Button asChild className="btn-primary h-auto px-2.5 py-1 text-[11px] gap-1">
                <a href={proj.demo_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3 h-3" /> Live Demo
                </a>
              </Button>
            )}
            {proj.github_url && (
              <Button asChild className="btn-secondary h-auto px-2.5 py-1 text-[11px] gap-1">
                <a href={proj.github_url} target="_blank" rel="noopener noreferrer">
                  <Github className="w-3 h-3" /> Code
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
