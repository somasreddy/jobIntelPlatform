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
];

export const DEFAULT_THEME = "executive";
export const THEME_IDS = THEMES.map((theme) => theme.id);

export function normalizeTheme(id?: string | null) {
  return id && THEME_IDS.includes(id) ? id : DEFAULT_THEME;
}
