import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        brand: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        surface: {
          DEFAULT: "#0f172a",
          card: "#1e293b",
          elevated: "#263348",
          border: "#334155",
        },
        accent: {
          cyan:   "#06b6d4",
          green:  "#10b981",
          amber:  "#f59e0b",
          rose:   "#f43f5e",
          purple: "#a855f7",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn:   { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp:  { from: { opacity: "0", transform: "translateY(16px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        shimmer:  { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      boxShadow: {
        glow:     "0 0 20px -5px rgba(99, 102, 241, 0.5)",
        "glow-sm":"0 0 10px -3px rgba(99, 102, 241, 0.4)",
        card:     "0 4px 24px -2px rgba(0,0,0,0.4)",
      },
      backgroundImage: {
        "gradient-radial":  "radial-gradient(var(--tw-gradient-stops))",
        "mesh-gradient":    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
