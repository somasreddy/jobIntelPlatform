"use client";

import { FunnelChart, Funnel, LabelList, Tooltip, Cell, ResponsiveContainer } from "recharts";
import type { Application, ApplicationStatus } from "@/lib/types";

// Real pipeline stages, in the same order the Kanban board uses them.
// Colors are wired to the app's theme accent scale (CSS custom properties)
// rather than hardcoded hex so the chart stays consistent across themes.
const STAGES: { id: ApplicationStatus; label: string; color: string }[] = [
  { id: "Saved",      label: "Saved",      color: "var(--text-muted)" },
  { id: "Applied",    label: "Applied",    color: "var(--accent-deep)" },
  { id: "Assessment", label: "Assessment", color: "var(--accent-dark)" },
  { id: "Interview",  label: "Interview",  color: "var(--accent)" },
  { id: "Offer",      label: "Offer",      color: "var(--accent-bright)" },
  { id: "Rejected",   label: "Rejected",   color: "var(--accent-secondary)" },
];

interface ApplicationsFunnelChartProps {
  applications: Application[];
  height?: number;
}

export default function ApplicationsFunnelChart({ applications, height = 132 }: ApplicationsFunnelChartProps) {
  const total = applications.length;

  const data = STAGES.map(stage => {
    const count = applications.filter(a => a.status === stage.id).length;
    return {
      name: stage.label,
      status: stage.id,
      value: count,
      label: `${stage.label} · ${count}`,
      fill: stage.color,
    };
  });

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-slate-500 border border-dashed rounded-xl"
        style={{ height, borderColor: "var(--border)" }}
      >
        No applications yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <FunnelChart>
        <Tooltip
          formatter={(value, _name, item) => [
            `${value} application${value === 1 ? "" : "s"}`,
            item?.payload?.name ?? "",
          ]}
          contentStyle={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 11,
            color: "var(--text-primary)",
          }}
          itemStyle={{ color: "var(--text-primary)" }}
        />
        <Funnel dataKey="value" data={data} nameKey="name" isAnimationActive>
          <LabelList
            dataKey="label"
            position="center"
            stroke="none"
            fill="var(--text-primary)"
            fontSize={10}
            fontWeight={600}
          />
          {data.map(entry => (
            <Cell key={entry.status} fill={entry.fill} />
          ))}
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );
}
