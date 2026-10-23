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
  | "terracotta";

export interface AppTheme {
  id: ThemeId;
  name: string;
  description: string;
  mode: "light";
  vibe: string;
  badge?: string;
  category: "all" | "enterprise" | "creative" | "minimal";
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
      canvas: "#edf5f1",
      sidebar: "#d8eadf",
      surface: "#ffffff",
      accent: "#059669",
      accentSoft: "#d1fae5",
      accentSecondary: "#2563eb",
      accentTertiary: "#d97706",
      text: "#0e291e",
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
      canvas: "#eaf2fb",
      sidebar: "#cee1f7",
      surface: "#ffffff",
      accent: "#2563eb",
      accentSoft: "#dbeafe",
      accentSecondary: "#06b6d4",
      accentTertiary: "#eab308",
      text: "#0a1b33",
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
      canvas: "#f4eefa",
      sidebar: "#e5d5f8",
      surface: "#ffffff",
      accent: "#7c3aed",
      accentSoft: "#ede9fe",
      accentSecondary: "#db2777",
      accentTertiary: "#f59e0b",
      text: "#1d0f36",
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
      canvas: "#f8f2e6",
      sidebar: "#ebd6b5",
      surface: "#ffffff",
      accent: "#b45309",
      accentSoft: "#fef3c7",
      accentSecondary: "#ea580c",
      accentTertiary: "#0284c7",
      text: "#291c10",
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
      canvas: "#fcf0f3",
      sidebar: "#f7d2dc",
      surface: "#ffffff",
      accent: "#e11d48",
      accentSoft: "#ffe4e6",
      accentSecondary: "#6366f1",
      accentTertiary: "#d97706",
      text: "#30111a",
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
      canvas: "#f4f3ea",
      sidebar: "#ded8b8",
      surface: "#ffffff",
      accent: "#ca8a04",
      accentSoft: "#fef08a",
      accentSecondary: "#09090b",
      accentTertiary: "#ef4444",
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
      canvas: "#eaf3f9",
      sidebar: "#c7e3f8",
      surface: "#ffffff",
      accent: "#0284c7",
      accentSoft: "#e0f2fe",
      accentSecondary: "#0d9488",
      accentTertiary: "#f59e0b",
      text: "#07192d",
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
      canvas: "#f8eee1",
      sidebar: "#f2ceb0",
      surface: "#ffffff",
      accent: "#ea580c",
      accentSoft: "#ffedd5",
      accentSecondary: "#65a30d",
      accentTertiary: "#0284c7",
      text: "#2c160a",
      border: "#dfd2c0"
    }
  }
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
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
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

    // Trigger smooth micro-transition on deliberate theme switch
    if (typeof document !== "undefined") {
      document.documentElement.classList.add("theme-transitioning");
      window.setTimeout(() => {
        document.documentElement.classList.remove("theme-transitioning");
      }, 220);
    }

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
