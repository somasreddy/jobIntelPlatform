export interface Theme {
  id: string;
  name: string;
  emoji: string;
  colors: [string, string, string]; // preview swatches: accent, secondary, base
}

export const THEMES: Theme[] = [
  {
    id: "nebula",
    name: "Nebula",
    emoji: "🌌",
    colors: ["#6366f1", "#06b6d4", "#030711"],
  },
  {
    id: "aurora",
    name: "Aurora",
    emoji: "🌿",
    colors: ["#10b981", "#14b8a6", "#021008"],
  },
  {
    id: "solar",
    name: "Solar Flare",
    emoji: "☀️",
    colors: ["#f59e0b", "#f97316", "#100500"],
  },
  {
    id: "ocean",
    name: "Ocean Depth",
    emoji: "🌊",
    colors: ["#3b82f6", "#06b6d4", "#010d1a"],
  },
  {
    id: "rose-noir",
    name: "Rose Noir",
    emoji: "🌹",
    colors: ["#f43f5e", "#ec4899", "#0f0408"],
  },
  {
    id: "matrix",
    name: "Matrix",
    emoji: "💚",
    colors: ["#22c55e", "#4ade80", "#000800"],
  },
  {
    id: "midnight",
    name: "Midnight",
    emoji: "🌙",
    colors: ["#2563eb", "#818cf8", "#01020f"],
  },
  {
    id: "crimson",
    name: "Crimson",
    emoji: "🔴",
    colors: ["#ef4444", "#f43f5e", "#0f0002"],
  },
  {
    id: "cyber-gold",
    name: "Cyber Gold",
    emoji: "⚡",
    colors: ["#eab308", "#f97316", "#090700"],
  },
  {
    id: "glacier",
    name: "Glacier",
    emoji: "🧊",
    colors: ["#0ea5e9", "#67e8f9", "#010a14"],
  },
  {
    id: "violet-storm",
    name: "Violet Storm",
    emoji: "🔮",
    colors: ["#8b5cf6", "#c084fc", "#050012"],
  },
  {
    id: "neon-punk",
    name: "Neon Punk",
    emoji: "🎆",
    colors: ["#d946ef", "#4ade80", "#060010"],
  },
];

export const DEFAULT_THEME = "nebula";
