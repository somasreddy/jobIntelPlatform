"use client";

import { useEffect, useMemo, useRef } from "react";
import { createDrawable, createTimeline, stagger } from "animejs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { buildCareerGraphLayout, type GraphNode } from "./graph-layout";
import type { CareerGoal, CareerMilestone, CareerSkill } from "./types";

interface CareerSkillGraphProps {
  skills: CareerSkill[];
  goals: CareerGoal[];
  milestones: CareerMilestone[];
  healthScore: number;
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/**
 * Renders the real Career Graph data model (hub = the user's CareerGraph
 * row, spokes = its FK-linked CareerSkill/CareerGoal/CareerMilestone rows)
 * as an SVG node/edge diagram, then drives an Anime.js v4 timeline against
 * the DOM nodes React just rendered: edges "draw in" (line-drawing effect
 * via the `svg.createDrawable` + `draw` property) and nodes fade/scale in
 * with a stagger. Anime runs alongside React — it never owns state, only
 * animates the DOM refs after mount — and the timeline is reverted on
 * unmount / whenever the underlying graph data changes shape.
 */
export default function CareerSkillGraph({ skills, goals, milestones, healthScore }: CareerSkillGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const layout = useMemo(
    () => buildCareerGraphLayout({ skills, goals, milestones, healthScore }),
    [skills, goals, milestones, healthScore]
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const edgeEls = Array.from(svg.querySelectorAll<SVGLineElement>(".cg-edge"));
    const nodeEls = Array.from(svg.querySelectorAll<SVGGElement>(".cg-node"));
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      // Respect prefers-reduced-motion: skip the entrance animation and jump
      // straight to the fully-drawn end state.
      edgeEls.forEach((el) => {
        el.style.opacity = "1";
      });
      nodeEls.forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "scale(1)";
      });
      return;
    }

    const drawableEdges = createDrawable(edgeEls);
    const timeline = createTimeline({ defaults: { ease: "outCubic" } });

    timeline
      .add(drawableEdges, {
        draw: ["0 0", "0 1"],
        opacity: [0, 1],
        duration: 650,
        delay: stagger(55),
      })
      .add(
        nodeEls,
        {
          opacity: [0, 1],
          scale: [0.5, 1],
          duration: 480,
          delay: stagger(28),
        },
        "-=500"
      );

    return () => {
      timeline.revert();
    };
  }, [layout]);

  const { nodes, edges, size } = layout;
  const displaySize = Math.min(size, 520);

  return (
    <div className="space-y-3">
      <div className="w-full overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${size} ${size}`}
          width="100%"
          height={displaySize}
          style={{ maxWidth: size, display: "block", margin: "0 auto" }}
        >
          {edges.map((e) => (
            <line
              key={e.id}
              className="cg-edge"
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              strokeLinecap="round"
              style={{ stroke: e.stroke, strokeWidth: e.strokeWidth, opacity: 0 }}
            />
          ))}
          {nodes.map((node) => (
            <NodeGroup key={node.id} node={node} />
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500">
        <LegendItem swatch="var(--accent)" label="Career health hub" />
        <LegendItem swatch="var(--bg-elevated)" ring="var(--accent)" label="Skill category" />
        <LegendItem swatch="color-mix(in srgb, var(--accent) 65%, var(--bg-elevated))" ring="var(--accent-bright)" label="Skill (size = level)" />
        <LegendItem swatch="var(--accent)" ring="#fff" dashed label="Career goal" />
        <LegendItem swatch="var(--accent-bright)" label="Milestone (chronological)" />
      </div>
    </div>
  );
}

function LegendItem({ swatch, ring, dashed, label }: { swatch: string; ring?: string; dashed?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
        style={{
          background: swatch,
          border: ring ? `1.5px ${dashed ? "dashed" : "solid"} ${ring}` : undefined,
        }}
      />
      {label}
    </span>
  );
}

function NodeGroup({ node }: { node: GraphNode }) {
  const isHub = node.kind === "hub";
  const labelSize = node.kind === "category" || node.kind === "goal" ? 11 : 9.5;
  const labelWeight = node.kind === "category" || node.kind === "goal" ? 700 : 500;
  const labelMax = node.kind === "skill" || node.kind === "milestone" ? 14 : 18;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <g className="cg-node" style={{ opacity: 0, transformOrigin: `${node.x}px ${node.y}px`, transformBox: "view-box" }} tabIndex={0}>
          <circle
            cx={node.x}
            cy={node.y}
            r={node.r}
            style={{
              fill: node.fill,
              stroke: node.stroke,
              strokeWidth: node.strokeWidth,
              strokeDasharray: node.dashed ? "5 4" : undefined,
            }}
          />
          {isHub && (
            <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize={15} fontWeight={800} fill="#fff">
              {node.centerText}
            </text>
          )}
          {node.glyph && (
            <text x={node.x} y={node.y + 3} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff">
              {node.glyph}
            </text>
          )}
          <text
            x={node.x}
            y={node.y + node.r + 13}
            textAnchor="middle"
            fontSize={labelSize}
            fontWeight={labelWeight}
            style={{ fill: "var(--text-secondary)" }}
          >
            {truncate(node.label, labelMax)}
          </text>
        </g>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-center">
        {node.tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
