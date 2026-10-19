import React, { useRef, useEffect } from "react";
import { SampleRequestItem, ProgramActivityItem } from "../../types";
import { formatOdooLogDate } from "../../utils/dateUtils";
import {
  History,
  ShieldCheck,
  Factory,
  PackagePlus,
  FileCheck2,
  Lock,
  Clock,
  Layers,
} from "lucide-react";

export interface ProgramPlanningChatterFeedProps {
  activeRequest: SampleRequestItem;
  onNoteAdded?: () => Promise<void> | void;
  currentUser?: any;
}

function formatAuditTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return formatOdooLogDate(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return formatOdooLogDate(dateStr);
  }
}

export const ProgramPlanningChatterFeed: React.FC<ProgramPlanningChatterFeedProps> = ({
  activeRequest,
}) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const rawActivities = (activeRequest.activities || []) as unknown as ProgramActivityItem[];

  // Filter out all "VIEW" events per user request ("dont the view thing like plant view or the smapling team view we dont wanted that")
  const activities = rawActivities.filter((act) => {
    const action = (act.action || "").toUpperCase();
    return (
      !action.includes("VIEW") &&
      action !== "SAMP_VIEWED" &&
      action !== "PLANT_VIEWED" &&
      action !== "VIEWED"
    );
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activities.length]);

  return (
    <aside className="w-72 sm:w-80 lg:w-[350px] shrink-0 border-l border-[var(--border-subtle)] bg-[var(--surface-lowest)] flex flex-col h-full min-h-0 text-xs select-text">
      {/* ── Top Header: Audit & Activity Log ── */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-base)] px-3.5 py-2.5 shrink-0 shadow-2xs">
        <div className="flex items-center gap-2 font-display font-bold text-xs text-[var(--on-surface)]">
          <History className="w-4 h-4 text-[var(--accent-primary)]" />
          <span>Audit &amp; Activity Log</span>
        </div>
        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[var(--accent-primary)] shadow-2xs">
          {activities.length} {activities.length === 1 ? "event" : "events"}
        </span>
      </div>

      {/* ── Scrollable Audit & Activity Log Timeline ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0 bg-[var(--surface-lowest)]">
        {activities.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--on-surface-subtle)] border border-dashed border-[var(--border-subtle)] rounded-xl my-4">
            No activity events recorded yet. Claims, remarks, and directives will appear here in chronological sequence.
          </div>
        ) : (
          activities.map((act) => {
            const action = (act.action || "").toUpperCase();
            const timeStr = formatAuditTime(act.createdAt);
            const actorName = act.actorName || "Team Member";

            // ── A. System Announcement Pill (Claiming task, status change, paused, created) ──
            const isSystemAnnouncement =
              action === "SAMP_TASK_CLAIMED" ||
              action === "PLANT_TASK_CLAIMED" ||
              action === "CREATED" ||
              action === "PROGRAM_CREATED" ||
              action === "PROGRAM_PAUSED" ||
              action === "PROGRAM_RESUMED" ||
              action === "STATUS_UPDATED" ||
              action === "OUTPUT_PINNED" ||
              action === "OUTPUT_UNPINNED";

            if (isSystemAnnouncement) {
              let announcementText = "";
              let iconNode = null;

              if (action === "SAMP_TASK_CLAIMED") {
                announcementText = `${actorName} claimed the Sampling Review task`;
                iconNode = <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />;
              } else if (action === "PLANT_TASK_CLAIMED") {
                announcementText = `${actorName} claimed the Plant Feasibility task`;
                iconNode = <Factory className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />;
              } else if (action === "CREATED" || action === "PROGRAM_CREATED") {
                announcementText = `${actorName} created this program plan`;
                iconNode = <Layers className="w-3 h-3 text-[var(--accent-primary)] shrink-0" />;
              } else if (action === "PROGRAM_PAUSED") {
                announcementText = `${actorName} paused the program plan`;
              } else if (action === "PROGRAM_RESUMED") {
                announcementText = `${actorName} resumed the program plan`;
              } else if (action === "STATUS_UPDATED") {
                announcementText = `${actorName} changed status to ${act.payload?.status || "Updated"}`;
              } else if (action === "OUTPUT_PINNED") {
                announcementText = `${actorName} pinned a technical observation`;
              } else if (action === "OUTPUT_UNPINNED") {
                announcementText = `${actorName} unpinned an observation`;
              }

              return (
                <div key={act.id} className="flex flex-col items-center my-2 animate-in fade-in">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-sans font-medium text-[var(--on-surface-muted)] bg-[var(--surface-low)] border border-[var(--border-subtle)] shadow-2xs max-w-[92%] text-center">
                    {iconNode}
                    <span>{announcementText}</span>
                  </div>
                  {timeStr && (
                    <span className="text-[9.5px] font-mono text-[var(--on-surface-subtle)] mt-0.5">
                      {timeStr}
                    </span>
                  )}
                </div>
              );
            }

            // ── B. Team Audit Entry Card (Remarks, Notes, Substrate additions) ──
            const isSamp =
              action === "SAMP_OUTPUT" ||
              action === "SAMP_REMARKS_UPDATED" ||
              action === "SAMP_REMARK_UPDATED" ||
              act.actorDepartment?.toLowerCase().includes("samp");

            const isPlant =
              action === "PLANT_OUTPUT" ||
              action === "PLANT_REMARKS_UPDATED" ||
              action === "PLANT_REMARK_UPDATED" ||
              act.actorDepartment?.toLowerCase().includes("plant");

            const isMaterialAdd = action === "MATERIAL_ADDED";
            const isMaterialDel = action === "MATERIAL_DELETED";

            const messageText =
              act.payload?.remark ||
              act.payload?.text ||
              act.payload?.note ||
              (isMaterialDel ? "Removed SKU line specification" : "");

            return (
              <div
                key={act.id}
                className="flex flex-col items-start w-full animate-in fade-in duration-100"
              >
                {/* Chat Bubble Container */}
                <div
                  className={`relative max-w-[95%] rounded-2xl p-2.5 shadow-2xs border text-xs space-y-1 ${
                    isSamp
                      ? "bg-emerald-500/10 border-emerald-500/25 dark:bg-emerald-950/30"
                      : isPlant
                      ? "bg-teal-500/10 border-teal-500/25 dark:bg-teal-950/30"
                      : isMaterialAdd
                      ? "bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/25"
                      : "bg-[var(--surface-base)] border-[var(--border-subtle)]"
                  }`}
                >
                  {/* Bubble Sender Info */}
                  <div className="flex items-center justify-between gap-2 border-b border-black/5 dark:border-white/5 pb-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-display font-bold text-[11px] ${
                          isSamp
                            ? "text-emerald-700 dark:text-emerald-300"
                            : isPlant
                            ? "text-teal-700 dark:text-teal-300"
                            : "text-[var(--accent-primary)]"
                        }`}
                      >
                        {actorName}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[8.5px] font-mono font-bold uppercase tracking-wider ${
                          isSamp
                            ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200"
                            : isPlant
                            ? "bg-teal-500/20 text-teal-800 dark:text-teal-200"
                            : "bg-[var(--surface-low)] text-[var(--on-surface-muted)]"
                        }`}
                      >
                        {act.actorDepartment || (isSamp ? "SAMP" : isPlant ? "PLANT" : "DESK")}
                      </span>
                    </div>

                    {action === "SAMP_OUTPUT" && (
                      <span className="text-[9.5px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        Technical Sign-Off
                      </span>
                    )}
                    {action === "PLANT_OUTPUT" && (
                      <span className="text-[9.5px] font-mono font-bold text-teal-700 dark:text-teal-400">
                        Plant Capacity
                      </span>
                    )}
                  </div>

                  {/* Material Added Attachment Card */}
                  {isMaterialAdd && (
                    <div className="p-2 rounded-xl bg-[var(--surface-base)] border border-[var(--border-subtle)] space-y-1 my-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--accent-primary)]">
                        <PackagePlus className="w-3.5 h-3.5 shrink-0" />
                        <span>Added SKU: {act.payload?.material_type || "Material Line"}</span>
                      </div>
                      <div className="text-[10.5px] font-mono text-[var(--on-surface-muted)] pl-5 space-y-0.5">
                        {act.payload?.quantity && (
                          <div>
                            Volume: <strong className="text-[var(--on-surface)]">{Number(act.payload.quantity).toLocaleString()}</strong> {act.payload?.unit || "pcs"}
                          </div>
                        )}
                        {act.payload?.caliper_wt && (
                          <div>Caliper: {act.payload.caliper_wt}</div>
                        )}
                        {act.payload?.supplier_name && (
                          <div>Mill: {act.payload.supplier_name}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Message Body Content */}
                  {messageText && (
                    <p className="text-xs text-[var(--on-surface)] leading-relaxed whitespace-pre-wrap font-sans">
                      {messageText}
                    </p>
                  )}

                  {/* Material Remark Updates */}
                  {action === "SAMP_REMARKS_UPDATED" && (
                    <div className="flex items-center gap-1 text-[10.5px] text-emerald-700 dark:text-emerald-400 font-medium pt-0.5">
                      <FileCheck2 className="w-3 h-3 shrink-0" />
                      <span>Updated line-by-line technical annotations</span>
                    </div>
                  )}
                  {action === "PLANT_REMARKS_UPDATED" && (
                    <div className="flex items-center gap-1 text-[10.5px] text-teal-700 dark:text-teal-400 font-medium pt-0.5">
                      <FileCheck2 className="w-3 h-3 shrink-0" />
                      <span>Updated line-by-line plant capacity annotations</span>
                    </div>
                  )}

                  {/* Card Timestamp */}
                  <div className="flex items-center justify-end gap-1 pt-0.5 text-[9.5px] font-mono text-[var(--on-surface-subtle)] select-none">
                    <Clock className="w-3 h-3 text-[var(--on-surface-subtle)]" />
                    <span>{timeStr}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Bottom Verification Strip ── */}
      <div className="px-3.5 py-2 border-t border-[var(--border-subtle)] bg-[var(--surface-base)] shrink-0 flex items-center justify-between text-[10px] font-mono text-[var(--on-surface-subtle)] select-none">
        <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
          <Lock className="w-3 h-3" />
          <span>Audit Log Verified</span>
        </span>
        <span>{activities.length} Events</span>
      </div>
    </aside>
  );
};

export default ProgramPlanningChatterFeed;
