import type { ThemeId } from "@/context/ThemeContext";

export interface UserProfile {
  id: number;
  name: string;
  userid: string;
  email: string;
  role: string;
  sub_role?: string;
  team?: string;
  is_team_head?: boolean;
  plant_code?: string;
  plant_codes?: string[];
  theme_id?: ThemeId;
  is_active: boolean;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  user: UserProfile;
}

export interface SignInCredentials {
  identifier: string;
  password: string;
  rememberMe: boolean;
}
