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
  Check,
  MessageSquare,
  Lock,
} from "lucide-react";

export interface ProgramPlanningChatterFeedProps {
  activeRequest: SampleRequestItem;
  onNoteAdded?: () => Promise<void> | void;
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
      {/* ── Sticky Top Header: Formal Audit & Activity Log ── */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-base)] px-4 py-3 shrink-0 shadow-2xs">
        <div>
          <div className="flex items-center gap-1.5 font-display font-bold text-xs text-[var(--on-surface)]">
            <History className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Activity &amp; Audit Log</span>
          </div>
          <p className="text-[10px] text-[var(--on-surface-muted)] mt-0.5">
            Immutable system audit trail &amp; ownership milestones
          </p>
        </div>
        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-2.5 py-0.5 font-mono text-[10.5px] font-bold text-[var(--accent-primary)] shadow-2xs">
          {activities.length} events
        </span>
      </div>

      {/* ── Scrollable Activity Feed ── */}
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
              act.action === "SKU_PROMOTED_TO_SAMPLE_REQUEST" ||
              act.actorDepartment?.toLowerCase().includes("marketing");
            const isPinned = Boolean(act.pinnedByMarketing);

            const isClaimEvent =
              act.action === "SAMP_TASK_CLAIMED" ||
              act.action === "PLANT_TASK_CLAIMED" ||
              act.action === "TASK_CLAIMED";

            const skuTag =
              act.payload?.material_type ||
              (act.payload?.material_id ? `SKU #${act.payload.material_id}` : null);

            return (
              <div
                key={act.id}
                className={`p-3 rounded-2xl border transition-all shadow-2xs space-y-2 ${
                  isClaimEvent
                    ? "border-emerald-500/30 bg-emerald-500/5 ring-1 ring-emerald-500/10"
                    : isPinned
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

                {/* SKU Context Badge if row-specific */}
                {skuTag && (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--surface-lowest)] border border-[var(--border-subtle)] text-[10px] font-mono font-semibold text-[var(--accent-primary)] shadow-2xs">
                    <span className="text-[9px] uppercase tracking-wider text-[var(--on-surface-subtle)]">SKU:</span>
                    <span>{skuTag}</span>
                  </div>
                )}

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

                  {act.action === "SKU_PROMOTED_TO_SAMPLE_REQUEST" && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>Promoted to Sample Request: {act.payload?.sr_number || `SR-${act.payload?.sample_request_id}`}</span>
                      </div>
                      <div className="text-[10.5px] text-[var(--on-surface-muted)] font-mono pl-5 space-y-0.5">
                        <p>Material: {act.payload?.material_type || "Substrate line"}</p>
                        <p className="text-[10px] text-[var(--on-surface-subtle)]">
                          Scope: {(act.payload?.request_types || ["sample"]).join(", ")}
                        </p>
                      </div>
                    </div>
                  )}

                  {act.action === "SAMP_TASK_CLAIMED" && (
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                        <UserCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>Technical Review Ownership Claimed</span>
                      </div>
                      <p className="text-[10.5px] text-emerald-900/80 dark:text-emerald-200/80 leading-normal">
                        <strong>{act.payload?.claimed_by || act.actorName}</strong> assumed ownership of SAMP technical evaluation.
                      </p>
                    </div>
                  )}

                  {act.action === "PLANT_TASK_CLAIMED" && (
                    <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-teal-800 dark:text-teal-300">
                        <UserCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>Plant Capacity Ownership Claimed</span>
                      </div>
                      <p className="text-[10.5px] text-teal-900/80 dark:text-teal-200/80 leading-normal">
                        <strong>{act.payload?.claimed_by || act.actorName}</strong> assumed factory feasibility ownership for Plant {activeRequest.targetPlant || "1505"}.
                      </p>
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
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>Submitted Technical Evaluation</span>
                      </div>
                      <p className="italic text-[11px] text-[var(--on-surface)] bg-[var(--surface-lowest)] p-2 rounded-lg border border-[var(--border-subtle)]">
                        &ldquo;{act.payload?.remark}&rdquo;
                      </p>
                    </div>
                  )}

                  {act.action === "PLANT_OUTPUT" && (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                        <Factory className="w-3.5 h-3.5 shrink-0" />
                        <span>Submitted Plant Feasibility &amp; Capacity</span>
                      </div>
                      <p className="italic text-[11px] text-[var(--on-surface)] bg-[var(--surface-lowest)] p-2 rounded-lg border border-[var(--border-subtle)]">
                        &ldquo;{act.payload?.remark}&rdquo;
                      </p>
                    </div>
                  )}

                  {act.action === "SAMP_REMARKS_UPDATED" && (
                    <div className="text-[11px] text-[var(--on-surface)]">
                      Updated substrate evaluation notes.
                    </div>
                  )}

                  {act.action === "MARKETING_OUTPUT_REPLY" && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--accent-primary)] font-semibold flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        <span>Directive / Note</span>
                      </div>
                      <p className="text-xs text-[var(--on-surface)] bg-[var(--surface-lowest)] p-2 rounded-lg border border-[var(--border-subtle)]">
                        {act.payload?.reply_text || act.payload?.replyText}
                      </p>
                    </div>
                  )}

                  {act.action === "OUTPUT_PINNED" && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      <Pin className="w-3 h-3" />
                      <span>Pinned departmental observation as critical directive</span>
                    </div>
                  )}

                  {act.action === "OUTPUT_UNPINNED" && (
                    <div className="text-[11px] text-[var(--on-surface-muted)]">
                      Unpinned departmental observation
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

      {/* ── Tamper-proof Audit Footer ── */}
      <div className="px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--surface-base)] shrink-0 flex items-center justify-between text-[11px] text-[var(--on-surface-muted)] select-none">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
          <span className="font-semibold text-[var(--on-surface)]">Verified Audit Trail</span>
        </div>
        <span className="font-mono text-[10px] text-[var(--on-surface-subtle)]">
          Read-only Event Log
        </span>
      </div>
    </aside>
  );
};

export default ProgramPlanningChatterFeed;
