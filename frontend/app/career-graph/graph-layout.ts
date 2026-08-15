/**
 * Pure layout builder for the Career Graph visualization.
 *
 * The node/edge model here is not an invented generic graph — it mirrors the
 * real relationships in backend/models/database.py:
 *
 *   - CareerSkill.graph_id, CareerGoal.graph_id, CareerMilestone.graph_id all
 *     point back at CareerGraph.id — i.e. the schema is genuinely a
 *     hub-and-spoke graph with one CareerGraph per user and skills/goals/
 *     milestones as its real, FK-linked children. That hub is rendered as
 *     the center node here.
 *   - CareerSkill.category is a real field — skills are grouped under a
 *     category node per distinct category (nulls bucketed as "General").
 *   - CareerSkill.level / verified / trending_score / last_used_year are
 *     real fields, reflected as node size / border / tooltip content.
 *   - CareerMilestone.milestone_date is a real field — milestones are
 *     chained in chronological order to represent career progression over
 *     time (undated milestones are appended at the end since their true
 *     position is unknown — never guessed).
 *   - CareerGoal fields (target_role/location/salary/timeline/work_mode) are
 *     rendered verbatim in the goal node's tooltip — nothing synthesized.
 *
 * No geographic, numeric, or categorical data is fabricated anywhere below.
 */
import type { CareerGoal, CareerMilestone, CareerSkill } from "./types";

export type GraphNodeKind = "hub" | "category" | "skill" | "goal" | "milestone";

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  x: number;
  y: number;
  r: number;
  label: string;
  centerText?: string;
  glyph?: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  dashed?: boolean;
  tooltip: string;
}

export interface GraphEdge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  size: number;
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

export function healthColor(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 60) return "#06b6d4";
  if (score >= 40) return "#f59e0b";
  return "#f43f5e";
}

const SKILL_LEVEL_LABELS = ["", "Beginner", "Novice", "Intermediate", "Advanced", "Expert"];

const MILESTONE_GLYPH: Record<string, string> = {
  job_change: "JC",
  promotion: "PR",
  cert: "CT",
  project: "PJ",
  education: "ED",
};

const R_CAT = 108;
const R_SKILL = 190;
const R_GOAL = 132;
const R_MILE_START = 140;
const R_MILE_STEP = 50;

