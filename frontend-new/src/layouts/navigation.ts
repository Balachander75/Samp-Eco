import type { UserProfile } from "@/features/auth";
import { hasWorkflowTeam, isAdmin } from "@/features/auth/permissions";

export interface NavigationSubItem {
  id: string;
  title: string;
  path: string;
  badgeKey?: string;
}

export interface NavigationItem {
  id: string;
  title: string;
  shortCode: string;
  path: string;
  aliases?: string[];
  badge?: string;
  departmentKey: string;
  subItems?: NavigationSubItem[];
  subTeams?: string[];
}

export interface NavigationGroup {
  groupTitle: string;
  items: NavigationItem[];
}

export const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    groupTitle: "Workspace",
    items: [
      {
        id: "dashboard",
        title: "Operations Overview",
        shortCode: "OP",
        path: "/dashboard",
        departmentKey: "operations",
      },
    ],
  },
  {
    groupTitle: "Department Units",
    items: [
      {
        id: "marketing",
        title: "Marketing Work",
        shortCode: "MK",
        path: "/sample-requests",
        aliases: [
          "/marketing-work",
          "/sales",
          "/sample-requests/sampling",
          "/sample-requests/feasibility",
          "/sample-requests/programs",
          "/sample-requests/product-staging",
          "/sample-requests/add-product",
          "/sample-requests/draft-workspace",
        ],
        departmentKey: "marketing",
        subItems: [
          { id: "marketing-overview", title: "Overview", path: "/sample-requests" },
          { id: "marketing-sampling", title: "Sample Requests", path: "/sample-requests/sampling", badgeKey: "sampling" },
          { id: "marketing-feasibility", title: "Feasibility Checks", path: "/sample-requests/feasibility", badgeKey: "pendingFeas" },
          { id: "marketing-programs", title: "Program Planning", path: "/sample-requests/programs", badgeKey: "programs" },
        ],
        subTeams: ["Overview", "Sample Requests", "Feasibility Checks", "Program Planning"],
      },
      {
        id: "creative",
        title: "Creative Work",
        shortCode: "CR",
        path: "/creative-work",
        aliases: [
          "/creative",
          "/artwork",
          "/creative-work/overview",
          "/creative-work/design",
          "/creative-work/sampling",
          "/creative-work/costing",
          "/creative/design",
          "/creative/sampling",
          "/creative/costing",
        ],
        departmentKey: "creative",
        subItems: [
          { id: "creative-overview", title: "Overview", path: "/creative-work" },
          { id: "creative-design", title: "Design", path: "/creative-work/design", badgeKey: "creativeDesign" },
          { id: "creative-sampling", title: "Sampling & Mockup", path: "/creative-work/sampling", badgeKey: "creativeSampling" },
          { id: "creative-costing", title: "Costing Requests", path: "/creative-work/costing", badgeKey: "creativeCosting" },
        ],
        subTeams: ["Overview", "Design", "Sampling & Mockup", "Costing Requests"],
      },
      {
        id: "studio",
        title: "Studio Work",
        shortCode: "ST",
        path: "/studio-work",
        aliases: [
          "/studio",
          "/cad",
          "/prepress",
          "/studio-work/overview",
          "/studio-work/mockup",
          "/studio-work/sampling",
          "/studio-work/artwork",
          "/studio/artwork",
          "/studio/mockup",
          "/studio/sampling",
        ],
        departmentKey: "studio",
        subItems: [
          { id: "studio-overview", title: "Overview", path: "/studio-work" },
          { id: "studio-mockup", title: "Mockup", path: "/studio-work/mockup", badgeKey: "studioMockup" },
          { id: "studio-sampling", title: "Sampling", path: "/studio-work/sampling", badgeKey: "studioSampling" },
        ],
        subTeams: ["Overview", "Mockup", "Sampling"],
      },
      {
        id: "samp",
        title: "SAMP Team Work",
        shortCode: "SM",
        path: "/samp-team-work",
        aliases: [
          "/sampling",
          "/prototypes",
          "/samp-team-work/overview",
          "/samp-team-work/sampling",
          "/samp-team-work/feasibility",
          "/samp-team-work/programs",
        ],
        departmentKey: "samp",
        subItems: [
          { id: "samp-overview", title: "Overview", path: "/samp-team-work" },
          { id: "samp-sampling", title: "Sampling Review", path: "/samp-team-work/sampling", badgeKey: "sampSampling" },
          { id: "samp-feasibility", title: "Feasibility Review", path: "/samp-team-work/feasibility", badgeKey: "sampFeasibility" },
          { id: "samp-programs", title: "Program Planning Review", path: "/samp-team-work/programs", badgeKey: "sampPrograms" },
        ],
        subTeams: ["Overview", "Sampling Review", "Feasibility Review", "Program Planning Review"],
      },
      {
        id: "costing",
        title: "Costing",
        shortCode: "CO",
        path: "/costing-team",
        aliases: ["/costing", "/costing-work", "/bom", "/costing-team/overview", "/costing-team/costing"],
        departmentKey: "costing",
        subItems: [
          { id: "costing-overview", title: "Overview", path: "/costing-team" },
          { id: "costing-costing", title: "Costing", path: "/costing-team/costing" },
        ],
        subTeams: ["Overview", "Costing"],
      },
      {
        id: "plant",
        title: "Plant",
        shortCode: "PL",
        path: "/plant",
        aliases: [
          "/plant-execution",
          "/plant-work",
          "/plants",
          "/plant/overview",
          "/plant/sampling",
          "/plant/programs",
          "/plant/production",
          "/plant/qc",
          "/plant/dispatch",
        ],
        departmentKey: "plant",
        subItems: [
          { id: "plant-overview", title: "Overview", path: "/plant" },
          { id: "plant-sampling", title: "Sampling", path: "/plant/sampling" },
          { id: "plant-programs", title: "Program Planning", path: "/plant/programs", badgeKey: "plantPrograms" },
        ],
        subTeams: ["Overview", "Sampling", "Program Planning"],
      },
      {
        id: "members",
        title: "Team Members",
        shortCode: "MB",
        path: "/members",
        aliases: [
          "/members/teams",
          "/members/plants",
          "/members/governance",
        ],
        departmentKey: "members",
      },
    ],
  },
  {
    groupTitle: "Preferences & Support",
    items: [
      {
        id: "settings",
        title: "Settings",
        shortCode: "CF",
        path: "/settings",
        departmentKey: "settings",
      },
      {
        id: "help",
        title: "Help & Support",
        shortCode: "HP",
        path: "/help",
        departmentKey: "help",
      },
    ],
  },
];

