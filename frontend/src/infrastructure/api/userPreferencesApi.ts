import type { ThemeId } from "@/context/ThemeContext";
import { apiFetch } from "./client";

interface ThemePreferenceResponse {
  theme_id: ThemeId;
}

export function getThemePreferenceApi(): Promise<ThemePreferenceResponse> {
  return apiFetch<ThemePreferenceResponse>("/api/auth/preferences/theme");
}

export function updateThemePreferenceApi(themeId: ThemeId): Promise<ThemePreferenceResponse> {
  return apiFetch<ThemePreferenceResponse>("/api/auth/preferences/theme", {
    method: "PUT",
    jsonBody: { theme_id: themeId },
  });
}
