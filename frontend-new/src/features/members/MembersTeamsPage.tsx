import React, { useMemo, useState } from "react";
import { UserProfile } from "@/features/auth";
import { UserItem } from "@/infrastructure/api/masterApi";
import { PlantItem } from "@/features/sample-requests/types";
import {
  Calculator,
  Crown,
  Edit2,
  Factory,
  FlaskConical,
  Layers,
  Mail,
  Palette,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
  Box,
} from "lucide-react";

interface MembersTeamsPageProps {
  currentUser: UserProfile;
  users: UserItem[];
  plants: PlantItem[];
  isLoading: boolean;
  deletingUserId?: number | null;
  onRefresh: () => void;
  onOpenUserModal: (user?: UserItem) => void;
  onDeleteUser: (userId: number, name: string) => void;
}

const DEPARTMENTS = [
  { id: "all", label: "All", icon: Users },
  { id: "marketing", label: "Marketing", icon: Layers, color: "text-blue-600 ", badge: "bg-blue-50 text-blue-700   border-blue-200/60 " },
  { id: "creative", label: "Creative", icon: Palette, color: "text-purple-600 ", badge: "bg-purple-50 text-purple-700   border-purple-200/60 " },
  { id: "studio", label: "Studio", icon: Box, color: "text-indigo-600 ", badge: "bg-indigo-50 text-indigo-700   border-indigo-200/60 " },
  { id: "samp", label: "Sampling Team", icon: FlaskConical, color: "text-teal-600 ", badge: "bg-teal-50 text-teal-700   border-teal-200/60 " },
  { id: "costing", label: "Costing", icon: Calculator, color: "text-emerald-600 ", badge: "bg-emerald-50 text-emerald-700   border-emerald-200/60 " },
  { id: "plant", label: "Plant Operations", icon: Factory, color: "text-amber-600 ", badge: "bg-amber-50 text-amber-700   border-amber-200/60 " },
  { id: "admin", label: "Administration", icon: ShieldCheck, color: "text-zinc-600 ", badge: "bg-zinc-100 text-zinc-800   border-zinc-200 " },
];

function departmentKey(team?: string): string {
  const value = (team || "").trim().toLowerCase().replace(/[_-]+/g, " ");
  if (["admin", "administration", "management"].includes(value)) return "admin";
  if (["samp", "sampling", "sampling team"].includes(value)) return "samp";
  if (["plant", "plant operations"].includes(value)) return "plant";
  if (["studio", "studio cad", "structural cad studio"].includes(value)) return "studio";
  if (["costing", "commercial costing"].includes(value)) return "costing";
  if (["creative", "creative studio"].includes(value)) return "creative";
  return value;
}

