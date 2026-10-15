import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Check, Clock3, ExternalLink, Image, ShieldAlert, UserCheck, X } from "lucide-react";
import type { UserProfile } from "@/features/auth";
import { reviewRequestWorkflowApi, type RequestWorkflowRecord } from "@/infrastructure/api";
import { claimMockupRequestApi } from "@/infrastructure/api/sampleRequestsApi";
import { WorkflowStageRail } from "./WorkflowStageRail";
import { formatWorkflowAction } from "./workflowPresentation";

interface MockupSamplingInspectorModalProps {
  record: RequestWorkflowRecord;
  user?: UserProfile | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

const stages = [
  { key: "marketing", label: "Marketing" },
  { key: "creative", label: "Creative" },
  { key: "studio", label: "Studio" },
  { key: "creative_approval", label: "Creative QA" },
  { key: "sampling_review", label: "Sampling" },
  { key: "awaiting_marketing_acceptance", label: "Marketing final" },
];

const stageLabels: Record<string, string> = {
  marketing: "Marketing intake",
  creative: "Creative review",
  studio: "Studio mockup",
  creative_approval: "Creative quality review",
  sampling_review: "Sampling review",
  awaiting_marketing_acceptance: "Marketing final approval",
  done: "Closed",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function display(value: unknown) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function readOnlyTeamHead(user?: UserProfile | null) {
  return Boolean(user?.is_team_head) && !["admin", "administrator"].includes(String(user?.role || "").toLowerCase());
}

export const MockupSamplingInspectorModal: React.FC<MockupSamplingInspectorModalProps> = ({ record, user, onClose, onSaved }) => {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const savingRef = useRef(saving);
  closeRef.current = onClose;
  savingRef.current = saving;
  const data = record.workflow_data || {};
  const claim = data.claimedByUserId == null ? null : String(data.claimedByUserId);
  const isClaimedByMe = Boolean(claim && user?.id != null && claim === String(user.id));
  const isClaimed = Boolean(data.claimedBy || claim);
  const canReview = record.current_stage === "sampling_review" && !readOnlyTeamHead(user) && isClaimedByMe;
  const isReadOnly = readOnlyTeamHead(user);
  const canApprove = canReview && Boolean(typeof data.mockupUrl === "string" && data.mockupUrl.trim());
  const waitingText = record.current_stage === "done"
    ? "This mockup workflow is closed."
    : isReadOnly && record.current_stage === "sampling_review"
      ? "This item is ready for a Sampling reviewer. Team Head access is read-only."
      : `The ${stageLabels[record.current_stage] || record.current_stage} team owns the next step.`;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    dialog?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !savingRef.current) {
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])"));
      if (!focusables.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    setNote("");
    setError(null);
  }, [record.sample_request_id, record.current_stage]);

  const submit = async (decision: "approve" | "return") => {
    if (decision === "return" && !note.trim()) {
      setError("Add a clear note before returning the mockup to Studio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await reviewRequestWorkflowApi("mockup", record.sample_request_id, { decision, remark: note.trim() });
      await onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the Sampling decision.");
    } finally {
      setSaving(false);
    }
  };

  const claimTask = async () => {
    setClaiming(true);
    setError(null);
    try {
      await claimMockupRequestApi(record.sample_request_id);
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not claim this Sampling task.");
    } finally {
      setClaiming(false);
    }
  };

  const outputPath = typeof data.mockupUrl === "string" ? data.mockupUrl.trim() : "";
  const outputHref = /^https?:\/\//i.test(outputPath) ? outputPath : undefined;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="mockup-inspector-title" aria-describedby="mockup-inspector-summary" className="flex max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-[var(--surface-lowest)] text-[var(--on-surface)] shadow-2xl outline-none sm:max-h-[92dvh] sm:rounded-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-start gap-3"><span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)]"><Image className="h-5 w-5" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 id="mockup-inspector-title" className="text-base font-bold tracking-tight">Mockup request</h2><span className="rounded-full bg-[var(--surface-low)] px-2.5 py-1 text-[10px] font-semibold">{record.status}</span></div><p className="mt-1 break-words text-xs text-[var(--on-surface-muted)]"><span className="font-mono font-semibold text-[var(--on-surface)]">{record.sr_number}</span><span className="px-1.5">·</span>{record.product_description || "Mockup request"}<span className="px-1.5">·</span>{record.customer}</p></div></div>
          <button type="button" aria-label="Close mockup inspection" disabled={saving} onClick={onClose} className="rounded-lg p-2 text-[var(--on-surface-muted)] transition-colors hover:bg-[var(--surface-low)] disabled:opacity-50"><X className="h-4 w-4" /></button>
        </header>

        <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-low)]/60 px-4 py-3 sm:px-6"><WorkflowStageRail stages={stages} current={record.current_stage} /></div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {error && <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-xs text-rose-800 dark:bg-rose-950/30 dark:text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(270px,0.68fr)]">
            <div className="min-w-0 space-y-4">
              <section className="rounded-xl border border-[var(--border-subtle)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--on-surface-subtle)]">Current step</p>
                <h3 className="mt-1 text-sm font-bold">{canReview ? "Your next step: review the Studio mockup" : isReadOnly ? "Read-only view" : `Waiting at ${stageLabels[record.current_stage] || record.current_stage}`}</h3>
                <p id="mockup-inspector-summary" className="mt-1 text-xs leading-relaxed text-[var(--on-surface-muted)]">{canReview ? "Check the submitted mockup against the brief. Approve it for Marketing's final decision or return it to Studio with a note." : waitingText}</p>
              </section>

              {record.current_stage === "sampling_review" && !readOnlyTeamHead(user) && (
                <section className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 ${isClaimedByMe ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20" : "border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20"}`}>
                  <div className="flex items-center gap-2.5">
                    {isClaimedByMe ? <UserCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-300" /> : <ShieldAlert className="h-4 w-4 text-amber-700 dark:text-amber-300" />}
                    <div>
                      <p className="text-xs font-semibold">{isClaimedByMe ? `Task claimed by ${data.claimedBy || user?.name || "you"}` : isClaimed ? `Task claimed by ${data.claimedBy || "another Sampling teammate"}` : "Claim this Sampling review"}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--on-surface-muted)]">A reviewer must claim the task before approving or returning it.</p>
                    </div>
                  </div>
                  {!isClaimedByMe && <button type="button" disabled={claiming || saving || isClaimed} onClick={() => void claimTask()} className="min-h-8 rounded-lg bg-amber-700 px-3 text-[11px] font-semibold text-white disabled:opacity-50">{claiming ? "Claiming..." : isClaimed ? "Assigned" : "Claim task"}</button>}
                </section>
              )}

              <section>
                <div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-xs font-bold uppercase tracking-wide text-[var(--on-surface-subtle)]">Request brief</h3><span className="text-[10px] text-[var(--on-surface-subtle)]">From Marketing and Creative</span></div>
                <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-[var(--border-subtle)] sm:grid-cols-3">
                  {[
                    ["Customer", record.customer], ["Brand", record.brand_name], ["Material code", record.material_code],
                    ["Required date", data.requiredDate || data.marketingRequiredDate], ["Marketing reference", data.marketingShutterstockNo],
                    ["Creative reference", data.creativeShutterstockNo], ["Marketing brief", data.marketingRemark],
                    ["Creative instructions", data.creativeRemark], ["Sampling decision", data.samplingReviewDecision],
                  ].map(([label, value]) => <div key={String(label)} className="min-w-0 bg-[var(--surface-lowest)] px-3 py-3"><dt className="text-[10px] font-medium uppercase tracking-wide text-[var(--on-surface-subtle)]">{String(label)}</dt><dd className="mt-1 break-words whitespace-pre-wrap text-xs font-semibold text-[var(--on-surface)]">{display(value)}</dd></div>)}
                  <div className="col-span-full bg-[var(--surface-lowest)] px-3 py-3"><dt className="text-[10px] font-medium uppercase tracking-wide text-[var(--on-surface-subtle)]">Product description</dt><dd className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{display(record.product_description)}</dd></div>
                </dl>
              </section>

              {outputPath && <section className="rounded-xl bg-[var(--surface-low)] p-3.5"><p className="text-[10px] font-bold uppercase tracking-wide text-[var(--on-surface-subtle)]">Studio output</p><div className="mt-2 flex min-w-0 items-center justify-between gap-3"><span className="min-w-0 break-all font-mono text-xs text-[var(--on-surface)]">{outputPath}</span>{outputHref && <a href={outputHref} target="_blank" rel="noreferrer" className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-2.5 text-[11px] font-semibold text-[var(--accent-primary)]"><ExternalLink className="h-3.5 w-3.5" />Open</a>}</div></section>}

              {canReview && !outputPath && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">No Studio mockup link is attached. Return this request to Studio with a note before it can be approved.</p>}{canReview && <section className="space-y-3 rounded-xl bg-[var(--surface-low)] p-4"><div><h3 className="text-sm font-bold">Sampling decision</h3><p className="mt-1 text-xs text-[var(--on-surface-muted)]">Return requires a note. Approval sends this request to Marketing for final acceptance.</p></div><label htmlFor="mockup-review-note" className="block text-xs font-semibold">Review note <span className="font-normal text-[var(--on-surface-subtle)]">(required when returning)</span><textarea id="mockup-review-note" rows={3} maxLength={4000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="What did you check? What should Studio change?" className="mt-1.5 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-3 text-xs font-normal outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20" /></label></section>}
              {record.current_stage === "sampling_review" && !canReview && !readOnlyTeamHead(user) && <p className="rounded-lg bg-[var(--surface-low)] px-3 py-2.5 text-xs text-[var(--on-surface-muted)]">{isClaimed ? `This review is assigned to ${data.claimedBy || "another Sampling teammate"}.` : "Claim this review to unlock the decision controls."}</p>}
              {readOnlyTeamHead(user) && <p className="rounded-lg bg-[var(--surface-low)] px-3 py-2.5 text-xs text-[var(--on-surface-muted)]">You have read-only access to this request.</p>}
            </div>

            <aside className="min-w-0">
              <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wide text-[var(--on-surface-subtle)]">Activity history</h3><span className="rounded-full bg-[var(--surface-low)] px-2 py-0.5 text-[10px] text-[var(--on-surface-muted)]">{record.logs.length}</span></div>
              <ol className="max-h-[560px] space-y-3 overflow-y-auto rounded-xl bg-[var(--surface-low)] p-4">{record.logs.map((log) => <li key={log.id} className="relative border-l border-[var(--border-subtle)] pb-1 pl-4 last:border-transparent"><span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-[var(--accent-primary)]" /><p className="text-xs font-semibold">{formatWorkflowAction(log.action)}</p>{log.from_stage && log.to_stage && log.from_stage !== log.to_stage && <p className="mt-1 flex items-center gap-1 text-[10px] text-[var(--on-surface-muted)]">{stageLabels[log.from_stage] || log.from_stage}<ArrowRight className="h-3 w-3" />{stageLabels[log.to_stage] || log.to_stage}</p>}<p className="mt-1 text-[10px] text-[var(--on-surface-muted)]">{log.actor_name} · {log.actor_team}</p><p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--on-surface-subtle)]"><Clock3 className="h-3 w-3" />{formatDate(log.created_at)}</p>{typeof log.details.remark === "string" && log.details.remark && <p className="mt-1 whitespace-pre-wrap break-words text-[11px] text-[var(--on-surface-muted)]">{log.details.remark}</p>}</li>)}{!record.logs.length && <li className="text-xs text-[var(--on-surface-muted)]">No activity has been recorded yet.</li>}</ol>
            </aside>
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-4 py-3 sm:px-6">
          <p className="hidden items-center gap-1.5 text-[10px] text-[var(--on-surface-subtle)] sm:flex"><Clock3 className="h-3.5 w-3.5" />Last updated {formatDate(record.updated_at)}</p>
          <div className="ml-auto flex w-full flex-wrap justify-end gap-2 sm:w-auto"><button type="button" disabled={saving} onClick={onClose} className="min-h-10 rounded-lg border border-[var(--border-subtle)] px-4 text-xs font-semibold hover:bg-[var(--surface-low)] disabled:opacity-50">Close</button>{canReview && <><button type="button" disabled={saving || !note.trim()} onClick={() => void submit("return")} className="min-h-10 rounded-lg border border-[var(--border-subtle)] px-4 text-xs font-semibold disabled:opacity-50">{saving ? "Saving…" : "Return to Studio"}</button><button type="button" disabled={saving || !canApprove} title={!canApprove ? "Add a Studio mockup link before approving" : undefined} onClick={() => void submit("approve")} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 text-xs font-bold text-white disabled:opacity-50"><Check className="h-4 w-4" />{saving ? "Saving…" : "Approve for Marketing"}</button></>}</div>
        </footer>
      </section>
    </div>
  );
};

export default MockupSamplingInspectorModal;
