import type { UserProfile } from "@/features/auth";
import {
  getAssignedWorkspaceTeam,
  getAssignedWorkflowTeam,
  getWorkspaceHome,
  isRootAdmin,
} from "@/features/auth/permissions";

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
  badgeKey?: string;
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
          { id: "costing-costing", title: "Costing", path: "/costing-team/costing", badgeKey: "costingQueue" },
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
          { id: "plant-sampling", title: "Sampling", path: "/plant/sampling", badgeKey: "plantSampling" },
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
  const rootAdmin = isRootAdmin(user);
  if (rootAdmin) {
    return NAVIGATION_GROUPS;
  }

  const team = getAssignedWorkspaceTeam(user);
  if (!team) return NAVIGATION_GROUPS.filter((group) => group.groupTitle === "Preferences & Support");

  const supportGroup = NAVIGATION_GROUPS.find((group) => group.groupTitle === "Preferences & Support");
  const teamMembersItem: NavigationItem = {
    id: "team-members",
    title: "Members",
    shortCode: "TM",
    path: "/team/members",
    departmentKey: "members",
  };

  if (team === "marketing") {
    const marketingItems: NavigationItem[] = [
      {
        id: "marketing-overview",
        title: "Overview",
        shortCode: "OV",
        path: "/sample-requests",
        departmentKey: "marketing",
      },
      {
        id: "marketing-sampling",
        title: "Sample Requests",
        shortCode: "SR",
        path: "/sample-requests/sampling",
        badgeKey: "sampling",
        departmentKey: "marketing",
      },
      {
        id: "marketing-feasibility",
        title: "Feasibility Checks",
        shortCode: "FC",
        path: "/sample-requests/feasibility",
        badgeKey: "pendingFeas",
        departmentKey: "marketing",
      },
      {
        id: "marketing-programs",
        title: "Program Planning",
        shortCode: "PP",
        path: "/sample-requests/programs",
        badgeKey: "programs",
        departmentKey: "marketing",
      },
    ];
    return [
      { groupTitle: "Workspace", items: marketingItems },
      { groupTitle: "Team", items: [teamMembersItem] },
      ...(supportGroup ? [{ ...supportGroup }] : []),
    ];
  }

  const sampleRoutes = {
    samp: {
      path: "/samp-team-work/sampling",
      badgeKey: "sampSampling",
    },
    plant: {
      path: "/plant/sampling",
      badgeKey: "plantSampling",
    },
    creative: {
      path: "/creative-work/sampling",
      aliases: ["/creative-work/design", "/creative-work/costing"],
      badgeKey: "creativeSampling",
      subItems: [
        { id: "team-design", title: "Design", path: "/creative-work/design", badgeKey: "creativeDesign" },
        { id: "team-costing", title: "Costing Requests", path: "/creative-work/costing", badgeKey: "creativeCosting" },
      ],
    },
    studio: {
      path: "/studio-work/sampling",
      aliases: ["/studio-work/mockup"],
      badgeKey: "studioSampling",
      subItems: [
        { id: "team-mockup", title: "Mockup", path: "/studio-work/mockup", badgeKey: "studioMockup" },
      ],
    },
    costing: {
      path: "/costing-team/costing",
      badgeKey: "costingQueue",
    },
  } as const;

  const sampleRoute = sampleRoutes[team];
  const workflowTeam = getAssignedWorkflowTeam(user);
  const feasibilityPath = workflowTeam === "samp" ? "/samp-team-work/feasibility" : "/team-work/feasibility";
  const programPath = team === "plant"
    ? "/plant/programs"
    : workflowTeam === "samp"
      ? "/samp-team-work/programs"
      : "/team-work/programs";
  const creativeWorkspaceItems: NavigationItem[] = team === "creative"
    ? [
        {
          id: "team-design",
          title: "Design",
          shortCode: "DS",
          path: "/creative-work/design",
          badgeKey: "creativeDesign",
          departmentKey: "creative",
        },
        {
          id: "team-creative-sampling",
          title: "Sampling & Mockup",
          shortCode: "SM",
          path: "/creative-work/sampling",
          badgeKey: "creativeSampling",
          departmentKey: "creative",
        },
        {
          id: "team-costing",
          title: "Costing Requests",
          shortCode: "CO",
          path: "/creative-work/costing",
          badgeKey: "creativeCosting",
          departmentKey: "creative",
        },
      ]
    : [];
  const items: NavigationItem[] = [
    {
      id: "team-overview",
      title: "Overview",
      shortCode: "OV",
      path: getWorkspaceHome(user),
      departmentKey: "operations",
    },
    ...(team === "creative"
      ? creativeWorkspaceItems
      : [{
          id: "team-sample-requests",
          title: "Sample Requests",
          shortCode: "SR",
          path: sampleRoute.path,
          aliases: "aliases" in sampleRoute ? [...sampleRoute.aliases] : undefined,
          badgeKey: sampleRoute.badgeKey,
          departmentKey: "samp",
          subItems: "subItems" in sampleRoute ? [...sampleRoute.subItems] : undefined,
        }]),
    ...(team !== "plant"
      ? [{
          id: "team-feasibility",
          title: "Feasibility Checks",
          shortCode: "FC",
          path: feasibilityPath,
          badgeKey: workflowTeam === "samp" ? "sampFeasibility" : undefined,
          departmentKey: "samp",
        }]
      : []),
    {
      id: "team-program-planning",
      title: "Program Planning",
      shortCode: "PP",
      path: programPath,
      badgeKey: team === "plant" ? "plantPrograms" : workflowTeam === "samp" ? "sampPrograms" : undefined,
      departmentKey: "samp",
    },
  ];

  return [
    { groupTitle: "Workspace", items },
    { groupTitle: "Team", items: [teamMembersItem] },
    ...(supportGroup ? [{ ...supportGroup }] : []),
  ];
}

export function getNavigationTitle(pathname: string, user?: UserProfile | null): string {
  const normalizedPath = pathname.toLowerCase().split(/[?#]/, 1)[0].replace(/\/$/, "") || "/";
  const items = (user ? getNavigationGroupsForUser(user) : NAVIGATION_GROUPS).flatMap((group) => group.items);
  const matches = items.flatMap((item) => {
    const itemPaths = [item.path, ...(item.aliases ?? [])].map((path) => path.toLowerCase().replace(/\/$/, "") || "/");
    const itemMatches = itemPaths
      .filter((path) => normalizedPath === path || normalizedPath.startsWith(`${path}/`))
      .map((path) => ({ length: path.length, title: item.title }));
    const subMatches = (item.subItems ?? [])
      .map((sub) => sub.path.toLowerCase().replace(/\/$/, "") || "/")
      .filter((path) => normalizedPath === path || normalizedPath.startsWith(`${path}/`))
      .map((path) => {
        const sub = item.subItems!.find((candidate) => candidate.path.toLowerCase().replace(/\/$/, "") === path);
        return { length: path.length, title: sub ? `${item.title} / ${sub.title}` : item.title };
      });
    return [...itemMatches, ...subMatches];
  });

  if (matches.length) {
    return matches.reduce((best, current) => current.length >= best.length ? current : best).title;
  }

  return "Operations Overview";
}
