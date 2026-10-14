import type { Config } from "tailwindcss";

// Every slate shade reads its color from a CSS variable (defined in app/globals.css).
// Light mode and dark mode just define different numbers for the same variables,
// so every existing bg-slate-* / text-slate-* / border-slate-* class adapts automatically.
const slate = (shade: string) => `rgb(var(--slate-${shade}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: {
          50: slate("50"),
          100: slate("100"),
          200: slate("200"),
          300: slate("300"),
          400: slate("400"),
          500: slate("500"),
          600: slate("600"),
          700: slate("700"),
          800: slate("800"),
          900: slate("900"),
          950: slate("950"),
        },
      },
    },
  },
  plugins: [],
};

export default config;
