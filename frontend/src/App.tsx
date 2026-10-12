import { lazy, useState, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, LayoutGrid, Settings2 } from "lucide-react";
import { BusinessYearProvider } from "@/context/BusinessYearContext";
import { PlantProvider } from "@/context/PlantContext";
import { SignInPage, UserProfile, AuthResponse } from "@/features/auth";
import { canAccessWorkspacePath, getWorkspaceHome, hasWorkflowTeam, isAdmin } from "@/features/auth/permissions";
import { readAuthToken, readAuthUser, clearAuthStorage } from "@/lib/session";
import { AppShell, getNavigationTitle } from "@/layouts";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ThemeProvider } from "@/context/ThemeContext";

// Load each workspace on first visit so less-used departments do not inflate startup JS.
const OperationsOverview = lazy(() => import("@/features/dashboard/OperationsOverview"));
const SampleRequestsDesk = lazy(() => import("@/features/sample-requests/SampleRequestsDesk"));
const ProgramPlanningWorkspace = lazy(() => import("@/features/sample-requests/components/ProgramPlanningWorkspace"));
const ProductStagingWorkspace = lazy(() => import("@/features/sample-requests/components/ProductStagingWorkspace"));
const DraftWorkspacePage = lazy(() => import("@/features/sample-requests/components/DraftWorkspacePage"));
const SamplingTeamDesk = lazy(() => import("@/features/samp-team/SamplingTeamDesk"));
const CreativeWorkDesk = lazy(() => import("@/features/creative/CreativeWorkDesk"));
const StudioWorkDesk = lazy(() => import("@/features/studio/StudioWorkDesk"));
const CostingTeamDesk = lazy(() => import("@/features/costing/CostingTeamDesk"));
const PlantExecutionDesk = lazy(() => import("@/features/plant/PlantExecutionDesk"));
const MembersAndPlantsDesk = lazy(() => import("@/features/members/MembersAndPlantsDesk"));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));

