import React, { useState } from "react";
import { UserProfile } from "@/features/auth";
import { UserItem } from "@/infrastructure/api/masterApi";
import {
  ShieldCheck,
  Shield,
  Crown,
  Users,
  Check,
  X,
  Lock,
  Eye,
  Key,
  Layers,
  ArrowRight,
  Sparkles,
  Sliders,
} from "lucide-react";
import { Select } from "@/components/ui/Select";

interface MembersGovernancePageProps {
  currentUser: UserProfile;
  users: UserItem[];
}

export const MembersGovernancePage: React.FC<MembersGovernancePageProps> = ({
  currentUser,
  users,
}) => {
  const [simulatedUserId, setSimulatedUserId] = useState<number>(() => {
    return users.find((u) => !u.isTeamHead && u.role !== "admin")?.id || users[0]?.id || 1;
  });

  const selectedSimUser = users.find((u) => u.id === simulatedUserId) || users[0];

  const isSimAdmin =
    selectedSimUser?.role === "admin" || selectedSimUser?.userid.toLowerCase() === "admin";
  const isSimHead = Boolean(selectedSimUser?.isTeamHead || selectedSimUser?.role === "head");

  const matrixFeatures = [
    {
      title: "Raise New Sample Request / Feasibility",
      description: "Submit product specs, attachments, and target dates",
      admin: true,
      head: true,
      member: true,
    },
    {
      title: "View Own Raised Requests",
      description: "Access and track progress of requests raised by own account",
      admin: true,
      head: true,
      member: true,
    },
    {
      title: "View All Department Requests",
      description: "Oversight over colleague submissions in same department",
      admin: true,
      head: true,
      member: false,
    },
    {
      title: "Toggle Team Queue vs My Queue",
      description: "1-Click ribbon toggle between personal and departmental requests",
      admin: true,
      head: true,
      member: false,
    },
    {
      title: "View Cross-Department Pipelines",
      description: "Direct view into Studio dielines, Creative briefs, and SAMP Lab queues",
      admin: true,
      head: true,
      member: false,
    },
    {
      title: "Release Drafts into Production Workflow",
      description: "Handoff commercial items from draft staging into active pipeline",
      admin: true,
      head: true,
      member: true,
    },
    {
      title: "Manage Team Personnel (Add/Edit Members)",
      description: "Create user logins, assign roles, and designate team heads",
      admin: true,
      head: false,
      member: false,
    },
    {
      title: "Manage Manufacturing Plant Master",
      description: "Register production facilities, codes, and operational status",
      admin: true,
      head: false,
      member: false,
    },
    {
      title: "Batch Delete & Sample Code Reset",
      description: "Permanently delete records and reclaim sample counter codes",
      admin: true,
      head: false,
      member: false,
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-zinc-950 overflow-y-auto p-6 space-y-6">
      {/* Overview Card */}
      <div className="rounded-2xl border border-zinc-200/90 dark:border-white/[0.08] bg-white dark:bg-zinc-900 p-6 shadow-2xs">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Security & Data Isolation Standards
          </div>
          <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-50">
            3-Tier Departmental Access Governance Architecture
          </h2>
          <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Every user account in the ERP system belongs to one of three security tiers. This guarantees that individual marketing and engineering specialists operate in a clean, focused queue containing only their work, while department heads supervise the full team pipeline.
          </p>
        </div>

        {/* 3 Tier Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tier 1: Team Specialist */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 bg-zinc-50/60 dark:bg-zinc-900/40 flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center font-bold text-xs mb-3">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">Tier 1</span>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50 mt-0.5">
                Team Specialist (Member)
              </h3>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
                Strict personal queue isolation. Sees only requests they raised. Cannot view or edit colleagues' submissions.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-200/60 dark:border-zinc-800 text-[11px] font-mono text-zinc-500">
              Scope: creator === userid
            </div>
          </div>

          {/* Tier 2: Team Head */}
          <div className="rounded-xl border border-emerald-300 dark:border-emerald-800/80 p-5 bg-emerald-50/30 dark:bg-emerald-950/20 flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs mb-3 shadow-xs">
                <Crown className="w-4 h-4" />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 block">Tier 2</span>
              <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-100 mt-0.5">
                Department Team Head
              </h3>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
                Departmental pipeline supervision. Full visibility over all department requests with instant toggle for personal submissions.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-emerald-200/60 dark:border-emerald-900/40 text-[11px] font-mono text-emerald-700 dark:text-emerald-300">
              Scope: department_all + toggle
            </div>
          </div>

          {/* Tier 3: Global Admin */}
          <div className="rounded-xl border border-zinc-900 dark:border-zinc-700 p-5 bg-zinc-950 text-white dark:bg-zinc-900 flex flex-col justify-between shadow-xs">
            <div>
              <div className="w-9 h-9 rounded-xl bg-white text-zinc-900 flex items-center justify-center font-bold text-xs mb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">Tier 3</span>
              <h3 className="text-sm font-bold text-white mt-0.5">
                Global Administrator
              </h3>
              <p className="mt-2 text-xs text-zinc-300 leading-normal">
                Complete system governance. Manages users, resets passwords, configures plants, and performs batch data maintenance.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-800 text-[11px] font-mono text-zinc-400">
              Scope: unrestricted_system
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Live User Access Simulator */}
      <div className="rounded-2xl border border-zinc-200/90 dark:border-white/[0.08] bg-white dark:bg-zinc-900 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-100 dark:border-white/[0.06]">
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <span>Live User Role Simulator</span>
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Select any member from the live database to test their request visibility and system rights in real-time.
            </p>
          </div>

          {/* User Selector Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-medium">Simulate User:</span>
            <Select
              value={simulatedUserId}
              onChange={(e) => setSimulatedUserId(Number(e.target.value))}
              selectClassName="px-3 py-1.5 text-xs font-semibold"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.isTeamHead ? "Head" : u.role === "admin" ? "Admin" : "Member"} - {u.team})
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Selected User Simulation Card */}
        {selectedSimUser && (
          <div className="mt-5 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-white/[0.06] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                {selectedSimUser.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-zinc-950 dark:text-zinc-50">
                    {selectedSimUser.name}
                  </span>
                  <span className="font-mono text-xs text-zinc-400">@{selectedSimUser.userid}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isSimAdmin
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : isSimHead
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {isSimAdmin ? "System Admin" : isSimHead ? "Team Head" : "Team Specialist"}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  <span>Department: <strong className="text-zinc-800 dark:text-zinc-200 uppercase">{selectedSimUser.team || "None"}</strong></span>
                  <span className="mx-2">•</span>
                  <span>Role: {selectedSimUser.subRole || "Specialist"}</span>
                  {(selectedSimUser.plantCodes?.length ? selectedSimUser.plantCodes : selectedSimUser.plantCode ? [selectedSimUser.plantCode] : []).length > 0 && (
                    <>
                      <span className="mx-2">•</span>
                      <span>Assigned Plants: {(selectedSimUser.plantCodes?.length ? selectedSimUser.plantCodes : [selectedSimUser.plantCode]).filter(Boolean).join(", ")}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="text-xs p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/[0.08] max-w-sm">
              <span className="text-[10px] font-bold uppercase text-zinc-400 block mb-0.5">
                Dashboard & Queue Behavior
              </span>
              <p className="text-zinc-700 dark:text-zinc-300 font-medium">
                {isSimAdmin
                  ? "Global View: Sees all requests across all marketing, creative, and plant pipelines."
                  : isSimHead
                  ? "Supervisory View: Sees all requests raised in their team with a 1-click toggle for their own submissions."
                  : "Isolated View: Strictly sees only the sample requests created by their account."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Comprehensive Permissions Matrix Table */}
      <div className="rounded-2xl border border-zinc-200/90 dark:border-white/[0.08] bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-white/[0.06] bg-zinc-50/60 dark:bg-zinc-900/40">
          <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
            Feature & Operational Permissions Matrix
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Explicit matrix mapping operational privileges across all three authorization tiers.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-white/[0.06] bg-zinc-50/40 dark:bg-zinc-900/20 text-zinc-500">
                <th className="py-3 px-6 font-semibold">Functional Feature / Operational Capability</th>
                <th className="py-3 px-6 font-semibold text-center w-36">Global Admin</th>
                <th className="py-3 px-6 font-semibold text-center w-36">Department Head</th>
                <th className="py-3 px-6 font-semibold text-center w-36">Team Specialist</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
              {matrixFeatures.map((row, i) => (
                <tr key={i} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/30 transition-colors">
                  <td className="py-3 px-6">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
                      {row.title}
                    </span>
                    <span className="text-[11px] text-zinc-500">{row.description}</span>
                  </td>

                  <td className="py-3 px-6 text-center">
                    {row.admin ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-6 text-center">
                    {row.head ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-6 text-center">
                    {row.member ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