export const MembersTeamsPage: React.FC<MembersTeamsPageProps> = ({
  currentUser,
  users,
  plants,
  isLoading,
  onRefresh,
  onOpenUserModal,
  onDeleteUser,
}) => {
  const [selectedDept, setSelectedDept] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = useMemo(() => users.filter((user) => {
    if (selectedDept !== "all" && departmentKey(user.team) !== selectedDept) return false;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [user.name, user.userid, user.email, user.subRole || "", user.plantCode || ""]
      .some((value) => value.toLowerCase().includes(query));
  }), [users, selectedDept, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 w-full overflow-hidden bg-white ">
      <header className="px-5 sm:px-6 py-2.5 bg-white  border-b border-zinc-200  shrink-0 flex flex-wrap items-center justify-between gap-3 select-none">
        <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse shrink-0" />
            <h1 className="text-sm font-bold text-zinc-900  tracking-tight whitespace-nowrap">Team Members</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-zinc-100  text-zinc-600  tabular-nums">
              {filteredUsers.length} {filteredUsers.length === 1 ? "member" : "members"}
            </span>
          </div>
          <span className="h-4 w-px bg-zinc-200  hidden xl:inline-block" />
          <div className="flex items-center flex-wrap gap-1">
            {DEPARTMENTS.map((department) => {
              const Icon = department.icon;
              const count = department.id === "all" ? users.length : users.filter((user) => departmentKey(user.team) === department.id).length;
              const selected = selectedDept === department.id;
              return (
                <button
                  key={department.id}
                  type="button"
                  onClick={() => setSelectedDept(department.id)}
                  className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all select-none cursor-pointer border active:scale-[0.98] ${selected ? "bg-zinc-900 text-white border-zinc-900 shadow-2xs    font-semibold" : "bg-white  border-zinc-200/80  text-zinc-600  hover:text-zinc-900  hover:bg-zinc-50 "}`}
                >
                  <Icon className={`w-3.5 h-3.5 ${selected ? "text-white " : department.color || "text-zinc-400"}`} />
                  <span>{department.label}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums leading-none ${selected ? "bg-white/20 text-white   font-bold" : "bg-zinc-100 text-zinc-500  "}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-44 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search personnel..."
              className="w-full h-8 pl-8 pr-7 text-xs rounded-md border border-zinc-200  bg-zinc-50/70  text-zinc-900  placeholder:text-zinc-400 focus:outline-hidden focus:border-zinc-400  focus:ring-1 focus:ring-zinc-400/20 transition shadow-2xs"
            />
            {searchQuery && <button type="button" onClick={() => setSearchQuery("")} className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-600  p-0.5 cursor-pointer"><X className="w-3 h-3" /></button>}
          </div>
          <button type="button" onClick={onRefresh} title="Refresh personnel" className="h-8 w-8 rounded-md border border-zinc-200  bg-white  hover:bg-zinc-50  flex items-center justify-center text-zinc-600  transition-colors cursor-pointer active:scale-[0.98]">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button type="button" onClick={() => onOpenUserModal()} className="h-8 px-3.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white    text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-[0.98]">
            <Plus className="w-3.5 h-3.5" /><span>Add Member</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-x-auto overflow-y-auto w-full min-h-0 select-text">
        {isLoading ? (
          <div className="py-20 text-center text-zinc-400 text-xs">Loading team members from the database…</div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-20 text-center text-zinc-400 text-xs flex flex-col items-center justify-center">
            <Users className="w-8 h-8 mb-2.5 text-zinc-300  stroke-[1.5]" />
            <p className="font-semibold text-zinc-700  text-sm">No team members found</p>
            <p className="text-zinc-400 mt-1 max-w-sm text-xs">{searchQuery ? `No personnel match “${searchQuery}”. Try adjusting your search query.` : "No personnel match the selected department filter."}</p>
            {(searchQuery || selectedDept !== "all") && <button type="button" onClick={() => { setSearchQuery(""); setSelectedDept("all"); }} className="mt-3.5 px-3 py-1.5 rounded-md text-xs font-semibold text-zinc-900  bg-zinc-100 hover:bg-zinc-200   transition cursor-pointer">Reset All Filters</button>}
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-zinc-50/95  backdrop-blur-xs border-b border-zinc-200 ">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500  font-mono select-none">
                <th className="py-2.5 px-5">Member</th><th className="py-2.5 px-4">Department</th><th className="py-2.5 px-4">Role Title</th><th className="py-2.5 px-4">System Access</th><th className="py-2.5 px-4">Contact</th><th className="py-2.5 px-4">Status</th><th className="py-2.5 px-5 text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 ">
              {filteredUsers.map((member) => {
                const department = DEPARTMENTS.find((item) => item.id === departmentKey(member.team)) || { id: "other", label: member.team || "General", icon: Users, color: "text-zinc-500", badge: "bg-zinc-100 text-zinc-700   border-zinc-200 " };
                const DepartmentIcon = department.icon;
                const isAdmin = ["admin", "administrator"].includes(member.role.toLowerCase());
                const isSelf = member.id === currentUser.id;
                return (
                  <tr key={member.id} className="hover:bg-zinc-50/80  transition-colors group">
                    <td className="py-3 px-5"><div className="flex items-center gap-3 min-w-0"><div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${isAdmin ? "bg-zinc-900 text-white  " : member.isTeamHead ? "bg-amber-500 text-white" : "bg-zinc-100  text-zinc-700  border border-zinc-200 "}`}>{member.name.slice(0, 2).toUpperCase()}</div><div className="min-w-0"><div className="font-semibold text-xs text-zinc-900  truncate flex items-center gap-1.5"><span>{member.name}</span>{member.isTeamHead && <span title="Department Lead" className="text-amber-500"><Crown className="w-3 h-3 fill-amber-500" /></span>}{isSelf && <span className="text-[9px] uppercase tracking-wide text-zinc-400">You</span>}</div><div className="font-mono text-[11px] text-zinc-400 ">@{member.userid}</div></div></div></td>
                    <td className="py-3 px-4 whitespace-nowrap"><span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border shrink-0 ${department.badge}` }><DepartmentIcon className="w-3 h-3" /><span>{department.label}</span></span></td>
                    <td className="py-3 px-4 whitespace-nowrap"><span className="text-xs text-zinc-700  font-medium">{member.subRole || "Staff"}</span></td>
                    <td className="py-3 px-4 whitespace-nowrap">{isAdmin ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-900 text-white  "><ShieldCheck className="w-3 h-3" />Admin</span> : member.isTeamHead ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800   border border-amber-200 "><Crown className="w-2.5 h-2.5" />Team Head</span> : <span className="text-[11px] text-zinc-500  font-mono">Member</span>}</td>
                    <td className="py-3 px-4 whitespace-nowrap"><a href={`mailto:${member.email}`} className="inline-flex items-center gap-1.5 text-xs text-zinc-600  hover:text-zinc-900  transition-colors font-mono"><Mail className="w-3 h-3 text-zinc-400" /><span>{member.email}</span></a></td>
                    <td className="py-3 px-4 whitespace-nowrap">{member.isActive ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/90   "><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active</span> : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200   "><span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />Inactive</span>}</td>
                    <td className="py-3 px-5 text-right whitespace-nowrap"><div className="flex items-center justify-end gap-1 opacity-90 group-hover:opacity-100"><button type="button" onClick={() => onOpenUserModal(member)} className="h-7 w-7 rounded-md border border-transparent hover:border-zinc-200  hover:bg-zinc-100  text-zinc-400 hover:text-zinc-800  flex items-center justify-center transition-colors cursor-pointer" title="Edit Member"><Edit2 className="w-3.5 h-3.5" /></button><button type="button" onClick={() => onDeleteUser(member.id, member.name)} disabled={isSelf || !member.isActive} className="h-7 w-7 rounded-md border border-transparent hover:border-rose-200  hover:bg-rose-50  text-zinc-400 hover:text-rose-700  flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" title={isSelf ? "You cannot remove your own account" : "Remove Member"}><Trash2 className="w-3.5 h-3.5" /></button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </main>

      <footer className="px-5 sm:px-6 py-2 bg-zinc-50/80  border-t border-zinc-200  shrink-0 flex items-center justify-between text-[11px] text-zinc-500  font-mono select-none">
        <div>Showing <span className="font-bold text-zinc-800  tabular-nums">{filteredUsers.length}</span> of <span className="font-bold text-zinc-800  tabular-nums">{users.length}</span> enterprise personnel</div>
        <div className="hidden sm:flex items-center gap-3"><span>Active Filter: <strong className="text-zinc-700  uppercase">{selectedDept}</strong></span><span>·</span><span>Facilities: <strong>{plants.filter((plant) => plant.isActive).length} active</strong></span></div>
      </footer>
    </div>
  );
};
