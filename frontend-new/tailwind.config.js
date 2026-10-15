/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Luminous Engine Surface Hierarchy (The "No-Line" Rule Foundation)
        surface: {
          DEFAULT: "var(--surface-base)",
          lowest: "var(--surface-lowest)",
          low: "var(--surface-low)",
          container: "var(--surface-container)",
          high: "var(--surface-high)",
          highest: "var(--surface-highest)",
        },
        onSurface: {
          DEFAULT: "var(--on-surface)",
          muted: "var(--on-surface-muted)",
          subtle: "var(--on-surface-subtle)",
        },
        'on-surface': {
          DEFAULT: "var(--on-surface)",
          muted: "var(--on-surface-muted)",
          subtle: "var(--on-surface-subtle)",
        },
        // High-Performance Flow Accents: Energy & Water
        luminous: {
          green: "rgb(var(--accent-primary-rgb) / <alpha-value>)",
          greenDark: "rgb(var(--accent-primary-strong-rgb) / <alpha-value>)",
          blue: "#0070ff",
          blueDark: "#004bb5",
          outline: "rgba(187, 203, 185, 0.25)",
        },
        'luminous-green': "rgb(var(--accent-primary-rgb) / <alpha-value>)",
        'luminous-green-dark': "rgb(var(--accent-primary-strong-rgb) / <alpha-value>)",
        'luminous-blue': "#0070ff",
        'luminous-blue-dark': "#004bb5",
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#0070ff",
          600: "#005ed9",
          700: "#004bb5",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#0b1c30",
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['"Space Grotesk"', '"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Geist Mono"', 'monospace'],
      },
      boxShadow: {
        'ambient': '0 20px 40px -15px rgba(11, 28, 48, 0.05)',
        'ambient-float': '0 30px 60px -12px rgba(11, 28, 48, 0.08)',
        'glow-green': '0 0 25px -4px rgba(0, 209, 102, 0.4)',
        'glow-blue': '0 0 25px -4px rgba(0, 112, 255, 0.4)',
        'subtle-1': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'subtle-2': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'panel': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
      },
      borderRadius: {
        'xs': '3px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
        '3xl': '28px',
      },
    },
  },
  plugins: [],
};
