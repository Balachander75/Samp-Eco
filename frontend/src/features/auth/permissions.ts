import type { UserProfile } from "./types";

export type WorkflowTeam = "marketing" | "samp" | "plant" | "creative_studio" | "costing";

function normalize(value: unknown): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isAdmin(user?: UserProfile | null): boolean {
  return ["admin", "administrator"].includes(normalize(user?.role));
}

export function isReadOnlyTeamHead(user?: UserProfile | null): boolean {
  return Boolean(user?.is_team_head) && !isAdmin(user);
}

export function hasWorkflowTeam(user: UserProfile | null | undefined, team: WorkflowTeam): boolean {
  if (!user || isAdmin(user)) return false;
  const aliases: Record<WorkflowTeam, string[]> = {
    marketing: ["marketing"],
    samp: ["samp", "sampling"],
    plant: ["plant"],
    creative_studio: ["creative", "studio"],
    costing: ["costing"],
  };
  const values = user.team ? [user.team] : [];
  return values.some((value) => aliases[team].some((alias) => normalize(value).includes(alias)));
}

export function getWorkspaceHome(user?: UserProfile | null): string {
  if (isAdmin(user)) return "/dashboard";
  if (hasWorkflowTeam(user, "marketing")) return "/sample-requests";
  if (hasWorkflowTeam(user, "samp")) return "/samp-team-work";
  if (hasWorkflowTeam(user, "plant")) return "/plant";
  if (hasWorkflowTeam(user, "creative_studio")) return "/creative-work";
  if (hasWorkflowTeam(user, "costing")) return "/costing-team";
  return "/help";
}

export function canAccessWorkspacePath(user: UserProfile, rawPath: string): boolean {
  const path = rawPath.toLowerCase().split(/[?#]/, 1)[0].replace(/\/$/, "") || "/";
  // These Plant workflows are deferred for every role, including Admin.
  if (["/plant/production", "/plant/qc", "/plant/dispatch"].some((p) => path === p || path.startsWith(`${p}/`))) return false;
  if (path === "/settings" || path.startsWith("/settings/")) return true;
  if (isAdmin(user)) {
    return true;
  }

  if (path === "/dashboard" || path === "/") return false;
  if (path === "/help") return true;
  if (path.startsWith("/members") || path === "/analytics") return false;

  if (["/sample-requests", "/marketing-work", "/sales"].some((p) => path === p || path.startsWith(`${p}/`))) {
    return hasWorkflowTeam(user, "marketing");
  }
  if (["/samp-team-work", "/sampling", "/prototypes"].some((p) => path === p || path.startsWith(`${p}/`))) {
    return hasWorkflowTeam(user, "samp");
  }
  if (["/creative-work", "/creative", "/artwork"].some((p) => path === p || path.startsWith(`${p}/`))) {
    return hasWorkflowTeam(user, "creative_studio");
  }
  if (["/studio-work", "/studio", "/cad", "/prepress"].some((p) => path === p || path.startsWith(`${p}/`))) {
    return hasWorkflowTeam(user, "creative_studio");
  }
  if (["/plant", "/plants", "/plant-execution", "/plant-work"].some((p) => path === p || path.startsWith(`${p}/`))) {
    return hasWorkflowTeam(user, "plant");
  }
  if (["/costing-team", "/costing", "/costing-work", "/bom"].some((p) => path === p || path.startsWith(`${p}/`))) {
    return hasWorkflowTeam(user, "costing");
  }
  return false;
}
