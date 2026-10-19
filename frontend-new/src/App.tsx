import { Component, lazy, Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import { BusinessYearProvider } from "@/context/BusinessYearContext";
import { PlantProvider } from "@/context/PlantContext";
import { SignInPage } from "@/features/auth/SignInPage";
import type { UserProfile, AuthResponse } from "@/features/auth/types";
import { getWorkspaceHome, isAdmin } from "@/features/auth/permissions";
import { AUTH_EXPIRED_EVENT, readAuthToken, readAuthUser, clearAuthStorage } from "@/lib/session";
import { AppShell, getNavigationTitle } from "@/layouts";

const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));
const FeasibilityRequestsPage = lazy(() =>
  import("@/features/sample-requests/feasibility/FeasibilityRequestsPage").then((module) => ({ default: module.FeasibilityRequestsPage }))
);
const SampleRequestsDesk = lazy(() =>
  import("@/features/sample-requests/SampleRequestsDesk").then((module) => ({ default: module.SampleRequestsDesk }))
);
const ProductStagingWorkspace = lazy(() =>
  import("@/features/sample-requests/components/ProductStagingWorkspace").then((module) => ({ default: module.ProductStagingWorkspace }))
);
const DraftWorkspacePage = lazy(() =>
  import("@/features/sample-requests/components/DraftWorkspacePage").then((module) => ({ default: module.DraftWorkspacePage }))
);
const CreativeWorkDesk = lazy(() =>
  import("@/features/creative/CreativeWorkDesk").then((module) => ({ default: module.CreativeWorkDesk }))
);
const SampFeasibilityReviewPage = lazy(() =>
  import("@/features/samp-team/feasibility/SampFeasibilityReviewPage").then((module) => ({ default: module.SampFeasibilityReviewPage }))
);
const ProgramPlanningRoute = lazy(() =>
  import("@/features/sample-requests/programs/ProgramPlanningRoute").then((module) => ({ default: module.ProgramPlanningRoute }))
);
const ProgramPlanningWorkspace = lazy(() =>
  import("@/features/sample-requests/components/ProgramPlanningWorkspace").then((module) => ({ default: module.ProgramPlanningWorkspace }))
);
const WorkflowOperationsDesk = lazy(() =>
  import("@/features/sample-requests/components/WorkflowOperationsDesk").then((module) => ({ default: module.WorkflowOperationsDesk }))
);
const MembersAndPlantsDesk = lazy(() => import("@/features/members/MembersAndPlantsDesk"));
const OperationsOverview = lazy(() => import("@/features/dashboard/OperationsOverview"));
const OperationsLandingPage = lazy(() => import("@/features/operations/OperationsLandingPage"));
const PlantSamplingQueue = lazy(() => import("@/features/plant/PlantSamplingQueue").then((module) => ({ default: module.PlantSamplingQueue })));
const StudioWorkDesk = lazy(() => import("@/features/creative/StudioWorkDesk"));
const HelpSupportPage = lazy(() => import("@/features/help/HelpSupportPage"));

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-48 flex-1 items-center justify-center p-6" role="status" aria-live="polite">
      <span className="text-sm text-onSurface-muted">Loading workspace…</span>
    </div>
  );
}

class WorkspaceErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Workspace failed to render:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-48 flex-1 flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
          <p className="text-sm text-onSurface-muted">This workspace could not be loaded.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-onSurface hover:bg-surface-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
          >
            Reload workspace
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AuthenticatedWorkspace({
  user,
  onLogout,
}: {
  user: UserProfile;
  onLogout: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname === "/" ? getWorkspaceHome(user) : location.pathname;
  const activeTitle = getNavigationTitle(currentPath);

  return (
    <BusinessYearProvider>
      <PlantProvider>
        <AppShell
          user={user}
          onLogout={onLogout}
          currentPath={currentPath}
          onNavigate={(path) => navigate(path)}
        >
          <WorkspaceErrorBoundary key={currentPath}>
            <Suspense fallback={<RouteLoadingFallback />}>
              {currentPath === "/members" || currentPath.startsWith("/members/") ? (
            <MembersAndPlantsDesk user={user} />
          ) : currentPath === "/dashboard" ? (
            isAdmin(user) ? <OperationsOverview user={user} /> : <Navigate to={getWorkspaceHome(user)} replace />
          ) : currentPath === "/help" || currentPath.startsWith("/help/") ? (
            <HelpSupportPage user={user} />
          ) : currentPath === "/settings" ? (
            <SettingsPage currentUser={user} />
          ) : currentPath === "/sample-requests/product-staging" || currentPath === "/sample-requests/add-product" ? (
            <ProductStagingWorkspace user={user} />
          ) : currentPath === "/sample-requests/draft-workspace" ? (
            <DraftWorkspacePage user={user} />
          ) : currentPath === "/sample-requests/program-planning" ? (
            <ProgramPlanningWorkspace user={user} />
          ) : currentPath === "/sample-requests/programs" ? (
            <ProgramPlanningRoute key={currentPath} user={user} mode="marketing" />
          ) : currentPath === "/samp-team-work/programs" ? (
            <ProgramPlanningRoute key={currentPath} user={user} mode="sampling" />
          ) : currentPath === "/plant/programs" ? (
            <ProgramPlanningRoute key={currentPath} user={user} mode="plant" />
          ) : currentPath === "/plant/sampling" ? (
            <PlantSamplingQueue user={user} />
          ) : currentPath === "/plant" || currentPath.startsWith("/plant/") || currentPath === "/plants" || currentPath.startsWith("/plants/") || currentPath === "/plant-work" || currentPath.startsWith("/plant-work/") || currentPath === "/plant-execution" || currentPath.startsWith("/plant-execution/") ? (
            <OperationsLandingPage area="plant" />
          ) : currentPath === "/sample-requests/feasibility" ? (
            <FeasibilityRequestsPage
              user={user}
              sourceDesk="marketing"
            />
          ) : currentPath === "/samp-team-work/feasibility" ? (
            <SampFeasibilityReviewPage
              user={user}
            />
          ) : currentPath === "/samp-team-work/sampling" ? (
            <WorkflowOperationsDesk mode="sampling" user={user} />
          ) : currentPath === "/samp-team-work" || currentPath === "/samp-team-work/overview" ? (
            <OperationsLandingPage area="sampling" />
          ) : currentPath === "/costing-team" || currentPath === "/costing-team/overview" ? (
            <OperationsLandingPage area="costing" />
          ) : currentPath === "/costing-team/costing" || currentPath === "/costing" || currentPath.startsWith("/costing/") || currentPath === "/costing-work" || currentPath.startsWith("/costing-work/") || currentPath === "/bom" || currentPath.startsWith("/bom/") ? (
            <WorkflowOperationsDesk mode="costing" user={user} />
          ) : currentPath === "/studio-work" || currentPath.startsWith("/studio-work/") || currentPath === "/studio" || currentPath.startsWith("/studio/") || currentPath === "/cad" || currentPath.startsWith("/cad/") || currentPath === "/prepress" || currentPath.startsWith("/prepress/") ? (
            <StudioWorkDesk user={user} />
          ) : currentPath === "/sample-requests" || currentPath === "/sample-requests/sampling" ? (
            <SampleRequestsDesk user={user} />
          ) : currentPath === "/creative-work" || currentPath === "/creative" || currentPath.startsWith("/creative-work/") || currentPath.startsWith("/creative/") ? (
            <CreativeWorkDesk user={user} />
          ) : (
            <Navigate to="/help" replace state={{ from: currentPath, title: activeTitle }} />
              )}
            </Suspense>
          </WorkspaceErrorBoundary>
        </AppShell>
      </PlantProvider>
    </BusinessYearProvider>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const token = readAuthToken();
    const user = readAuthUser<UserProfile>();
    return token && user ? user : null;
  });

  useEffect(() => {
    const handleAuthExpired = () => {
      clearAuthStorage();
      setCurrentUser(null);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, []);

  const handleSignInSuccess = (response: AuthResponse) => {
    setCurrentUser(response.user);
  };

  const handleLogout = () => {
    clearAuthStorage();
    setCurrentUser(null);
  };

  return (
    <ThemeProvider
      key={currentUser?.id ?? "guest"}
      userId={currentUser?.id}
      initialTheme={currentUser?.theme_id}
    >
      <BrowserRouter {...({ future: { v7_startTransition: true, v7_relativeSplatPath: true } } as Record<string, unknown>)}>
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
          <Route
            path="/*"
            element={
              currentUser ? (
                <AuthenticatedWorkspace user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to="/signin" replace />
              )
            }
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