export function buildCareerGraphLayout(params: {
  skills: CareerSkill[];
  goals: CareerGoal[];
  milestones: CareerMilestone[];
  healthScore: number;
}): GraphLayout {
  const { skills, goals, milestones, healthScore } = params;

  // Group skills by their real `category` field (null -> "General" bucket).
  const catOrder: string[] = [];
  const catMap = new Map<string, CareerSkill[]>();
  for (const sk of skills) {
    const key = (sk.category || "").trim() || "General";
    if (!catMap.has(key)) {
      catMap.set(key, []);
      catOrder.push(key);
    }
    catMap.get(key)!.push(sk);
  }

  const activeGoal = goals.find((g) => g.is_active) ?? goals[0] ?? null;

  // Chronological order = real progression signal (milestone_date). Undated
  // items are appended last rather than guessed at.
  const sortedMilestones = [...milestones].sort((a, b) => {
    if (!a.milestone_date && !b.milestone_date) return 0;
    if (!a.milestone_date) return 1;
    if (!b.milestone_date) return -1;
    return a.milestone_date.localeCompare(b.milestone_date);
  });

  type Slot =
    | { type: "category"; name: string; skills: CareerSkill[] }
    | { type: "goal"; goal: CareerGoal }
    | { type: "milestones"; items: CareerMilestone[] };

  const slots: Slot[] = [
    ...catOrder.map((name) => ({ type: "category" as const, name, skills: catMap.get(name)! })),
    ...(activeGoal ? [{ type: "goal" as const, goal: activeGoal }] : []),
    ...(sortedMilestones.length ? [{ type: "milestones" as const, items: sortedMilestones }] : []),
  ];

  // Size the canvas to fit the real volume of data — never capped/hidden,
  // just given enough room so nothing clips off the viewBox.
  const maxSkillsInCat = catOrder.length ? Math.max(...catOrder.map((n) => catMap.get(n)!.length)) : 0;
  const skillReach = R_SKILL + (maxSkillsInCat > 5 ? (maxSkillsInCat - 5) * 8 : 0) + 30;
  const milestoneReach = sortedMilestones.length
    ? R_MILE_START + (sortedMilestones.length - 1) * R_MILE_STEP + 30
    : 0;
  const goalReach = activeGoal ? R_GOAL + 34 : 0;
  const maxR = Math.max(skillReach, milestoneReach, goalReach, 190);
  const size = Math.round(maxR * 2);
  const cx = maxR;
  const cy = maxR;

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const hubColor = healthColor(healthScore);
  nodes.push({
    id: "hub",
    kind: "hub",
    x: cx,
    y: cy,
    r: 36,
    label: "Career Graph",
    centerText: `${healthScore}`,
    fill: hubColor,
    stroke: "rgba(255,255,255,0.4)",
    strokeWidth: 2,
    tooltip: `Career Graph — health score ${healthScore}/100`,
  });

  const slotCount = slots.length || 1;
  const anglePer = 360 / slotCount;

  slots.forEach((slot, i) => {
    const center = i * anglePer + anglePer / 2;

    if (slot.type === "category") {
      const catPos = polar(cx, cy, R_CAT, center);
      const catId = `cat-${slot.name}`;
      nodes.push({
        id: catId,
        kind: "category",
        x: catPos.x,
        y: catPos.y,
        r: 22,
        label: slot.name,
        fill: "var(--bg-elevated)",
        stroke: "var(--accent)",
        strokeWidth: 1.5,
        tooltip: `${slot.name} — ${slot.skills.length} skill${slot.skills.length === 1 ? "" : "s"}`,
      });
      edges.push({
        id: `e-hub-${catId}`,
        x1: cx,
        y1: cy,
        x2: catPos.x,
        y2: catPos.y,
        stroke: "var(--border-hover)",
        strokeWidth: 2,
      });

      const count = slot.skills.length;
      const half = anglePer * 0.44;
      const reach = R_SKILL + (count > 5 ? (count - 5) * 8 : 0);
      slot.skills.forEach((sk, j) => {
        const skillAngle = count === 1 ? center : center - half + (half * 2 * j) / (count - 1);
        const pos = polar(cx, cy, reach, skillAngle);
        const level = Math.min(5, Math.max(1, sk.level || 1));
        const opacityPct = 22 + level * 14;
        const skillId = `skill-${sk.id}`;
        const bits = [
          SKILL_LEVEL_LABELS[level],
          sk.verified ? "verified" : null,
          sk.last_used_year ? `used ${sk.last_used_year}` : null,
        ].filter(Boolean);
        nodes.push({
          id: skillId,
          kind: "skill",
          x: pos.x,
          y: pos.y,
          r: 9 + level * 2,
          label: sk.skill_name,
          fill: `color-mix(in srgb, var(--accent) ${opacityPct}%, var(--bg-elevated))`,
          stroke: sk.verified ? "var(--accent-bright)" : "var(--border)",
          strokeWidth: sk.verified ? 2.5 : 1,
          tooltip: `${sk.skill_name} — ${bits.join(" · ")}`,
        });
        edges.push({
          id: `e-${catId}-${skillId}`,
          x1: catPos.x,
          y1: catPos.y,
          x2: pos.x,
          y2: pos.y,
          stroke: "var(--border)",
          strokeWidth: 1.25,
        });
      });
    }

    if (slot.type === "goal") {
      const pos = polar(cx, cy, R_GOAL, center);
      const g = slot.goal;
      const salary =
        g.target_salary_min || g.target_salary_max
          ? `$${g.target_salary_min ?? "?"}–$${g.target_salary_max ?? "?"}`
          : null;
      nodes.push({
        id: "goal",
        kind: "goal",
        x: pos.x,
        y: pos.y,
        r: 26,
        label: g.target_role || "Career Goal",
        fill: "var(--accent)",
        stroke: "#fff",
        strokeWidth: 1.5,
        dashed: true,
        tooltip: [
          g.target_role ? `Target: ${g.target_role}` : "Target role not set",
          g.target_location || null,
          salary,
          g.timeline_months ? `${g.timeline_months} mo timeline` : null,
          g.work_mode || null,
        ]
          .filter(Boolean)
          .join(" · "),
      });
      edges.push({
        id: "e-hub-goal",
        x1: cx,
        y1: cy,
        x2: pos.x,
        y2: pos.y,
        stroke: "var(--accent)",
        strokeWidth: 2,
      });
    }

    if (slot.type === "milestones") {
      let prevX = cx;
      let prevY = cy;
      let prevId = "hub";
      slot.items.forEach((m, idx) => {
        const r = R_MILE_START + idx * R_MILE_STEP;
        const pos = polar(cx, cy, r, center);
        const mId = `milestone-${m.id}`;
        nodes.push({
          id: mId,
          kind: "milestone",
          x: pos.x,
          y: pos.y,
          r: 15,
          label: m.title,
          glyph: MILESTONE_GLYPH[m.type] || "•",
          fill: "var(--accent-bright)",
          stroke: "rgba(255,255,255,0.45)",
          strokeWidth: 1.5,
          tooltip: [m.title, m.company || null, m.milestone_date || "date unknown", m.impact_statement || null]
            .filter(Boolean)
            .join(" · "),
        });
        edges.push({
          id: `e-${prevId}-${mId}`,
          x1: prevX,
          y1: prevY,
          x2: pos.x,
          y2: pos.y,
          stroke: "var(--accent-bright)",
          strokeWidth: 2,
        });
        prevX = pos.x;
        prevY = pos.y;
        prevId = mId;
      });
    }
  });

  return { nodes, edges, size };
}
