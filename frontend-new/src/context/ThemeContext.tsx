import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { readAuthUser, updateStoredAuthUser } from "@/lib/session";
import { getThemePreferenceApi, updateThemePreferenceApi } from "@/infrastructure/api/userPreferencesApi";

export type ThemeId =
  | "emerald"
  | "ocean"
  | "violet"
  | "amber"
  | "rose"
  | "neo-brutalism"
  | "nordic-frost"
  | "terracotta"
  | "midnight"
  | "forest-night"
  | "nocturne"
  | "tokyo-neon"
  | "titanium";

export interface AppTheme {
  id: ThemeId;
  name: string;
  description: string;
  mode: "light" | "dark";
  vibe: string;
  badge?: string;
  category: "all" | "enterprise" | "creative" | "dark_oled" | "minimal";
  preview: {
    canvas: string;
    sidebar: string;
    surface: string;
    accent: string;
    accentSoft: string;
    accentSecondary: string;
    accentTertiary: string;
    text: string;
    border: string;
  };
}

export const APP_THEMES: AppTheme[] = [
  {
    id: "emerald",
    name: "Jade Atelier",
    description: "Deep alpine jade, warm ivory canvas, and champagne gold metallic notes.",
    mode: "light",
    vibe: "Executive Swiss",
    badge: "Recommended",
    category: "enterprise",
    preview: {
      canvas: "#f3f6f4",
      sidebar: "#e2ebe5",
      surface: "#ffffff",
      accent: "#107555",
      accentSoft: "#d1fae5",
      accentSecondary: "#2563eb",
      accentTertiary: "#c2944b",
      text: "#13251e",
      border: "#cbdad0"
    }
  },
  {
    id: "ocean",
    name: "Cobalt Office",
    description: "Royal cobalt, crisp glacial ice surfaces, and vivid cyan highlights.",
    mode: "light",
    vibe: "Corporate Navy",
    badge: "Popular",
    category: "enterprise",
    preview: {
      canvas: "#f0f5fa",
      sidebar: "#dce8f4",
      surface: "#ffffff",
      accent: "#2563eb",
      accentSoft: "#dbeafe",
      accentSecondary: "#06b6d4",
      accentTertiary: "#eab308",
      text: "#0f1e36",
      border: "#c6d8eb"
    }
  },
  {
    id: "violet",
    name: "Iris Paper",
    description: "Electric violet, luminous lilac canvas, and vivid magenta contrast.",
    mode: "light",
    vibe: "Linear Creative",
    badge: "Studio Choice",
    category: "creative",
    preview: {
      canvas: "#f5f2fa",
      sidebar: "#e8def5",
      surface: "#ffffff",
      accent: "#7c3aed",
      accentSoft: "#ede9fe",
      accentSecondary: "#db2777",
      accentTertiary: "#f59e0b",
      text: "#26143d",
      border: "#d8c8ee"
    }
  },
  {
    id: "amber",
    name: "Citrus & Ink",
    description: "Warm cashmere paper, espresso ink, and sunlit bronze highlights.",
    mode: "light",
    vibe: "Warm Editorial",
    category: "minimal",
    preview: {
      canvas: "#f8f6f0",
      sidebar: "#ede9dd",
      surface: "#ffffff",
      accent: "#b45309",
      accentSoft: "#fef3c7",
      accentSecondary: "#c2410c",
      accentTertiary: "#0284c7",
      text: "#2b2416",
      border: "#ded7c5"
    }
  },
  {
    id: "rose",
    name: "Coral Studio",
    description: "Architectural dusty coral, chalk porcelain, and navy accents.",
    mode: "light",
    vibe: "Modern Minimal",
    category: "creative",
    preview: {
      canvas: "#faf4f5",
      sidebar: "#f2e4e7",
      surface: "#ffffff",
      accent: "#e11d48",
      accentSoft: "#ffe4e6",
      accentSecondary: "#4f46e5",
      accentTertiary: "#d97706",
      text: "#33141b",
      border: "#e9d0d5"
    }
  },
  {
    id: "neo-brutalism",
    name: "Neo Brutalism",
    description: "Modernist ink outlines, cyber canary punch, and raw high-contrast clarity.",
    mode: "light",
    vibe: "High Contrast",
    badge: "Bold Impact",
    category: "minimal",
    preview: {
      canvas: "#faf9f5",
      sidebar: "#f3f0e6",
      surface: "#ffffff",
      accent: "#facc15",
      accentSoft: "#fef9c3",
      accentSecondary: "#ef4444",
      accentTertiary: "#2563eb",
      text: "#09090b",
      border: "#18181b"
    }
  },
  {
    id: "nordic-frost",
    name: "Nordic Frost",
    description: "Crisp polar sky, arctic porcelain, and deep marine ink precision.",
    mode: "light",
    vibe: "Glacial Clean",
    category: "enterprise",
    preview: {
      canvas: "#f1f6fa",
      sidebar: "#e0edf7",
      surface: "#ffffff",
      accent: "#0284c7",
      accentSoft: "#e0f2fe",
      accentSecondary: "#0d9488",
      accentTertiary: "#f59e0b",
      text: "#0a1c2e",
      border: "#c2daf0"
    }
  },
  {
    id: "terracotta",
    name: "Sahara Dune",
    description: "Sun-drenched Mediterranean clay, warm olive bronze, and terracotta.",
    mode: "light",
    vibe: "Warm Sandstone",
    category: "minimal",
    preview: {
      canvas: "#f8f4ee",
      sidebar: "#ece4d8",
      surface: "#ffffff",
      accent: "#ea580c",
      accentSoft: "#ffedd5",
      accentSecondary: "#65a30d",
      accentTertiary: "#0284c7",
      text: "#2d1c13",
      border: "#dfd2c0"
    }
  },
  {
    id: "midnight",
    name: "Obsidian Blue",
    description: "Deep cosmic slate, glowing periwinkle neon, and electric ice cyan.",
    mode: "dark",
    vibe: "Deep Space",
    badge: "OLED Dark",
    category: "dark_oled",
    preview: {
      canvas: "#0b0e17",
      sidebar: "#121624",
      surface: "#181e30",
      accent: "#818cf8",
      accentSoft: "#272942",
      accentSecondary: "#38bdf8",
      accentTertiary: "#f59e0b",
      text: "#f1f5f9",
      border: "#2e3650"
    }
  },
  {
    id: "forest-night",
    name: "Abyssal Teal",
    description: "Deep midnight evergreen, luminous mint highlights, and antique gold.",
    mode: "dark",
    vibe: "Nordic Night",
    category: "dark_oled",
    preview: {
      canvas: "#091211",
      sidebar: "#10201e",
      surface: "#162a27",
      accent: "#34d399",
      accentSoft: "#17332c",
      accentSecondary: "#fbbf24",
      accentTertiary: "#60a5fa",
      text: "#ecfdf5",
      border: "#274742"
    }
  },
  {
    id: "nocturne",
    name: "Orchid Afterdark",
    description: "Velvet black cherry, radiant electric lilac, and glowing turquoise.",
    mode: "dark",
    vibe: "Cyber Velvet",
    badge: "Vibrant Dark",
    category: "creative",
    preview: {
      canvas: "#120914",
      sidebar: "#1c1020",
      surface: "#27182c",
      accent: "#c084fc",
      accentSoft: "#331c3a",
      accentSecondary: "#2dd4bf",
      accentTertiary: "#f43f5e",
      text: "#faf5ff",
      border: "#43294c"
    }
  },
  {
    id: "tokyo-neon",
    name: "Tokyo Neon",
    description: "Deep pitch obsidian with electric neon cyan and hot magenta glow.",
    mode: "dark",
    vibe: "Tokyo Cyberpunk",
    badge: "High Tech",
    category: "dark_oled",
    preview: {
      canvas: "#06070a",
      sidebar: "#0c0e14",
      surface: "#121620",
      accent: "#00f0ff",
      accentSoft: "#09333d",
      accentSecondary: "#ff007a",
      accentTertiary: "#a855f7",
      text: "#f8fafc",
      border: "#1d273a"
    }
  },
  {
    id: "titanium",
    name: "Stealth Titanium",
    description: "Aerospace carbon graphite, brushed titanium metal, and sapphire crystal.",
    mode: "dark",
    vibe: "Aerospace Pro",
    badge: "Pro Stealth",
    category: "dark_oled",
    preview: {
      canvas: "#090a0d",
      sidebar: "#101117",
      surface: "#181a22",
      accent: "#3b82f6",
      accentSoft: "#182740",
      accentSecondary: "#94a3b8",
      accentTertiary: "#38bdf8",
      text: "#f8fafc",
      border: "#272a38"
    }
  },
];

