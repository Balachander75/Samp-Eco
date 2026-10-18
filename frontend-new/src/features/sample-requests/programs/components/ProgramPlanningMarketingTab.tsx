import React, { useState } from "react";
import { SampleRequestItem, ProgramActivityItem } from "../../types";
import { formatOdooDate } from "../../utils/dateUtils";
import {
  Pin,
  PinOff,
  Send,
  Loader2,
  MessageSquare,
  Sparkles,
} from "lucide-react";

export interface ProgramPlanningMarketingTabProps {
  activeRequest: SampleRequestItem;
  mode?: "marketing" | "sampling" | "plant";
  readOnly?: boolean;
  onPinActivity: (activityId: number, pinned: boolean) => Promise<void>;
  onReplyActivity: (activityId: number, remark: string) => Promise<void>;
}

export const ProgramPlanningMarketingTab: React.FC<ProgramPlanningMarketingTabProps> = ({
  activeRequest,
  mode = "marketing",
  readOnly = false,
  onPinActivity,
  onReplyActivity,
}) => {
  const isMarketingDesk = mode === "marketing";
  const canPinAndReply = isMarketingDesk && !readOnly;

  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activities = (activeRequest.activities || []) as unknown as ProgramActivityItem[];
  const outputs = activities
    .filter((entry) => entry.action === "SAMP_OUTPUT" || entry.action === "PLANT_OUTPUT")
    .slice()
    .reverse();

  const replies = activities.filter((entry) => entry.action === "MARKETING_OUTPUT_REPLY");

  const handleTogglePin = async (activityId: number, currentPinned: boolean) => {
    if (busyKey || !canPinAndReply) return;
    setBusyKey(`pin-${activityId}`);
    setError(null);
    try {
      await onPinActivity(activityId, !currentPinned);
    } catch (err: any) {
      setError(err?.message || "Could not update pin status.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleSendReply = async (activityId: number, e: React.FormEvent) => {
    e.preventDefault();
    const remark = (replyDrafts[activityId] || "").trim();
    if (!remark || busyKey || !canPinAndReply) return;

    setBusyKey(`reply-${activityId}`);
    setError(null);
    try {
      await onReplyActivity(activityId, remark);
      setReplyDrafts((prev) => ({ ...prev, [activityId]: "" }));
    } catch (err: any) {
      setError(err?.message || "Could not save Marketing directive.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="py-5 space-y-6 select-text text-xs">
      {/* ── Editorial Header Banner ── */}
      <div className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-low)]">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-300/40">
                Marketing Desk
              </span>
              <h2 className="text-base font-bold font-display text-[var(--on-surface)]">
                Campaign Review &amp; Output Directives
              </h2>
            </div>
            <p className="mt-1 text-xs text-[var(--on-surface-muted)] max-w-2xl leading-relaxed">
              Synthesize feedback from SAMP Lab and Plant Desk, pin high-priority technical observations, and publish official Marketing directives.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-display font-bold text-xs bg-[var(--surface-lowest)] text-[var(--accent-primary)] border border-[var(--border-subtle)] shadow-2xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{outputs.filter((o) => o.pinnedByMarketing).length} Pinned Directives</span>
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* ── Outputs Feed with Pinning & Threaded Replies ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
          <h3 className="font-display font-bold text-sm text-[var(--on-surface)] flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Technical &amp; Plant Department Observations</span>
          </h3>
          <span className="text-[11px] font-mono text-[var(--on-surface-subtle)]">
            {outputs.length} {outputs.length === 1 ? "Output" : "Outputs"} Recorded
          </span>
        </div>

        {outputs.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-[var(--border-subtle)] text-center text-xs text-[var(--on-surface-subtle)]">
            No technical or plant observations recorded yet. Observations added by SAMP Lab or Plant Desk will appear here.
          </div>
        ) : (
          outputs.map((entry) => {
            const isPinned = Boolean(entry.pinnedByMarketing);
            const isSamp = entry.action === "SAMP_OUTPUT";
            const department = isSamp ? "SAMP Team" : `Plant Desk (${activeRequest.targetPlant || "1505"})`;
            const threadReplies = replies.filter(
              (reply) => Number(reply.payload?.output_activity_id ?? reply.payload?.outputActivityId) === entry.id
            );

            return (
              <div
                key={entry.id}
                className={`p-4 rounded-2xl border transition-all shadow-2xs space-y-3 ${
                  isPinned
                    ? "border-[var(--accent-primary)]/40 bg-[var(--surface-lowest)] ring-1 ring-[var(--accent-primary)]/15"
                    : "border-[var(--border-subtle)] bg-[var(--surface-base)]"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${
                        isSamp
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300"
                      }`}
                    >
                      {department}
                    </span>
                    <strong className="text-xs text-[var(--on-surface)] font-display">
                      {entry.actorName}
                    </strong>
                  </div>

                  <div className="flex items-center gap-2">
                    {isPinned && (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold font-sans text-[var(--accent-primary)] bg-[var(--accent-primary-subtle)] px-2 py-0.5 rounded-full border border-[var(--accent-primary)]/20">
                        <Pin className="w-3 h-3" />
                        <span>Pinned by Marketing</span>
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-[var(--on-surface-subtle)]">
                      {entry.createdAt ? formatOdooDate(entry.createdAt) : "—"}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <p className="text-xs sm:text-[13px] text-[var(--on-surface)] leading-relaxed font-sans whitespace-pre-wrap bg-[var(--surface-low)] p-3 rounded-xl border border-[var(--border-subtle)]">
                  {String(entry.payload.remark || "")}
                </p>

                {/* Threaded Marketing Directives / Replies */}
                {threadReplies.length > 0 && (
                  <div className="pl-3 border-l-2 border-[var(--accent-primary)] space-y-2 mt-2">
                    {threadReplies.map((reply) => (
                      <div
                        key={reply.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-white/5 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold font-display text-[var(--accent-primary)]">
                            Marketing Directive ({reply.actorName})
                          </span>
                          <span className="text-[10px] font-mono text-[var(--on-surface-subtle)]">
                            {reply.createdAt ? formatOdooDate(reply.createdAt) : "—"}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--on-surface)] leading-relaxed">
                          {String(reply.payload.remark || "")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pinning & Reply Controls */}
                {canPinAndReply && (
                  <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        disabled={busyKey === `pin-${entry.id}`}
                        onClick={() => handleTogglePin(entry.id, isPinned)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer disabled:opacity-50"
                      >
                        {isPinned ? (
                          <>
                            <PinOff className="w-3.5 h-3.5" />
                            <span>Unpin Note</span>
                          </>
                        ) : (
                          <>
                            <Pin className="w-3.5 h-3.5" />
                            <span>Pin Note for Campaign Directive</span>
                          </>
                        )}
                        {busyKey === `pin-${entry.id}` && (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        )}
                      </button>
                    </div>

                    {/* Inline Directive Reply Form when pinned */}
                    {isPinned && (
                      <form
                        onSubmit={(e) => handleSendReply(entry.id, e)}
                        className="flex gap-2 items-center"
                      >
                        <input
                          type="text"
                          maxLength={2000}
                          value={replyDrafts[entry.id] || ""}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({
                              ...prev,
                              [entry.id]: e.target.value,
                            }))
                          }
                          placeholder="Enter Marketing directive or instructions in response to this observation..."
                          className="flex-1 h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition"
                        />
                        <button
                          type="submit"
                          disabled={!replyDrafts[entry.id]?.trim() || busyKey === `reply-${entry.id}`}
                          className="h-9 px-3.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-2xs disabled:opacity-50"
                        >
                          {busyKey === `reply-${entry.id}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span>Send Directive</span>
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ProgramPlanningMarketingTab;
