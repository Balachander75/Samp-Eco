import React, { useState, useMemo } from "react";
import { UserProfile } from "@/features/auth";
import { UserItem, CreateUserPayload, UpdateUserPayload } from "@/infrastructure/api/masterApi";
import { PlantItem } from "@/features/sample-requests/types";
import {
  Users,
  Crown,
  Plus,
  Search,
  X,
  Edit2,
  Trash2,
  Building2,
  Mail,
  Shield,
  CheckCircle2,
  Clock,
  Briefcase,
  ChevronRight,
  Filter,
} from "lucide-react";

interface MembersTeamsPageProps {
  currentUser: UserProfile;
  users: UserItem[];
  plants: PlantItem[];
  isLoading: boolean;
  onOpenUserModal: (user?: UserItem) => void;
  onDeleteUser: (userId: number, name: string) => void;
}

const DEPARTMENT_DEFS = [
  { id: "all", label: "All Departments" },
  { id: "marketing", label: "Marketing", color: "blue" },
  { id: "creative", label: "Creative Studio", color: "purple" },
  { id: "studio", label: "Structural CAD", color: "indigo" },
  { id: "samp", label: "SAMP Lab", color: "amber" },
  { id: "costing", label: "Commercial Costing", color: "emerald" },
  { id: "plant", label: "Plant Operations", color: "cyan" },
  { id: "admin", label: "Administration", color: "zinc" },
];