// Low-CLS industrial skeleton loader matching ERP table & ribbon metrics
function DeskSkeletonLoader() {
  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-zinc-950 animate-pulse select-none">
      <div className="h-14 border-b border-zinc-200 dark:border-white/[0.08] px-6 flex items-center justify-between bg-white dark:bg-zinc-900">
        <div className="h-4 w-52 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="flex items-center gap-2">
          <div className="h-8.5 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
          <div className="h-8.5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
        </div>
      </div>
      <div className="h-12 border-b border-zinc-200 dark:border-white/[0.07] bg-white dark:bg-zinc-900 px-6 flex items-center gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-5 w-28 bg-zinc-200/60 dark:bg-zinc-800/60 rounded" />
        ))}
      </div>
      <div className="p-6 space-y-3 flex-1 overflow-hidden">
        <div className="h-9 w-full bg-zinc-100 dark:bg-zinc-850 rounded-md" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-11 w-full bg-zinc-100 dark:bg-zinc-900 rounded-md border border-zinc-200/60 dark:border-white/[0.04]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ActiveModuleView({
  user,
}: {
  user: UserProfile;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <ErrorBoundary variant="page">
    <Suspense fallback={<DeskSkeletonLoader />}>
      <div key={location.pathname} className="app-route flex-1 min-h-0 min-w-0 flex flex-col">
      {(() => {
        if (location.pathname === "/settings") {
          return <SettingsPage />;
        }

        // Executive Operations Overview (Dashboard Landing)
        if (location.pathname === "/dashboard" || location.pathname === "/") {
          return <OperationsOverview user={user} />;
        }

        // Enterprise Members & Manufacturing Plants Directory (3 Dedicated Sub-pages)
        if (
          location.pathname === "/members" ||
          location.pathname === "/members/teams" ||
          location.pathname === "/members/plants" ||
          location.pathname === "/members/governance" ||
          location.pathname.startsWith("/members/")
        ) {
          return <MembersAndPlantsDesk user={user} />;
        }


        // Seasonal Program Planning Workspace
        if (location.pathname === "/sample-requests/program-planning") {
          return <ProgramPlanningWorkspace user={user} />;
        }

        // Product Staging Workspace (Marketing Request Flow - Step 2)
        if (
          location.pathname === "/sample-requests/product-staging" ||
          location.pathname === "/sample-requests/add-product"
        ) {
          return <ProductStagingWorkspace user={user} />;
        }

        // Draft Workspace (Draft Review, Cloning & Release to Creative)
        if (location.pathname === "/sample-requests/draft-workspace") {
          return <DraftWorkspacePage user={user} />;
        }

        // SAMP Team Work Desk (Sampling Lab)
        if (
          location.pathname === "/samp-team-work" ||
          location.pathname.startsWith("/samp-team-work/") ||
          location.pathname === "/sampling" ||
          location.pathname === "/prototypes"
        ) {
          return <SamplingTeamDesk user={user} />;
        }

        // Creative Work Desk (Graphic & Packaging Artwork)
        if (
          location.pathname === "/creative-work" ||
          location.pathname === "/creative" ||
          location.pathname === "/artwork" ||
          location.pathname.startsWith("/creative-work/") ||
          location.pathname.startsWith("/creative/")
        ) {
          return <CreativeWorkDesk user={user} />;
        }

        // Studio Work Desk (Structural CAD & Dieline Engineering)
        if (
          location.pathname === "/studio-work" ||
          location.pathname === "/studio" ||
          location.pathname === "/cad" ||
          location.pathname === "/prepress" ||
          location.pathname.startsWith("/studio-work/") ||
          location.pathname.startsWith("/studio/")
        ) {
          return <StudioWorkDesk user={user} />;
        }

        // Costing Team Desk (BOM Pricing, Margin Simulator & Quotes)
        if (
          location.pathname === "/costing-team" ||
          location.pathname === "/costing" ||
          location.pathname === "/costing-work" ||
          location.pathname === "/bom"
        ) {
          return <CostingTeamDesk user={user} />;
        }

        // Marketing Work Desk (Sample Requests)
        if (
          location.pathname === "/sample-requests" ||
          location.pathname === "/sample-requests/sampling" ||
          location.pathname === "/sample-requests/feasibility" ||
          location.pathname === "/sample-requests/programs"
        ) {
          return <SampleRequestsDesk user={user} />;
        }

        // Existing Plant Program Planning review desk
        if (
          location.pathname === "/plant" ||
          location.pathname === "/plant-execution" ||
          location.pathname === "/plant-work" ||
          location.pathname === "/plants" ||
          location.pathname.startsWith("/plant/") ||
          location.pathname.startsWith("/plant-execution/")
        ) {
          return <PlantExecutionDesk user={user} />;
        }

        // Keep unconfigured destinations honest while giving them the same workspace navigation language.
        const title = getNavigationTitle(location.pathname);
        const descriptionByPath: Record<string, string> = {
          "/analytics": "Analytics and service-level views are not configured in this workspace yet.",
          "/members": "Member and plant administration workflows are not configured in this workspace yet.",
          "/settings": "Workspace settings are not available on this page yet.",
          "/help": "Help articles and support guidance are not available on this page yet.",
        };
        const destinations = [
          { label: "Marketing", detail: "Requests and program planning", path: "/sample-requests" },
          { label: "Creative Studio", detail: "Artwork briefs", path: "/creative-work" },
          { label: "Studio", detail: "Structural design and dielines", path: "/studio-work" },
          { label: "SAMP Team", detail: "Sampling operations", path: "/samp-team-work" },
          { label: "Costing", detail: "Estimates and pricing", path: "/costing-team" },
        ];

        return (
          <div className="flex-1 min-h-0 overflow-y-auto bg-[var(--bg-app)]">
            <header className="border-b border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900 px-5 sm:px-7 py-4">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Workspace <span className="px-1.5 text-zinc-300 dark:text-zinc-600">/</span> {title}</div>
              <h1 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{title}</h1>
            </header>

            <div className="mx-auto w-full max-w-6xl space-y-6 p-5 sm:p-7">
              <section className="rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900 p-6 sm:p-8">
                <div className="flex max-w-2xl items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300">
                    <Settings2 className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">Not configured</span>
                    <h2 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">This workspace is not ready yet</h2>
                    <p className="mt-1.5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{descriptionByPath[location.pathname] || "This workspace is not configured yet."}</p>
                    {isAdmin(user) && (
                      <button type="button" onClick={() => navigate("/dashboard")} className="mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-brand-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700">
                        <LayoutGrid className="h-4 w-4" />
                        Operations overview
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Available workspaces</h2>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Continue in one of the configured department workspaces.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {destinations.map((item) => (
                    <button key={item.path} type="button" onClick={() => navigate(item.path)} className="group flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:border-white/[0.08] dark:bg-zinc-900 dark:hover:border-brand-800 dark:hover:bg-brand-950/20 card-hover-lift cursor-pointer">
                      <span>
                        <span className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{item.label}</span>
                        <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{item.detail}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        );
      })()}
      </div>
    </Suspense>
    </ErrorBoundary>
  );

}


import { autoSaveStagedProductsToDraft } from "@/features/sample-requests/utils/autoSaveDraft";
import type { StagedProductItem } from "@/features/sample-requests/components/ProductStagingWorkspace";

function AppShellRouteWrapper({
  user,
  onLogout,
}: {
  user: UserProfile;
  onLogout: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const normalizedPath = location.pathname.toLowerCase();
  const isDeferredPlantRoute = ["/plant/production", "/plant/qc", "/plant/dispatch"].some(
    (path) => normalizedPath === path || normalizedPath.startsWith(`${path}/`)
  );
  if (isDeferredPlantRoute && (isAdmin(user) || hasWorkflowTeam(user, "plant"))) {
    return <Navigate to="/plant/programs" replace />;
  }
  if (!canAccessWorkspacePath(user, normalizedPath)) {
    return <Navigate to={getWorkspaceHome(user)} replace />;
  }

  const handleNavigate = (path: string) => {
    // If user is currently in the Product Staging flow and clicks another section in the sidebar:
    const isStagingRoute =
      location.pathname === "/sample-requests/product-staging" ||
      location.pathname === "/sample-requests/add-product";

    if (isStagingRoute && path !== location.pathname) {
      const cachedStaged = sessionStorage.getItem("samp_active_staged_products");
      const cachedProgram = sessionStorage.getItem("samp_active_program_form");

      if (cachedStaged) {
        try {
          const items: StagedProductItem[] = JSON.parse(cachedStaged);
          if (Array.isArray(items) && items.length > 0) {
            // Immediately clear sessionStorage to prevent duplicate submissions
            sessionStorage.removeItem("samp_active_staged_products");
            sessionStorage.removeItem("samp_active_program_form");

            const programContext = cachedProgram ? JSON.parse(cachedProgram) : null;
            const progTitle = programContext?.programName || programContext?.customer || "Program";

            // Fire auto-save in background
            autoSaveStagedProductsToDraft(items, programContext, user).then((res) => {
              if (res.success) {
                window.dispatchEvent(
                  new CustomEvent("app:show-toast", {
                    detail: {
                      message: `✓ Auto-saved ${res.count} staged product(s) for "${res.programName || res.customer}" directly to Drafts.`,
                      tone: "success",
                    },
                  })
                );
              }
            }).catch((err) => {
              console.error("Auto-save draft error:", err);
            });

            // Instant toast notification while transitioning to other section
            window.dispatchEvent(
              new CustomEvent("app:show-toast", {
                detail: {
                  message: `Auto-saving ${items.length} product(s) for "${progTitle}" to Draft queue...`,
                  tone: "info",
                },
              })
            );

            // If navigating to sample requests, redirect directly to Draft stage tab
            if (path === "/sample-requests") {
              navigate("/sample-requests", { state: { stage: "draft", refresh: Date.now() } });
              return;
            }
          }
        } catch (e) {
          console.error("Failed to parse staged products on navigation:", e);
        }
      }
    }

    navigate(path);
  };

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      currentPath={location.pathname}
      onNavigate={handleNavigate}
    >
      <ActiveModuleView user={user} />
    </AppShell>
  );
}

function AppRoutes() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const token = readAuthToken();
    const user = readAuthUser<UserProfile>();
    return token && user ? user : null;
  });

  const handleSignInSuccess = (response: AuthResponse) => {
    setCurrentUser(response.user);
  };

  const handleLogout = () => {
    clearAuthStorage();
    setCurrentUser(null);
  };

  const protectedElement = currentUser ? (
    <AppShellRouteWrapper user={currentUser} onLogout={handleLogout} />
  ) : (
    <Navigate to="/signin" replace />
  );

  const AUTH_ROUTES = [
    "/dashboard",
    "/sample-requests",
    "/sample-requests/sampling",
    "/sample-requests/feasibility",
    "/sample-requests/programs",
    "/sample-requests/program-planning",
    "/sample-requests/product-staging",
    "/sample-requests/add-product",
    "/sample-requests/draft-workspace",
    "/creative-work",
    "/creative-work/*",
    "/creative/*",
    "/artwork",
    "/studio-work",
    "/studio-work/*",
    "/studio/*",
    "/cad",
    "/prepress",
    "/samp-team-work",
    "/samp-team-work/*",
    "/sampling",
    "/prototypes",
    "/costing-team",
    "/costing-team/*",
    "/costing",
    "/costing-work",
    "/bom",
    "/plant",
    "/plant/*",
    "/plants",
    "/analytics",
    "/members",
    "/members/*",
    "/members/teams",
    "/members/plants",
    "/members/governance",
    "/settings",
    "/help",
  ];

  return (
    <ThemeProvider key={currentUser?.id ?? "guest"} userId={currentUser?.id} initialTheme={currentUser?.theme_id}>
    <PlantProvider key={currentUser ? `user-${currentUser.id}` : "guest"}>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route
          path="/signin"
          element={
            currentUser ? (
              <Navigate to={getWorkspaceHome(currentUser)} replace />
            ) : (
              <SignInPage onSignInSuccess={handleSignInSuccess} />
            )
          }
        />
        <Route path="/plant-execution" element={<Navigate to="/plant" replace />} />
        <Route path="/plant-work" element={<Navigate to="/plant" replace />} />
        {AUTH_ROUTES.map((path) => (
          <Route key={path} path={path} element={protectedElement} />
        ))}
        <Route path="*" element={<Navigate to={currentUser ? getWorkspaceHome(currentUser) : "/signin"} replace />} />
      </Routes>
    </BrowserRouter>
    </PlantProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <BusinessYearProvider>
      <ErrorBoundary variant="page">
        <AppRoutes />
      </ErrorBoundary>
    </BusinessYearProvider>
  );
}