const DEFAULT_THEME: ThemeId = "emerald";
const THEME_HINT_KEY = "erp_theme_id";
const isThemeId = (value: unknown): value is ThemeId => APP_THEMES.some((theme) => theme.id === value);

function readThemeHint(): ThemeId {
  try {
    const stored = localStorage.getItem(THEME_HINT_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function storeThemeHint(themeId: ThemeId): void {
  try {
    localStorage.setItem(THEME_HINT_KEY, themeId);
  } catch {
    // Theme still applies for this page if browser storage is unavailable.
  }
}

function cacheThemeOnSession(themeId: ThemeId): void {
  const storedUser = readAuthUser<Record<string, unknown>>();
  if (storedUser) updateStoredAuthUser({ ...storedUser, theme_id: themeId });
}

type ScrollPosition = { element: HTMLElement; top: number; left: number };

function captureWorkspaceScroll(): ScrollPosition[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".overflow-y-auto, .overflow-auto, [data-scroll-container]"))
    .filter((element) => element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1)
    .map((element) => ({ element, top: element.scrollTop, left: element.scrollLeft }));
}

function restoreWorkspaceScroll(positions: ScrollPosition[], isCurrent: () => boolean): void {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!isCurrent()) return;
    if (typeof window !== "undefined" && (window.scrollY !== 0 || window.scrollX !== 0)) {
      window.scrollTo(0, 0);
    }
    positions.forEach(({ element, top, left }) => {
      if (!element.isConnected) return;
      const previousBehavior = element.style.scrollBehavior;
      element.style.scrollBehavior = "auto";
      const maxTop = Math.max(0, element.scrollHeight - element.clientHeight);
      element.scrollTop = Math.min(top, maxTop);
      const maxLeft = Math.max(0, element.scrollWidth - element.clientWidth);
      element.scrollLeft = Math.min(left, maxLeft);
      element.style.scrollBehavior = previousBehavior;
    });
  }));
}