export const MembersTeamsPage: React.FC<MembersTeamsPageProps> = ({
  currentUser,
  users,
  plants,
  isLoading,
  onOpenUserModal,
  onDeleteUser,
}) => {
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Metrics summary
  const summary = useMemo(() => {
    const total = users.length;
    const heads = users.filter((u) => u.isTeamHead).length;
    const plantLinked = users.filter((u) => (u.plantCodes?.length || u.plantCode)).length;
    const active = users.filter((u) => u.isActive).length;
    return { total, heads, plantLinked, active };
  }, [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (selectedDept !== "all") {
        if ((u.team || "").toLowerCase() !== selectedDept.toLowerCase()) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.name.toLowerCase().includes(q);
        const matchesUserid = u.userid.toLowerCase().includes(q);
        const matchesEmail = u.email.toLowerCase().includes(q);
        const matchesRole = (u.subRole || "").toLowerCase().includes(q);
        if (!matchesName && !matchesUserid && !matchesEmail && !matchesRole) return false;
      }
      return true;
    });
  }, [users, selectedDept, searchQuery]);

  // Group by department
  const groupedByDept = useMemo(() => {
    const map = new Map<string, { head: UserItem | null; members: UserItem[] }>();
    const order = ["marketing", "creative", "studio", "samp", "costing", "plant", "admin"];

    order.forEach((dept) => {
      map.set(dept, { head: null, members: [] });
    });

    filteredUsers.forEach((u) => {
      const deptKey = (u.team || "other").toLowerCase();
      if (!map.has(deptKey)) {
        map.set(deptKey, { head: null, members: [] });
      }
      const item = map.get(deptKey)!;
      if (u.isTeamHead) {
        item.head = u;
      } else {
        item.members.push(u);
      }
    });

    return map;
  }, [filteredUsers]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-zinc-950 overflow-y-auto">
      {/* SaaS Metric Highlights Bar */}
      <div className="p-6 pb-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="rounded-xl border border-zinc-200/80 dark:border-white/[0.07] bg-white dark:bg-zinc-900 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium">
              <span>Total Personnel</span>
              <Users className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 font-mono tabular-nums">
                {summary.total}
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                {summary.active} Active
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/80 dark:border-white/[0.07] bg-white dark:bg-zinc-900 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium">
              <span>Department Heads</span>
              <Crown className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 font-mono tabular-nums">
                {summary.heads}
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Supervisory Lead
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/80 dark:border-white/[0.07] bg-white dark:bg-zinc-900 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium">
              <span>Plant Assigned</span>
              <Building2 className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 font-mono tabular-nums">
                {summary.plantLinked}
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Facility Leads
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/80 dark:border-white/[0.07] bg-white dark:bg-zinc-900 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium">
              <span>Directory Scope</span>
              <Shield className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 font-mono tabular-nums">
                7
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Workspaces
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Filter Ribbon */}
      <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 dark:border-white/[0.06] bg-zinc-50/50 dark:bg-zinc-900/20">
        {/* Department Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {DEPARTMENT_DEFS.map((dept) => {
            const count =
              dept.id === "all"
                ? users.length
                : users.filter((u) => (u.team || "").toLowerCase() === dept.id).length;
            const isSelected = selectedDept === dept.id;

            return (
              <button
                key={dept.id}
                type="button"
                onClick={() => setSelectedDept(dept.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-2xs"
                    : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-white/[0.08]"
                }`}
              >
                <span>{dept.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? "bg-white/20 text-white dark:bg-black/10 dark:text-zinc-900 font-bold"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Add Action */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search member name, ID, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenUserModal()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Department Units & Members Roster */}
      <div className="p-6 space-y-6">
        {filteredUsers.length === 0 ? (
          <div className="py-20 text-center text-zinc-400 text-xs border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white/40 dark:bg-zinc-900/20">
            <Users className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
            <h3 className="font-semibold text-sm text-zinc-700 dark:text-zinc-300">No personnel found</h3>
            <p className="mt-1 text-zinc-500">Try adjusting your department filter or search keywords.</p>
          </div>
        ) : (
          Array.from(groupedByDept.entries())
            .filter(([deptKey, data]) => {
              if (selectedDept !== "all" && deptKey !== selectedDept) return false;
              return data.head !== null || data.members.length > 0;
            })
            .map(([deptKey, { head, members }]) => {
              const deptMeta = DEPARTMENT_DEFS.find((d) => d.id === deptKey) || {
                id: deptKey,
                label: deptKey.toUpperCase(),
              };

              return (
                <div
                  key={deptKey}
                  className="rounded-2xl border border-zinc-200/90 dark:border-white/[0.08] bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs"
                >
                  {/* Department Unit Header */}
                  <div className="px-6 py-3.5 border-b border-zinc-100 dark:border-white/[0.06] bg-zinc-50/70 dark:bg-zinc-900/40 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                        {deptMeta.label}
                      </h3>
                      <span className="text-[11px] font-mono text-zinc-500">
                        ({(head ? 1 : 0) + members.length} personnel)
                      </span>
                    </div>

                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {head ? (
                        <span className="flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 text-amber-500" />
                          Led by <strong className="text-zinc-800 dark:text-zinc-200">{head.name}</strong>
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">No Head Assigned</span>
                      )}
                    </div>
                  </div>

                  {/* Team Head Hero Strip */}
                  {head && (
                    <div className="px-6 py-4 bg-emerald-50/40 dark:bg-emerald-950/15 border-b border-emerald-100 dark:border-emerald-900/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                            {head.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs">
                            <Crown className="w-3 h-3" />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm text-zinc-950 dark:text-zinc-50">
                              {head.name}
                            </h4>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                              <Crown className="w-3 h-3" />
                              Team Head
                            </span>
                            {!head.isActive && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                                Inactive
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                            <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                              {head.subRole || "Department Lead"}
                            </span>
                            <span className="text-zinc-300 dark:text-zinc-700">•</span>
                            <span className="font-mono text-zinc-500">@{head.userid}</span>
                            <span className="text-zinc-300 dark:text-zinc-700">•</span>
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-zinc-400" />
                              {head.email}
                            </span>
                            {(head.plantCodes?.length ? head.plantCodes : head.plantCode ? [head.plantCode] : []).length > 0 && (
                              <>
                                <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                <span className="flex items-center gap-1 text-zinc-800 dark:text-zinc-200 font-medium">
                                  <Building2 className="w-3 h-3 text-zinc-400" />
                                  Plant {(head.plantCodes?.length ? head.plantCodes : [head.plantCode]).filter(Boolean).join(", ")}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Head Badge & Action */}
                      <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                          Supervisory Scope: All Department Requests
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenUserModal(head)}
                          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
                          title="Edit Lead Profile"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Team Members List */}
                  {members.length > 0 ? (
                    <div className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
                      {members.map((member) => (
                        <div
                          key={member.id}
                          className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/80 dark:hover:bg-zinc-900/30 transition-colors"
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center font-bold text-xs shrink-0 border border-zinc-200/60 dark:border-zinc-700">
                              {member.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-zinc-950 dark:text-zinc-50">
                                  {member.name}
                                </span>
                                <span className="font-mono text-[11px] text-zinc-400">@{member.userid}</span>
                                {!member.isActive && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                                    Inactive
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                  {member.subRole || "Team Member"}
                                </span>
                                <span>•</span>
                                <span>{member.email}</span>
                                {(member.plantCodes?.length ? member.plantCodes : member.plantCode ? [member.plantCode] : []).length > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>Plant {(member.plantCodes?.length ? member.plantCodes : [member.plantCode]).filter(Boolean).join(", ")}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                            <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                              Personal Queue: Own Requests
                            </span>
                            <button
                              type="button"
                              onClick={() => onOpenUserModal(member)}
                              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                              title="Edit Member"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteUser(member.id, member.name)}
                              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-700 dark:text-red-400 hover:text-red-600 transition-colors"
                              title="Remove Member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !head ? (
                    <div className="p-6 text-center text-xs text-zinc-400">
                      No members configured in this department yet.
                    </div>
                  ) : null}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
};
