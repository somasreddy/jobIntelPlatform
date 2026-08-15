export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: [string, string, string];
}

export const THEMES: Theme[] = [
  {
    id: "executive",
    name: "Executive",
    description: "Balanced dark interface for daily work",
    colors: ["#7c8cff", "#22d3ee", "#080b14"],
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Neutral low-glare workspace",
    colors: ["#a3aab8", "#6ee7b7", "#090a0c"],
  },
  {
    id: "pacific",
    name: "Pacific",
    description: "Calm blue analytics surface",
    colors: ["#38bdf8", "#5eead4", "#07111f"],
  },
  {
    id: "ember",
    name: "Ember",
    description: "Warm focused command mode",
    colors: ["#f5b85b", "#fb7185", "#100c08"],
  },
  {
    id: "light",
    name: "Daylight",
    description: "Clean light workspace, indigo accents",
    colors: ["#4f46e5", "#0e7490", "#f4f5fa"],
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    description: "Maximum-contrast palette for accessibility",
    colors: ["#1d4ed8", "#facc15", "#000000"],
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Emerald glow with northern-lights bands",
    colors: ["#10b981", "#14b8a6", "#051a0e"],
  },
  {
    id: "ocean",
    name: "Ocean Depth",
    description: "Deep-sea blues with bioluminescent glow",
    colors: ["#3b82f6", "#06b6d4", "#031524"],
  },
  {
    id: "violet-storm",
    name: "Violet Storm",
    description: "Cosmic purple with electric lightning",
    colors: ["#8b5cf6", "#c084fc", "#0e0028"],
  },
];

export const DEFAULT_THEME = "executive";
export const THEME_IDS = THEMES.map((theme) => theme.id);

export function normalizeTheme(id?: string | null) {
  return id && THEME_IDS.includes(id) ? id : DEFAULT_THEME;
}