export const ALL_NAVIGATION_ITEMS = NAVIGATION_GROUPS.flatMap((group) => group.items);

export function getNavigationGroupsForUser(user: UserProfile): NavigationGroup[] {
  const admin = isAdmin(user);
  const allowedDepartments = new Set<string>(["settings", "help"]);
  if (admin) {
    NAVIGATION_GROUPS.forEach((group) => group.items.forEach((item) => allowedDepartments.add(item.departmentKey)));
  } else {
    if (hasWorkflowTeam(user, "marketing")) allowedDepartments.add("marketing");
    if (hasWorkflowTeam(user, "samp")) allowedDepartments.add("samp");
    if (hasWorkflowTeam(user, "creative_studio")) {
      allowedDepartments.add("creative");
      allowedDepartments.add("studio");
    }
    if (hasWorkflowTeam(user, "plant")) allowedDepartments.add("plant");
    if (hasWorkflowTeam(user, "costing")) allowedDepartments.add("costing");
  }

  return NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => allowedDepartments.has(item.departmentKey)),
  })).filter((group) => group.items.length > 0);
}

export function getNavigationTitle(pathname: string): string {
  const normalizedPath = pathname.toLowerCase();
  for (const item of ALL_NAVIGATION_ITEMS) {
    if (item.subItems) {
      const subMatch = item.subItems.find((sub) => {
        const p = sub.path.toLowerCase();
        return normalizedPath === p || (p !== item.path.toLowerCase() && normalizedPath.startsWith(`${p}/`));
      });
      if (subMatch && subMatch.path.toLowerCase() !== item.path.toLowerCase()) {
        return `${item.title} / ${subMatch.title}`;
      }
    }
    const isMatch = [item.path, ...(item.aliases ?? [])].some(
      (path) => normalizedPath === path || normalizedPath.startsWith(`${path}/`)
    );
    if (isMatch) return item.title;
  }
  return "Operations Overview";
}