interface ThemeContextValue {
  theme: ThemeId;
  themes: AppTheme[];
  saveStatus: "idle" | "saving" | "saved" | "error";
  setTheme: (theme: ThemeId) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ userId?: number | string; initialTheme?: string; children: React.ReactNode }> = ({ userId, initialTheme, children }) => {
  const [theme, setThemeState] = useState<ThemeId>(() => (isThemeId(initialTheme) ? initialTheme : readThemeHint()));
  const [saveStatus, setSaveStatus] = useState<ThemeContextValue["saveStatus"]>("idle");
  const requestVersion = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const scrollRestoreVersion = useRef(0);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", APP_THEMES.find((option) => option.id === theme)?.mode === "dark");
    storeThemeHint(theme);
    if (typeof window !== "undefined" && (window.scrollY !== 0 || window.scrollX !== 0)) {
      window.scrollTo(0, 0);
    }
  }, [theme]);

  useEffect(() => {
    if (userId === undefined || userId === null) return;
    let cancelled = false;
    const versionAtStart = requestVersion.current;
    getThemePreferenceApi().then(({ theme_id }) => {
      if (cancelled || versionAtStart !== requestVersion.current || !isThemeId(theme_id)) return;
      setThemeState(theme_id);
      storeThemeHint(theme_id);
      cacheThemeOnSession(theme_id);
      setSaveStatus("saved");
    }).catch(() => {
      if (!cancelled && versionAtStart === requestVersion.current) setSaveStatus("error");
    });
    return () => { cancelled = true; };
  }, [userId]);

  const setTheme = useCallback((nextTheme: ThemeId): Promise<void> => {
    const scrollVersion = ++scrollRestoreVersion.current;
    const scrollPositions = captureWorkspaceScroll();
    setThemeState(nextTheme);
    storeThemeHint(nextTheme);
    if (typeof window !== "undefined" && (window.scrollY !== 0 || window.scrollX !== 0)) {
      window.scrollTo(0, 0);
    }
    restoreWorkspaceScroll(scrollPositions, () => scrollVersion === scrollRestoreVersion.current);
    if (userId === undefined || userId === null) return Promise.resolve();
    const version = ++requestVersion.current;
    setSaveStatus("saving");
    saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
      const response = await updateThemePreferenceApi(nextTheme);
      if (!isThemeId(response.theme_id)) throw new Error("Server returned an unsupported theme.");
      cacheThemeOnSession(response.theme_id);
      if (version === requestVersion.current) {
        setThemeState(response.theme_id);
        setSaveStatus("saved");
      }
    }).catch(() => {
      if (version === requestVersion.current) setSaveStatus("error");
    });
    return saveQueue.current;
  }, [userId]);

  const value = useMemo(() => ({ theme, themes: APP_THEMES, saveStatus, setTheme }), [theme, saveStatus, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
