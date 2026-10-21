import React from "react";
import { ArrowLeft, CircleHelp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { UserProfile } from "@/features/auth";
import type { AssignedWorkspaceTeam } from "@/features/auth/permissions";
import { getWorkspaceHome } from "@/features/auth/permissions";

type TeamModule = "feasibility" | "programs";

interface TeamModuleStatusPageProps {
  module: TeamModule;
  team: AssignedWorkspaceTeam | null;
  user: UserProfile;
}

const moduleContent: Record<TeamModule, { title: string; ownership: string; copy: string }> = {
  feasibility: {
    title: "Feasibility Checks",
    ownership: "Marketing raises feasibility requests; SAMP reviews the technical feasibility.",
    copy: "There are no feasibility actions routed to your team. Your team’s assigned work stays in its own workspace.",
  },
  programs: {
    title: "Program Planning",
    ownership: "Marketing raises plans; SAMP and Plant handle the review steps.",
    copy: "There are no program planning actions routed to your team. Your team’s assigned work stays in its own workspace.",
  },
};

const teamLabels: Record<AssignedWorkspaceTeam, string> = {
  marketing: "Marketing",
  samp: "SAMP",
  plant: "Plant",
  creative: "Creative",
  studio: "Studio",
  costing: "Costing",
};

export const TeamModuleStatusPage: React.FC<TeamModuleStatusPageProps> = ({ module, team, user }) => {
  const navigate = useNavigate();
  const content = moduleContent[module];
  const teamLabel = team ? teamLabels[team] : "your team";

  return (
    <main className="min-h-0 flex-1 overflow-auto bg-[var(--bg-app)] p-5 sm:p-8">
      <section className="mx-auto w-full max-w-3xl rounded-2xl bg-[var(--surface-lowest)] p-5 sm:p-7">
        <h2 className="text-xl font-bold tracking-tight text-[var(--on-surface)]">
          No {content.title.toLowerCase()} work is routed to {teamLabel}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--on-surface-muted)]">
          {content.copy}
        </p>

        <div className="mt-6 flex items-start gap-3 rounded-xl bg-[var(--surface-low)] p-4">
          <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold text-[var(--on-surface)]">Workflow ownership</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--on-surface-muted)]">{content.ownership}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate(getWorkspaceHome(user))}
          className="mt-6 inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-3.5 text-xs font-semibold text-[var(--on-accent-primary)] transition-colors hover:bg-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to team overview
        </button>
      </section>
    </main>
  );
};

export default TeamModuleStatusPage;
