import React, { useEffect, useMemo, useState } from "react";
import { MessageSquareText, Pin, Send, PinOff, LoaderCircle } from "lucide-react";
import { SampleRequestItem, ProgramActivityItem, ProgramRequestRecord } from "../../types";
import {
  mapProgramRequestToSampleRequest,
  pinProgramActivityApi,
  replyToProgramActivityApi,
  submitProgramOutputApi,
} from "@/infrastructure/api/programsApi";

type Props = {
  request: SampleRequestItem;
  mode: "marketing" | "sampling" | "plant";
  readOnly?: boolean;
  onUpdated: (request: SampleRequestItem) => void;
};

const TeamLabel: React.FC<{ department: string }> = ({ department }) => (
  <span className="rounded-full border border-[var(--accent-primary)]/20 bg-[var(--accent-primary-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-primary)]">
    {department}
  </span>
);

export const ProgramTeamOutputsPanel: React.FC<Props> = ({ request, mode, onUpdated, readOnly = false }) => {
  const [draft, setDraft] = useState(mode === "sampling" ? request.samplingRemark || "" : request.plantRemark || "");
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const activities = (request.activities || []) as unknown as ProgramActivityItem[];
  useEffect(() => {
    setDraft(mode === "sampling" ? request.samplingRemark || "" : request.plantRemark || "");
  }, [request.id, mode]);
  const outputs = useMemo(
    () => activities.filter((entry) => entry.action === "SAMP_OUTPUT" || entry.action === "PLANT_OUTPUT").slice().reverse(),
    [activities],
  );
  const replies = useMemo(
    () => activities.filter((entry) => entry.action === "MARKETING_OUTPUT_REPLY"),
    [activities],
  );
  const outputDepartment = mode === "sampling" ? "sampling" : "plant";

  const saveUpdate = async (key: string, action: () => Promise<ProgramRequestRecord>) => {
    setBusyKey(key);
    setError("");
    try {
      const updated = await action();
      onUpdated(mapProgramRequestToSampleRequest(updated));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this update.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-[var(--surface-low)] xl:shrink-0 dark:bg-zinc-950">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 shadow-[0_2px_10px_rgba(11,28,48,0.02)] dark:border-white/5 dark:bg-zinc-900">
        <div>
        <div className="flex items-center gap-2 text-xs font-bold tracking-tight text-slate-900 dark:text-zinc-100">
          <MessageSquareText className="h-4 w-4 text-[var(--accent-primary)]" />
          Activity &amp; Team Notes
        </div>
        <p className="mt-1 text-[10px] text-slate-500 dark:text-zinc-400">SAMP · Plant · Marketing</p>
        </div>
        <span className="rounded-full border border-[var(--accent-primary)]/25 bg-[var(--accent-primary-subtle)] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[var(--accent-primary)] dark:bg-[var(--accent-primary)]/20 dark:text-[var(--accent-primary)]">{outputs.length}</span>
      </div>

      {!readOnly && (mode === "sampling" || mode === "plant") && (
        <form
          className="space-y-3 border-b border-slate-100 bg-emerald-50/30 dark:bg-zinc-900 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.trim() || busyKey) return;
            void saveUpdate("output", async () => {
              const saved = await submitProgramOutputApi(request.id, { department: outputDepartment, remark: draft.trim() });
              setDraft("");
              return saved;
            });
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-800">Add your planning note</span>
            <TeamLabel department={mode === "sampling" ? "SAMP" : "Plant"} />
          </div>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Materials or ideas your team may need this year…"
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs leading-5 text-slate-800 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400">Saved to the program history</span>
            <button disabled={!draft.trim() || Boolean(busyKey)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50">
              {busyKey === "output" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Save note
            </button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {outputs.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-xs leading-5 text-slate-500">
            No team notes yet. The annual Marketing plan is available in the main panel.
          </div>
        )}
        {outputs.map((entry) => {
          const isPinned = Boolean(entry.pinnedByMarketing);
          const department = entry.action === "SAMP_OUTPUT" ? "SAMP" : "Plant";
          const threadReplies = replies.filter((reply) => Number(reply.payload.output_activity_id) === entry.id);
          return (
            <article key={entry.id} className={`rounded-xl border p-3.5 ${isPinned ? "border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20" : "border-slate-200 bg-white"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2"><TeamLabel department={department} /><span className="text-[11px] font-medium text-slate-700">{entry.actorName}</span></div>
                <time className="shrink-0 text-[10px] text-slate-400">{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}</time>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-700">{String(entry.payload.remark || "")}</p>
              {isPinned && <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--accent-primary)]"><Pin className="h-3 w-3" /> Pinned by Marketing</div>}
              {threadReplies.map((reply) => (
                <div key={reply.id} className="mt-2 rounded-lg bg-slate-50 dark:bg-zinc-800/50 px-3 py-2 text-xs leading-5 text-slate-600">
                  <strong className="mr-1 text-slate-800">Marketing</strong>{String(reply.payload.remark || "")}
                </div>
              ))}
              {mode === "marketing" && !readOnly && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    disabled={Boolean(busyKey)}
                    onClick={() => void saveUpdate(`pin-${entry.id}`, () => pinProgramActivityApi(request.id, entry.id, !isPinned))}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent-primary)] disabled:opacity-50"
                  >
                    {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    {isPinned ? "Unpin note" : "Pin note"}
                    {busyKey === `pin-${entry.id}` && <LoaderCircle className="h-3 w-3 animate-spin" />}
                  </button>
                  {isPinned && (
                    <form
                      className="mt-2 flex gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const remark = (replyDrafts[entry.id] || "").trim();
                        if (!remark || busyKey) return;
                        void saveUpdate(`reply-${entry.id}`, async () => {
                          const updated = await replyToProgramActivityApi(request.id, entry.id, { remark });
                          setReplyDrafts((current) => ({ ...current, [entry.id]: "" }));
                          return updated;
                        });
                      }}
                    >
                      <input value={replyDrafts[entry.id] || ""} onChange={(event) => setReplyDrafts((current) => ({ ...current, [entry.id]: event.target.value }))} maxLength={2000} placeholder="Marketing remark…" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-emerald-600" />
                      <button aria-label="Send Marketing remark" disabled={!replyDrafts[entry.id]?.trim() || Boolean(busyKey)} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 text-white disabled:opacity-45"><Send className="h-3.5 w-3.5" /></button>
                    </form>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </aside>
  );
};

export default ProgramTeamOutputsPanel;
