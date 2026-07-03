import type { Config } from "tailwindcss";

/**
 * tailwind.config.ts — Independence Law Firm
 *
 * Brand tokens extracted from globals.css CSS variables.
 * This config mirrors the design system so every Tailwind utility
 * maps 1:1 to the firm's established palette.
 */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        /* ── Brand ───────────────────────────────────── */
        navy: {
          DEFAULT: "#1a2744",
          hover: "#2d3d6b",
          light: "#243256",
        },
        crimson: {
          DEFAULT: "#b31e3c",
          hover: "#921832",
          light: "#f9e8eb",
        },

        /* ── Neutrals ───────────────────────────────── */
        surface: "#ffffff",
        border: "#dde2ea",
        "border-focus": "#b31e3c",
        bg: {
          DEFAULT: "#f4f5f7",
          alt: "#eceef2",
        },

        /* ── Text ───────────────────────────────────── */
        "text-primary": "#1a1f2e",
        "text-secondary": "#4b5563",
        "text-muted": "#6b7280",
        "text-inverse": "#ffffff",

        /* ── Status ──────────────────────────────────── */
        success: {
          DEFAULT: "#0f7b55",
          bg: "#e6f7f2",
        },
        error: {
          DEFAULT: "#c0392b",
          bg: "#fdf0ee",
        },
        warning: {
          DEFAULT: "#d97706",
          bg: "#fef9ec",
        },
      },

      fontFamily: {
        serif: [
          "Merriweather",
          "Georgia",
          "'Times New Roman'",
          "serif",
        ],
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "sans-serif",
        ],
      },

      borderRadius: {
        sm: "3px",
        md: "6px",
        lg: "10px",
        xl: "16px",
      },

      boxShadow: {
        sm: "0 1px 3px rgba(0,0,0,0.08)",
        md: "0 4px 12px rgba(26,39,68,0.12)",
        lg: "0 8px 32px rgba(26,39,68,0.18)",
        xl: "0 16px 48px rgba(26,39,68,0.22)",
      },

      transitionDuration: {
        fast: "150ms",
        base: "250ms",
        slow: "400ms",
      },

      keyframes: {
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        stepEnter: {
          from: { opacity: "0", transform: "translateX(18px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        toastIn: {
          from: { opacity: "0", transform: "translateY(12px) scale(0.95)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },

      animation: {
        pulse: "pulse 2s ease-in-out infinite",
        "fade-in": "fadeInUp 0.5s ease both",
        "step-enter": "stepEnter 0.35s cubic-bezier(0.4,0,0.2,1) both",
        "toast-in": "toastIn 300ms ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
