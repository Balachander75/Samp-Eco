import React from "react";
import type { UserProfile } from "@/features/auth";
import { isReadOnlyTeamHead } from "@/features/auth/permissions";

export const TeamHeadReadOnlyNotice: React.FC<{ user?: UserProfile | null }> = ({ user }) => {
  if (!isReadOnlyTeamHead(user)) return null;

  const teamName = String(user?.team || "your team").replace(/[_-]+/g, " ");
  return (
    <div role="status" className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-low)] px-5 py-2 text-xs text-[var(--on-surface-muted)] sm:px-8">
      <span className="font-semibold text-[var(--on-surface)]">Team Head · {teamName}</span>
      <span className="ml-2">Read-only access. You can view this team’s workflow and request details.</span>
    </div>
  );
};
