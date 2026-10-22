import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, CircleX, LoaderCircle, X } from "lucide-react";
import { readAuthUser } from "@/lib/session";
import type { UserProfile } from "@/features/auth";
import {
  closeRequestApi,
  fetchRequestClosureApi,
  type RequestClosureRecord,
  type RequestClosureType,
} from "@/infrastructure/api/requestClosuresApi";

export interface RequestClosureTarget {
  type: RequestClosureType;
  id: number | string;
}

interface RequestClosureControlProps {
  requests: RequestClosureTarget[];
  canClose: boolean;
  onClosed?: () => void | Promise<void>;
}

const REQUEST_TYPE_LABELS: Record<RequestClosureType, string> = {
  design: "Design",
  mockup: "Mockup",
  sample: "Sampling",
  costing: "Costing",
  feasibility: "Feasibility check",
};

function formatClosedAt(value: string | null) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function readableError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Could not save the closure. Check your connection and try again.";
}

export const RequestClosureControl: React.FC<RequestClosureControlProps> = ({
  requests,
  canClose,
  onClosed,
}) => {
  const requestKey = requests
    .map((target) => `${target.type}:${String(target.id)}`)
    .join("|");
  const targets = useMemo(() => {
    const seen = new Set<string>();
    return requests.flatMap((target) => {
      const id = Number(target.id);
      const key = `${target.type}:${id}`;
      if (!Number.isSafeInteger(id) || id < 1 || seen.has(key)) return [];
      seen.add(key);
      return [{ ...target, id, key }];
    });
    // requestKey keeps this list stable when its caller recreates the array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const [closures, setClosures] = useState<Record<string, RequestClosureRecord | null>>({});
  const [statusErrors, setStatusErrors] = useState<Record<string, string>>({});
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [reason, setReason] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const user = useMemo(() => readAuthUser<UserProfile>(), []);
  const reasonRequired = String(user?.team || "").toLowerCase().includes("marketing");

  const refreshStatus = useCallback(async () => {
    if (!targets.length) {
      setClosures({});
      setStatusErrors({});
      setIsLoadingStatus(false);
      return;
    }
    setIsLoadingStatus(true);
    const results = await Promise.all(targets.map(async (target) => {
      try {
        return [target.key, await fetchRequestClosureApi(target.type, target.id), null] as const;
      } catch (error) {
        return [target.key, null, readableError(error)] as const;
      }
    }));
    const next: Record<string, RequestClosureRecord | null> = {};
    const nextErrors: Record<string, string> = {};
    for (const [key, closure, error] of results) {
      next[key] = closure;
      if (error) nextErrors[key] = error;
    }
    setClosures(next);
    setStatusErrors(nextErrors);
    setIsLoadingStatus(false);
  }, [targets]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!isDialogOpen) return;
    const firstOpen = targets.find((target) => !closures[target.key]);
    setSelectedKey(firstOpen?.key || targets[0]?.key || "");
    setReason("");
    setSaveError(null);
    dialogRef.current?.focus();
  }, [isDialogOpen, requestKey]);

  useEffect(() => {
    if (!isDialogOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) setIsDialogOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDialogOpen, isSaving]);

  if (!targets.length || !canClose) return null;

  const closedCount = targets.filter((target) => Boolean(closures[target.key])).length;
  const areAllClosed = closedCount === targets.length;
  const selectedTarget = targets.find((target) => target.key === selectedKey) || targets[0];
  const selectedClosure = selectedTarget ? closures[selectedTarget.key] : null;
  const statusError = selectedTarget ? statusErrors[selectedTarget.key] || null : null;
  const showAction = canClose;

  const handleCloseRequest = async () => {
    if (!selectedTarget || selectedClosure || isSaving) return;
    if (reasonRequired && !reason.trim()) {
      setSaveError("Add a reason before closing this request.");
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const closure = await closeRequestApi(selectedTarget.type, selectedTarget.id, reason.trim());
      setClosures((current) => ({ ...current, [selectedTarget.key]: closure }));
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("app:request-closed", {
            detail: {
              requestType: selectedTarget.type,
              requestId: selectedTarget.id,
              closure,
            },
          })
        );
      }
      setReason("");
      await onClosed?.();
    } catch (error) {
      setSaveError(readableError(error));
      await refreshStatus();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {showAction && (
        <button
          type="button"
          onClick={() => setIsDialogOpen(true)}
          disabled={isLoadingStatus}
          aria-label={areAllClosed ? "View request closure details" : "Close request"}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50 disabled:cursor-wait disabled:opacity-60 ${
            areAllClosed
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
          }`}
        >
          {isLoadingStatus ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : areAllClosed ? (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <CircleX className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>
            {areAllClosed
              ? "Closed"
              : closedCount > 0
                ? `Close request (${closedCount}/${targets.length})`
                : "Close request"}
          </span>
        </button>
      )}

      {isDialogOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/55 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) setIsDialogOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-closure-title"
            tabIndex={-1}
            className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-5 text-[var(--on-surface)] shadow-[0_24px_70px_-12px_rgba(11,28,48,0.35)] outline-none"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="request-closure-title" className="text-base font-semibold">Request closure</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--on-surface-muted)]">
                  Review closure status or close an open request scope.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSaving}
                aria-label="Close dialog"
                className="rounded-md p-1.5 text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50 disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

              {statusError && (
              <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">{statusError}</div>
                <button type="button" onClick={() => void refreshStatus()} className="shrink-0 font-semibold underline underline-offset-2">Retry</button>
              </div>
            )}

            <div className="mt-5 space-y-4">
              {targets.length > 1 && (
                <label className="block space-y-1.5 text-xs font-medium">
                  <span>Request type</span>
                  <select
                    value={selectedTarget?.key || ""}
                    onChange={(event) => {
                      setSelectedKey(event.target.value);
                      setReason("");
                      setSaveError(null);
                    }}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/40"
                  >
                    {targets.map((target) => (
                      <option key={target.key} value={target.key}>
                        {REQUEST_TYPE_LABELS[target.type]}{closures[target.key] ? " · Closed" : " · Open"}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {selectedClosure ? (
                <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm dark:border-emerald-900/70 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-2 font-semibold text-emerald-900 dark:text-emerald-100">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    {selectedTarget ? REQUEST_TYPE_LABELS[selectedTarget.type] : "Request"} closed
                  </div>
                  <dl className="mt-3 space-y-2 text-xs leading-5 text-emerald-950/85 dark:text-emerald-100/85">
                    {selectedClosure.request_code && (
                      <div><dt className="inline font-semibold">Request code: </dt><dd className="inline font-mono">{selectedClosure.request_code}</dd></div>
                    )}
                    <div><dt className="inline font-semibold">Closed by: </dt><dd className="inline break-words">{selectedClosure.closed_by}</dd></div>
                    <div><dt className="inline font-semibold">When: </dt><dd className="inline">{formatClosedAt(selectedClosure.closed_at)}</dd></div>
                    {selectedClosure.reason && (
                      <div><dt className="font-semibold">Reason</dt><dd className="mt-0.5 whitespace-pre-wrap break-words">{selectedClosure.reason}</dd></div>
                    )}
                  </dl>
                </section>
              ) : canClose ? (
                <>
                  <div className="rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2.5 text-xs leading-5 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/20 dark:text-rose-100">
                    This records a closure for {selectedTarget ? REQUEST_TYPE_LABELS[selectedTarget.type] : "this request"}.
                  </div>
                  <label className="block space-y-1.5 text-xs font-medium" htmlFor="request-closure-reason">
                    <span>Reason{reasonRequired ? " · required" : " · optional"}</span>
                    <textarea
                      id="request-closure-reason"
                      value={reason}
                      onChange={(event) => {
                        setReason(event.target.value);
                        if (saveError) setSaveError(null);
                      }}
                      maxLength={1000}
                      rows={4}
                      required={reasonRequired}
                      aria-describedby="request-closure-reason-hint"
                      placeholder="Explain why this request is being closed."
                      className="w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-sm leading-5 text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/40"
                    />
                  </label>
                  <div id="request-closure-reason-hint" className="-mt-3 text-[11px] text-[var(--on-surface-muted)]">
                    {reasonRequired ? "Marketing closures need a reason." : "Up to 1,000 characters."}
                    <span className="float-right tabular-nums">{reason.length}/1000</span>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-3 py-3 text-sm text-[var(--on-surface-muted)]">
                  This request is still open.
                </div>
              )}

              {saveError && <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300">{saveError}</p>}

              <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSaving}
                  className="rounded-lg border border-[var(--border-subtle)] px-3.5 py-2 text-xs font-semibold text-[var(--on-surface)] hover:bg-[var(--surface-low)] disabled:opacity-50"
                >
                  Done
                </button>
                {canClose && !selectedClosure && (
                  <button
                    type="button"
                    onClick={() => void handleCloseRequest()}
                    disabled={isSaving || (reasonRequired && !reason.trim()) || isLoadingStatus || Boolean(statusError)}
                    className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving && <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    {isSaving ? "Closing…" : "Confirm closure"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

export default RequestClosureControl;
