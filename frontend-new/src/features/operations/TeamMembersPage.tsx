import React, { useCallback, useEffect, useState } from "react";
import { CircleAlert, ShieldCheck, UsersRound } from "lucide-react";
import type { UserProfile } from "@/features/auth";
import { DeskWorkspaceLayout } from "@/components/erp";
import { fetchMyTeamRosterApi, type TeamRoster } from "@/infrastructure/api";

interface TeamMembersPageProps {
  user: UserProfile;
}

function memberRoleLabel(member: TeamRoster["members"][number]): string {
  if (member.isTeamAdmin) return "Team Admin";
  if (member.isTeamHead) return "Team Head";
  const subRole = member.subRole?.trim();
  if (subRole) return subRole;
  const role = member.role.trim();
  if (!role || ["user", "member"].includes(role.toLowerCase())) return "Member";
  return role.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export const TeamMembersPage: React.FC<TeamMembersPageProps> = ({ user }) => {
  const [roster, setRoster] = useState<TeamRoster | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRoster(await fetchMyTeamRosterApi());
    } catch {
      setError("We couldn't load your team roster. Try refreshing the list.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const teamAdmins = roster?.members.filter((member) => member.isTeamAdmin) ?? [];

  return (
    <DeskWorkspaceLayout
      title="Team"
      subtitle={roster ? `${roster.team} team members and roles` : "Members and roles for your team"}
      totalCount={roster?.memberCount}
      totalLabel="active members"
      showStatusDot={false}
      onRefresh={loadRoster}
      isRefreshing={isLoading}
    >
      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
          {error && (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900   ">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="text-sm leading-relaxed">{error}</p>
            </div>
          )}

          {isLoading && !roster && (
            <div role="status" className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-4 py-8 text-center text-sm text-[var(--on-surface-muted)]">
              Loading your team roster…
            </div>
          )}

          {roster && (
            <>
              <section className="flex flex-col gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)]">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--on-surface)]">Team Admin</h2>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--on-surface-muted)]">
                      The admin responsible for this team.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {teamAdmins.length ? teamAdmins.map((admin) => (
                    <span key={admin.id} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-low)] px-3 py-2 text-xs font-semibold text-[var(--on-surface)]">
                      {admin.name}
                      {admin.id === user.id && <span className="text-[10px] font-medium text-[var(--on-surface-muted)]">You</span>}
                    </span>
                  )) : (
                    <span className="text-xs text-[var(--on-surface-muted)]">No team admin is assigned.</span>
                  )}
                </div>
              </section>

              {roster.members.length ? (
                <section className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)]" aria-label={`${roster.team} team members`}>
                  <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5">
                    <UsersRound className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
                    <h2 className="text-sm font-semibold text-[var(--on-surface)]">Team members</h2>
                    <span className="ml-auto font-mono text-xs tabular-nums text-[var(--on-surface-muted)]">{roster.memberCount}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                      <thead className="bg-[var(--surface-low)] text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-muted)]">
                        <tr>
                          <th scope="col" className="px-4 py-2.5 sm:px-5">Member</th>
                          <th scope="col" className="px-4 py-2.5 sm:px-5">Role</th>
                          <th scope="col" className="px-4 py-2.5 sm:px-5">Team access</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {roster.members.map((member) => (
                          <tr key={member.id} className="text-[var(--on-surface)]">
                            <td className="px-4 py-3 sm:px-5">
                              <span className="font-medium">{member.name}</span>
                              {member.id === user.id && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--on-surface-muted)]">You</span>}
                            </td>
                            <td className="px-4 py-3 text-[var(--on-surface-muted)] sm:px-5">{memberRoleLabel(member)}</td>
                            <td className="px-4 py-3 sm:px-5">
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${member.isTeamAdmin ? "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)]" : member.isTeamHead ? "bg-amber-500/10 text-amber-800 " : "bg-[var(--surface-low)] text-[var(--on-surface-muted)]"}`}>
                                {member.isTeamAdmin ? "Admin" : member.isTeamHead ? "Team Head" : "Member"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-4 py-8 text-center text-sm text-[var(--on-surface-muted)]">
                  No active members are listed for {roster.team}.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DeskWorkspaceLayout>
  );
};

export default TeamMembersPage;
