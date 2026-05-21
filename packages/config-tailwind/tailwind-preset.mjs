/**
 * Tailwind preset: colours, typography, and spacing primitives for encyclopedia UI.
 *
 * Apps: `{ presets: [await import('@knitting/config-tailwind/preset').then((m) => m.default)], ... }`
 * or compile-time `import knittingPreset from '@knitting/config-tailwind/preset'`.
 *
 * @typedef {import('tailwindcss').Config & { theme?: Record<string, unknown> }} TailwindPreset
 */

/** Tailwind `@theme`/extend-friendly colour scale */
export const colors = {
  ink: {
    DEFAULT: "#1a1410",
    muted: "#5c534b",
    subtle: "#8a837b",
  },
  paper: {
    DEFAULT: "#faf7f2",
    deep: "#f0ebe3",
  },
  accent: {
    DEFAULT: "#2d6a4f",
    soft: "#95d5b2",
    dark: "#1b4332",
  },
  wool: "#c4a574",
  error: "#b42318",
  warning: "#b45309",
};

export const fontFamily = {
  sans: ["var(--font-geist-sans,var(--font-sans-fallback))", "system-ui", "sans-serif"],
  serif: ["var(--font-source-serif,var(--font-serif-fallback))", "Georgia", "serif"],
  mono: ["var(--font-mono,var(--font-mono-fallback))", "monospace"],
};

export const fontSize = {
  "display-xl": ["2.5rem", { lineHeight: "1.1", fontWeight: "600" }],
  "display-lg": ["2rem", { lineHeight: "1.15", fontWeight: "600" }],
  lg: ["1.125rem", { lineHeight: "1.6" }],
  base: ["1rem", { lineHeight: "1.6" }],
  sm: ["0.875rem", { lineHeight: "1.5" }],
  xs: ["0.75rem", { lineHeight: "1.45" }],
};

/** Named spacing aliases (additive; avoids shadowing Tailwind’s numeric scale) */
export const spacing = {
  gutter: "1.25rem",
  "section-y": "2.5rem",
  "card-radius": "0.65rem",
};

/** @type {TailwindPreset} */
const preset = {
  theme: {
    extend: {
      colors,
      fontFamily,
      fontSize,
      spacing,
      borderRadius: {
        card: "0.65rem",
      },
    },
  },
};

export default preset;
