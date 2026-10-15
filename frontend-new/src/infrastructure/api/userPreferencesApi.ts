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

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
  confirm_password?: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  message: string;
}

export function changePasswordApi(
  payload: ChangePasswordPayload
): Promise<ChangePasswordResponse> {
  return apiFetch<ChangePasswordResponse>("/api/auth/change-password", {
    method: "POST",
    jsonBody: payload,
  });
}
