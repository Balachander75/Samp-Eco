/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core Semantic Surfaces (Luminous Hierarchy)
        surface: {
          DEFAULT: "var(--surface-base)",
          base: "var(--surface-base)",
          lowest: "var(--surface-lowest)",
          low: "var(--surface-low)",
          container: "var(--surface-container)",
          high: "var(--surface-high)",
          highest: "var(--surface-highest)",
        },
        // Typography & On-Surface Contrast
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
        // Semantic Theme Borders
        border: {
          DEFAULT: "var(--border-subtle)",
          subtle: "var(--border-subtle)",
          strong: "var(--border-strong)",
          focus: "var(--border-focus)",
        },
        // Dynamic accents for the eight supported light themes
        accent: {
          DEFAULT: "var(--accent-primary)",
          primary: "var(--accent-primary)",
          hover: "var(--accent-primary-hover)",
          strong: "var(--accent-primary-strong)",
          subtle: "var(--accent-primary-subtle)",
          fillEnd: "var(--accent-primary-fill-end)",
          secondary: "var(--accent-teal)",
          secondaryStrong: "var(--accent-teal-strong)",
          secondaryHover: "var(--accent-teal-hover)",
          secondarySubtle: "var(--accent-teal-subtle)",
        },
        status: {
          success: {
            DEFAULT: "var(--status-success)",
            soft: "var(--status-success-soft)",
            border: "var(--status-success-border)",
            strong: "var(--status-success-strong)",
          },
          warning: {
            DEFAULT: "var(--status-warning)",
            soft: "var(--status-warning-soft)",
            border: "var(--status-warning-border)",
            strong: "var(--status-warning-strong)",
          },
          danger: {
            DEFAULT: "var(--status-danger)",
            soft: "var(--status-danger-soft)",
            border: "var(--status-danger-border)",
            strong: "var(--status-danger-strong)",
          },
          info: {
            DEFAULT: "var(--status-info)",
            soft: "var(--status-info-soft)",
            border: "var(--status-info-border)",
            strong: "var(--status-info-strong)",
          },
          purple: {
            DEFAULT: "var(--status-purple)",
            soft: "var(--status-purple-soft)",
            border: "var(--status-purple-border)",
            strong: "var(--status-purple-strong)",
          },
          neutral: {
            DEFAULT: "var(--status-neutral)",
            soft: "var(--status-neutral-soft)",
            border: "var(--status-neutral-border)",
            strong: "var(--status-neutral-strong)",
          },
        },
        // Navigation & Sidebar Semantic Surfaces
        sidebar: {
          surface: "var(--sidebar-surface)",
          raised: "var(--sidebar-surface-raised)",
          accent: "var(--sidebar-accent)",
          accentSubtle: "var(--sidebar-accent-subtle)",
          text: "var(--sidebar-text)",
          textMuted: "var(--sidebar-text-muted)",
          textSubtle: "var(--sidebar-text-subtle)",
        },
        // App Canvas & Sheet Level
        app: {
          DEFAULT: "var(--bg-app)",
          bg: "var(--bg-app)",
          panel: "var(--bg-panel)",
          subtle: "var(--bg-subtle)",
          muted: "var(--bg-muted)",
        },
        // High-Performance Flow Accents: Energy & Water
        luminous: {
          green: "rgb(var(--accent-primary-rgb) / <alpha-value>)",
          greenStrong: "rgb(var(--accent-primary-strong-rgb) / <alpha-value>)",
          blue: "rgb(var(--accent-teal-rgb) / <alpha-value>)",
          blueStrong: "var(--accent-teal-strong)",
          outline: "rgb(var(--accent-primary-rgb) / 0.25)",
        },
        'luminous-green': "rgb(var(--accent-primary-rgb) / <alpha-value>)",
        'luminous-green-strong': "rgb(var(--accent-primary-strong-rgb) / <alpha-value>)",
        'luminous-blue': "rgb(var(--accent-teal-rgb) / <alpha-value>)",
        'luminous-blue-strong': "var(--accent-teal-strong)",
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
        'ambient': '0 20px 40px -15px rgb(var(--shadow-ink) / 0.06)',
        'ambient-float': '0 30px 60px -12px rgb(var(--shadow-ink) / 0.10)',
        'glow-green': '0 0 25px -4px rgb(var(--accent-primary-rgb) / 0.4)',
        'glow-blue': '0 0 25px -4px rgb(var(--accent-teal-rgb) / 0.4)',
        'subtle-1': '0 1px 2px 0 rgb(var(--shadow-ink) / 0.05)',
        'subtle-2': '0 1px 3px 0 rgb(var(--shadow-ink) / 0.10), 0 1px 2px -1px rgb(var(--shadow-ink) / 0.10)',
        'panel': '0 4px 6px -1px rgb(var(--shadow-ink) / 0.10), 0 2px 4px -2px rgb(var(--shadow-ink) / 0.10)',
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
