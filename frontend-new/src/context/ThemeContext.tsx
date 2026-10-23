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
      canvas: "#f4f8f5",
      sidebar: "#e5efe8",
      surface: "#ffffff",
      accent: "#047857",
      accentSoft: "#d1fae5",
      accentSecondary: "#2563eb",
      accentTertiary: "#b45309",
      text: "#14251b",
      border: "rgba(20, 37, 27, 0.12)"
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
      canvas: "#f3f7fc",
      sidebar: "#e6eef8",
      surface: "#ffffff",
      accent: "#1d4ed8",
      accentSoft: "#dbeafe",
      accentSecondary: "#0e7490",
      accentTertiary: "#b45309",
      text: "#142438",
      border: "rgba(20, 36, 56, 0.12)"
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
      canvas: "#f7f5fb",
      sidebar: "#eee8f6",
      surface: "#ffffff",
      accent: "#6d28d9",
      accentSoft: "#ede9fe",
      accentSecondary: "#be185d",
      accentTertiary: "#b45309",
      text: "#20172a",
      border: "rgba(32, 23, 42, 0.12)"
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
      canvas: "#faf7f0",
      sidebar: "#f1e9db",
      surface: "#ffffff",
      accent: "#92400e",
      accentSoft: "#fef3c7",
      accentSecondary: "#c2410c",
      accentTertiary: "#b45309",
      text: "#292114",
      border: "rgba(41, 33, 20, 0.12)"
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
      canvas: "#faf5f6",
      sidebar: "#f1e4e8",
      surface: "#ffffff",
      accent: "#be123c",
      accentSoft: "#ffe4e6",
      accentSecondary: "#4338ca",
      accentTertiary: "#b45309",
      text: "#2b1820",
      border: "rgba(43, 24, 32, 0.12)"
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
      canvas: "#f6f5ef",
      sidebar: "#e8e6d8",
      surface: "#ffffff",
      accent: "#854d0e",
      accentSoft: "#fef3c7",
      accentSecondary: "#b91c1c",
      accentTertiary: "#b45309",
      text: "#171714",
      border: "rgba(23, 23, 20, 0.20)"
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
      canvas: "#f3f7f9",
      sidebar: "#e2edf3",
      surface: "#ffffff",
      accent: "#075985",
      accentSoft: "#e0f2fe",
      accentSecondary: "#0f766e",
      accentTertiary: "#b45309",
      text: "#132635",
      border: "rgba(19, 38, 53, 0.12)"
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
      canvas: "#faf6f0",
      sidebar: "#efe3d6",
      surface: "#ffffff",
      accent: "#9a3412",
      accentSoft: "#ffedd5",
      accentSecondary: "#4d7c0f",
      accentTertiary: "#b45309",
      text: "#2b2118",
      border: "rgba(43, 33, 24, 0.12)"
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
