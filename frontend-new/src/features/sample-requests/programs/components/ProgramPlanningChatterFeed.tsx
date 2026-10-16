import React, { useRef, useEffect } from "react";
import { SampleRequestItem, ProgramActivityItem } from "../../types";
import { formatOdooLogDate } from "../../utils/dateUtils";
import {
  History,
  Pin,
  Sparkles,
  UserCheck,
  ShieldCheck,
  Factory,
  PackagePlus,
} from "lucide-react";

export interface ProgramPlanningChatterFeedProps {
  activeRequest: SampleRequestItem;
}

function getInitials(name?: string | null): string {
  if (!name) return "US";
  const clean = String(name).trim();
  if (!clean) return "US";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0][0] || "") + (parts[1][0] || "")).toUpperCase() || "US";
  }
  return clean.slice(0, 2).toUpperCase() || "US";
}

export const ProgramPlanningChatterFeed: React.FC<ProgramPlanningChatterFeedProps> = ({
  activeRequest,
}) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activities = (activeRequest.activities || []) as unknown as ProgramActivityItem[];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activities.length]);

  return (
    <aside className="w-80 lg:w-[380px] shrink-0 border-l border-[var(--border-subtle)] bg-[var(--surface-lowest)] flex flex-col h-full min-h-0 text-xs">
      {/* ── Sticky Top Header: Audit & Activity Log ── */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-base)] px-4 py-3 shrink-0 shadow-2xs">
        <div>
          <div className="flex items-center gap-1.5 font-display font-bold text-xs text-[var(--on-surface)]">
            <History className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Activity &amp; Audit Log</span>
          </div>
          <p className="text-[10px] text-[var(--on-surface-muted)] mt-0.5">
            SAMP · Plant · Marketing event trail
          </p>
        </div>
        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-2.5 py-0.5 font-mono text-[10.5px] font-bold text-[var(--accent-primary)] shadow-2xs">
          {activities.length}
        </span>
      </div>

      {/* ── Scrollable Feed ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {activities.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--on-surface-subtle)] border border-dashed border-[var(--border-subtle)] rounded-xl">
            No activity events recorded yet. Claims, remarks, and directives will appear here in chronological order.
          </div>
        ) : (
          activities.map((act) => {
            const isSamp =
              act.action === "SAMP_OUTPUT" ||
              act.action === "SAMP_TASK_CLAIMED" ||
              act.action === "SAMP_VIEWED" ||
              act.action === "SAMP_REMARKS_UPDATED" ||
              act.actorDepartment?.toLowerCase().includes("samp");
            const isPlant =
              act.action === "PLANT_OUTPUT" ||
              act.action === "PLANT_TASK_CLAIMED" ||
              act.action === "PLANT_VIEWED" ||
              act.actorDepartment?.toLowerCase().includes("plant");
            const isMarketing =
              act.action === "MARKETING_OUTPUT_REPLY" ||
              act.action === "OUTPUT_PINNED" ||
              act.action === "OUTPUT_UNPINNED" ||
              act.action === "CREATED" ||
              act.action === "MATERIAL_ADDED" ||
              act.actorDepartment?.toLowerCase().includes("marketing");
            const isPinned = Boolean(act.pinnedByMarketing);

            return (
              <div
                key={act.id}
                className={`p-3 rounded-2xl border transition-all shadow-2xs space-y-1.5 ${
                  isPinned
                    ? "border-[var(--accent-primary)]/40 bg-[var(--surface-low)] ring-1 ring-[var(--accent-primary)]/15"
                    : "border-[var(--border-subtle)] bg-[var(--surface-base)]"
                }`}
              >
                {/* Header with Avatar and Department Badge */}
                <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-6 h-6 rounded-full text-white font-bold text-[10px] font-mono flex items-center justify-center shrink-0 shadow-2xs"
                      style={{
                        backgroundColor: isSamp
                          ? "#059669"
                          : isPlant
                          ? "#0d9488"
                          : isMarketing
                          ? "var(--accent-primary)"
                          : "#64748b",
                      }}
                    >
                      {getInitials(act.actorName)}
                    </div>
                    <div className="min-w-0 truncate">
                      <span className="font-display font-bold text-xs truncate block text-[var(--on-surface)]">
                        {act.actorName || "System Operator"}
                      </span>
                    </div>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold font-mono shrink-0 border ${
                        isSamp
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/40"
                          : isPlant
                          ? "bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/40"
                          : isMarketing
                          ? "bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/40"
                          : "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {isSamp ? "SAMP" : isPlant ? "Plant" : isMarketing ? "Marketing" : "System"}
                    </span>
                  </div>
                  <span className="text-[9.5px] font-mono text-[var(--on-surface-subtle)] whitespace-nowrap">
                    {formatOdooLogDate(act.createdAt)}
                  </span>
                </div>

                {/* Event Summary / Remark */}
                <div className="text-xs leading-relaxed text-[var(--on-surface)]">
                  {act.action === "CREATED" && (
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--on-surface-muted)]">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                      <span>Program planning campaign created with {act.payload?.material_count || 0} material lines</span>
                    </div>
                  )}

                  {act.action === "MATERIAL_ADDED" && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent-primary)]">
                        <PackagePlus className="w-3.5 h-3.5 shrink-0" />
                        <span>New SKU Added: {act.payload?.material_type || "Material Specification"}</span>
                      </div>
                      <div className="text-[10.5px] text-[var(--on-surface-muted)] font-mono pl-5 space-y-0.5">
                        <p>
                          {act.payload?.quantity ? `${Number(act.payload.quantity).toLocaleString()} ${act.payload.unit || "pcs"}` : ""}
                          {act.payload?.caliper_wt ? ` · ${act.payload.caliper_wt}` : ""}
                          {act.payload?.grade ? ` · ${act.payload.grade}` : ""}
                          {act.payload?.supplier_name ? ` · Vendor: ${act.payload.supplier_name}` : ""}
                        </p>
                        {act.payload?.remark && (
                          <p className="italic text-[10px] text-[var(--on-surface-subtle)] font-sans">
                            &ldquo;{String(act.payload.remark)}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {act.action === "SAMP_TASK_CLAIMED" && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      <UserCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>Technical review claimed by {act.payload?.claimed_by || act.actorName}</span>
                    </div>
                  )}

                  {act.action === "PLANT_TASK_CLAIMED" && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                      <UserCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>Plant task claimed by {act.payload?.claimed_by || act.actorName}</span>
                    </div>
                  )}

                  {act.action === "SAMP_VIEWED" && (
                    <div className="text-[11px] text-[var(--on-surface-muted)]">
                      Opened and viewed by SAMP Lab Desk
                    </div>
                  )}

                  {act.action === "PLANT_VIEWED" && (
                    <div className="text-[11px] text-[var(--on-surface-muted)]">
                      Opened and viewed by Plant Desk
                    </div>
                  )}

                  {act.action === "SAMP_OUTPUT" && (
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        SAMP Technical Sign-Off
                      </span>
                      <p className="whitespace-pre-wrap font-sans text-xs pt-0.5">
                        {String(act.payload?.remark || "")}
                      </p>
                    </div>
                  )}

                  {act.action === "PLANT_OUTPUT" && (
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 block flex items-center gap-1">
                        <Factory className="w-3 h-3" />
                        Plant Feasibility Observation
                      </span>
                      <p className="whitespace-pre-wrap font-sans text-xs pt-0.5">
                        {String(act.payload?.remark || "")}
                      </p>
                    </div>
                  )}

                  {act.action === "MARKETING_OUTPUT_REPLY" && (
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--accent-primary)] block">
                        Marketing Directive
                      </span>
                      <p className="whitespace-pre-wrap font-sans text-xs">
                        {String(act.payload?.remark || "")}
                      </p>
                    </div>
                  )}

                  {act.action === "NOTE_POSTED" && (
                    <p className="whitespace-pre-wrap font-sans text-xs pt-0.5">
                      {String(act.payload?.note || "")}
                    </p>
                  )}

                  {act.action === "SAMP_REMARKS_UPDATED" && (
                    <div className="text-[11px] text-[var(--on-surface-muted)]">
                      Updated SAMP technical remarks across {act.payload?.updated_count || "multiple"} material lines
                    </div>
                  )}

                  {act.action === "OUTPUT_PINNED" && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-primary)]">
                      <Pin className="w-3 h-3" />
                      <span>Pinned department observation to executive summary</span>
                    </div>
                  )}

                  {act.action === "OUTPUT_UNPINNED" && (
                    <div className="text-[11px] text-[var(--on-surface-muted)]">
                      Unpinned department observation
                    </div>
                  )}
                </div>

                {/* Pinned pill tag */}
                {isPinned && (
                  <div className="pt-1 flex items-center gap-1 text-[9.5px] font-bold font-mono text-[var(--accent-primary)]">
                    <Pin className="w-2.5 h-2.5" />
                    <span>PINNED TO DIRECTIVES</span>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </aside>
  );
};

export default ProgramPlanningChatterFeed;
