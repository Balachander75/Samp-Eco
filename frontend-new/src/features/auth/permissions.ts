import type { UserProfile } from "./types";

export type WorkflowTeam = "marketing" | "samp" | "plant" | "creative_studio" | "costing";
export type AssignedWorkspaceTeam = "marketing" | "samp" | "plant" | "creative" | "studio" | "costing";

function normalize(value: unknown): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isAdmin(user?: UserProfile | null): boolean {
  return ["admin", "administrator"].includes(normalize(user?.role));
}

export function getAssignedWorkspaceTeam(user?: UserProfile | null): AssignedWorkspaceTeam | null {
  const team = normalize(user?.team);
  if (team.includes("marketing")) return "marketing";
  if (team.includes("samp") || team.includes("sampling")) return "samp";
  if (team.includes("plant")) return "plant";
  if (team.includes("creative")) return "creative";
  if (team.includes("studio")) return "studio";
  if (team.includes("costing")) return "costing";
  return null;
}

export function getAssignedWorkflowTeam(user?: UserProfile | null): WorkflowTeam | null {
  const team = getAssignedWorkspaceTeam(user);
  return team === "creative" || team === "studio" ? "creative_studio" : team;
}

export function isRootAdmin(user?: UserProfile | null): boolean {
  const team = normalize(user?.team);
  return isAdmin(user) && (!team || ["admin", "root admin", "system admin"].includes(team));
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
  const assignedTeam = getAssignedWorkspaceTeam(user);
  if (isRootAdmin(user)) return "/dashboard";
  if (assignedTeam === "marketing" || hasWorkflowTeam(user, "marketing")) return "/sample-requests";
  if (assignedTeam === "samp" || hasWorkflowTeam(user, "samp")) return "/samp-team-work";
  if (assignedTeam === "plant" || hasWorkflowTeam(user, "plant")) return "/plant";
  if (assignedTeam === "studio") return "/studio-work";
  if (assignedTeam === "creative" || hasWorkflowTeam(user, "creative_studio")) return "/creative-work";
  if (assignedTeam === "costing" || hasWorkflowTeam(user, "costing")) return "/costing-team";
  return "/help";
}

export function canAccessWorkspacePath(user: UserProfile, rawPath: string): boolean {
  const path = rawPath.toLowerCase().split(/[?#]/, 1)[0].replace(/\/$/, "") || "/";
  if (["/plant/production", "/plant/qc", "/plant/dispatch"].some((p) => path === p || path.startsWith(`${p}/`))) return false;
  if (path === "/settings" || path.startsWith("/settings/")) return true;
  if (path === "/team/members" || path.startsWith("/team/members/")) return Boolean(getAssignedWorkspaceTeam(user));
  if (isRootAdmin(user)) {
    return true;
  }

  const assignedTeam = getAssignedWorkflowTeam(user);
  if (path === "/team-work/feasibility") return ["plant", "creative_studio", "costing"].includes(assignedTeam || "");
  if (path === "/team-work/programs") return ["creative_studio", "costing"].includes(assignedTeam || "");
  const hasTeam = (team: WorkflowTeam) => assignedTeam === team || hasWorkflowTeam(user, team);

  if (path === "/dashboard" || path === "/") return false;
  if (path === "/help") return true;
  if (path.startsWith("/members") || path === "/analytics") return false;

  if (["/sample-requests", "/marketing-work", "/sales"].some((p) => path === p || path.startsWith(`${p}/`))) {
    return hasTeam("marketing");
  }
  if (["/samp-team-work", "/sampling", "/prototypes"].some((p) => path === p || path.startsWith(`${p}/`))) {
    return hasTeam("samp");
  }
  if (["/creative-work", "/creative", "/artwork"].some((p) => path === p || path.startsWith(`${p}/`))) {
    return hasTeam("creative_studio");
  }
  if (["/studio-work", "/studio", "/cad", "/prepress"].some((p) => path === p || path.startsWith(`${p}/`))) {
    return hasTeam("creative_studio");
  }
  if (["/plant", "/plants", "/plant-execution", "/plant-work"].some((p) => path === p || path.startsWith(`${p}/`))) {
    return hasTeam("plant");
  }
  if (["/costing-team", "/costing", "/costing-work", "/bom"].some((p) => path === p || path.startsWith(`${p}/`))) {
    return hasTeam("costing");
  }
  return false;
}
