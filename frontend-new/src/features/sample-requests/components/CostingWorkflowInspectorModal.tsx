import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Check, Clock3, ExternalLink, FileSpreadsheet, X } from "lucide-react";
import type { UserProfile } from "@/features/auth";
import { completeCostingWorkflowApi, releaseCostingWorkflowApi, reviewRequestWorkflowApi, type RequestWorkflowRecord } from "@/infrastructure/api";
import { fetchProductClassSpecificationsApi, type ProductDetailItem } from "@/infrastructure/api/masterApi";
import { isMockupCreativeCharacteristic } from "@/features/sample-requests/components/staging/mockupCreativeFields";
import { ProductDocketView } from "@/features/sample-requests/components/staging/ProductDocketView";
import type { ProductSearchResult } from "@/features/sample-requests/types";
import { WorkflowStageRail } from "./WorkflowStageRail";
import { formatWorkflowAction } from "./workflowPresentation";

type InspectorMode = "creative" | "costing" | "sampling";

interface CostingWorkflowInspectorModalProps {
  record: RequestWorkflowRecord;
  mode: InspectorMode;
  user?: UserProfile | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

const stages = [
  { key: "marketing", label: "Marketing" },
  { key: "creative", label: "Creative" },
  { key: "costing", label: "Costing" },
  { key: "sampling_review", label: "Sampling review" },
];

const stageLabels: Record<string, string> = {
  marketing: "Marketing intake",
  creative: "Creative review",
  costing: "Costing work",
  sampling_review: "Sampling review",
  done: "Closed",
};

function display(value: unknown) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function isReadOnlyTeamHead(user?: UserProfile | null) {
  return Boolean(user?.is_team_head) && !["admin", "administrator"].includes(String(user?.role || "").toLowerCase());
}

function externalUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : undefined;
}

function isMissingSpecificationValue(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return !normalized || ["NA", "N/A", "NAN", "NULL", "NONE", "-", "—"].includes(normalized);
}

export const CostingWorkflowInspectorModal: React.FC<CostingWorkflowInspectorModalProps> = ({ record, mode, user, onClose, onSaved }) => {
  const [outputPath, setOutputPath] = useState(record.costing_output_path || "");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productSpecifications, setProductSpecifications] = useState<ProductDetailItem[]>([]);
  const [isLoadingSpecifications, setIsLoadingSpecifications] = useState(false);
  const [specificationsLoadError, setSpecificationsLoadError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const savingRef = useRef(isSaving);
  closeRef.current = onClose;
  savingRef.current = isSaving;
  const readOnly = isReadOnlyTeamHead(user);
  const requestData = record.request_data || {};
  const creativeDeadline = record.creative_due_at ? new Date(record.creative_due_at) : null;
  const creativeDeadlineLabel = creativeDeadline && !Number.isNaN(creativeDeadline.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(creativeDeadline)
    : null;
  const canSubmitCosting = mode === "costing" && record.current_stage === "costing" && !readOnly;
  const canReview = mode === "sampling" && record.current_stage === "sampling_review" && !readOnly;
  const canReleaseToCosting = mode === "creative" && record.current_stage === "creative" && !readOnly;
  const specificationGroups = useMemo(() => {
    const groups = new Map<string, ProductDetailItem[]>();
    productSpecifications.forEach((item) => {
      const current = groups.get(item.className) || [];
      current.push(item);
      groups.set(item.className, current);
    });
    return [...groups.entries()];
  }, [productSpecifications]);
  const creativeFields = useMemo(
    () => productSpecifications.filter((item) => isMockupCreativeCharacteristic(item.className, item.characteristicName)),
    [productSpecifications],
  );
  const missingCreativeFields = useMemo(
    () => creativeFields.filter((item) => isMissingSpecificationValue(item.value)),
    [creativeFields],
  );
  const stagePosition = record.current_stage === "done" ? "Workflow complete" : stageLabels[record.current_stage] || record.current_stage;
  const actionSummary = canSubmitCosting
    ? { title: "Your next step: submit the costing sheet", detail: "Add the workbook link and send the completed costing to Sampling for review." }
    : canReleaseToCosting
      ? { title: "Your next step: review product specifications", detail: "Complete every highlighted Creative field, then pass the full class and specification list to Costing." }
    : canReview
      ? { title: "Your next step: review the costing output", detail: "Approve to close this costing workflow, or return it to Costing with a clear note." }
      : readOnly
        ? { title: "Read-only view", detail: `This request is currently at ${stagePosition}. Your team-head access lets you inspect the brief and activity history.` }
        : { title: `Waiting at ${stagePosition}`, detail: record.current_stage === "done" ? "This costing workflow has been approved and closed." : `The ${stageLabels[record.current_stage] || record.current_stage} team owns the next action.` };

  useEffect(() => {
    setOutputPath(record.costing_output_path || "");
    setNotes("");
    setError(null);
    setProductSpecifications([]);
    setSpecificationsLoadError(null);
    setIsLoadingSpecifications(true);
    let cancelled = false;
    fetchProductClassSpecificationsApi(record.sample_request_id)
      .then((details) => {
        if (cancelled) return;
        setProductSpecifications(details);
      })
      .catch(() => {
        if (!cancelled) {
          setProductSpecifications([]);
          setSpecificationsLoadError("Product classes and specifications could not be loaded. Close this request and try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSpecifications(false);
      });
    return () => { cancelled = true; };
  }, [record.sample_request_id, record.costing_output_path]);

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

  const save = async (decision?: "approve" | "return") => {
    if (decision === "return" && !notes.trim()) {
      setError("Add a review note before returning this request.");
      return;
    }
    if (!decision && mode === "costing" && !outputPath.trim()) {
      setError("Add the costing sheet link or file path before submitting.");
      return;
    }
    if (!decision && mode === "creative" && missingCreativeFields.length) {
      setError(`Complete the ${missingCreativeFields.length} highlighted Creative specification field${missingCreativeFields.length === 1 ? "" : "s"} before sending to Costing.`);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      if (mode === "creative") {
        await releaseCostingWorkflowApi(record.sample_request_id, {
          specifications: productSpecifications.map(({ className, characteristicName, value, uom }) => ({ className, characteristicName, value, uom })),
          note: notes.trim(),
        });
      } else if (decision) {
        await reviewRequestWorkflowApi("costing", record.sample_request_id, { decision, remark: notes.trim() });
      } else {
        await completeCostingWorkflowApi(record.sample_request_id, { outputPath: outputPath.trim(), notes: notes.trim() });
      }
      await onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this workflow update.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && !isSaving && onClose()}>
        <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="costing-inspector-title" aria-describedby="costing-inspector-summary" className="flex max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-[var(--surface-lowest)] text-[var(--on-surface)] shadow-2xl outline-none sm:max-h-[92dvh] sm:rounded-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><FileSpreadsheet className="h-5 w-5" /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h2 id="costing-inspector-title" className="text-base font-bold tracking-tight">{mode === "creative" ? "Creative Costing request" : "Costing request"}</h2><span className="rounded-full bg-[var(--surface-low)] px-2.5 py-1 text-[10px] font-semibold">{record.status}</span></div>
              <p className="mt-1 break-words text-xs text-[var(--on-surface-muted)]"><span className="font-mono font-semibold text-[var(--on-surface)]">{record.sr_number}</span><span className="px-1.5">·</span>{record.product_description || "Product request"}<span className="px-1.5">·</span>{record.customer}</p>
            </div>
          </div>
          <button type="button" aria-label="Close costing inspection" disabled={isSaving} onClick={onClose} className="rounded-lg p-2 text-[var(--on-surface-muted)] transition-colors hover:bg-[var(--surface-low)] disabled:opacity-50"><X className="h-4 w-4" /></button>
        </header>

        <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-low)]/60 px-4 py-3 sm:px-6">
          <WorkflowStageRail stages={stages} current={record.current_stage} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {error && <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-xs text-rose-800 dark:bg-rose-950/30 dark:text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(270px,0.68fr)]">
            <div className="min-w-0 space-y-4">
              <section className="rounded-xl border border-[var(--border-subtle)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--on-surface-subtle)]">Current step</p>
                <h3 className="mt-1 text-sm font-bold">{actionSummary.title}</h3>
                <p id="costing-inspector-summary" className="mt-1 text-xs leading-relaxed text-[var(--on-surface-muted)]">{actionSummary.detail}</p>
              </section>

              {record.costing_creative_input_needed && <section className="space-y-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-bold text-[var(--on-surface)]">Creative input requested by Marketing</h3>{creativeDeadlineLabel && <span className="text-[10px] font-semibold text-[var(--accent-primary)]">Complete by {creativeDeadlineLabel} IST</span>}</div>
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--on-surface-muted)]">{record.costing_creative_input_remark?.trim() || "Marketing requested Creative review without an additional remark."}</p>
                {mode === "creative" && <p className="text-[10px] text-[var(--on-surface-subtle)]">Creative’s turnaround is 2 working days from submission. Costing required date remains the Costing team’s deadline.</p>}
              </section>}

              <section>
                <div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-xs font-bold uppercase tracking-wide text-[var(--on-surface-subtle)]">Product and Costing inputs</h3><span className="text-[10px] text-[var(--on-surface-subtle)]">From Marketing</span></div>
                <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-[var(--border-subtle)] sm:grid-cols-3">
                  {[
                    ["Customer", record.customer], ["Brand", record.brand_name], ["Material code", record.material_code],
                    ["Customer SKU", requestData.customer_product_code], ["Barcode", requestData.barcode],
                    ["Quantity for Costing", requestData.quantity], ["Unit", requestData.unit_pc_pack],
                    ["Pieces per pack", requestData.unit_pc_pack === "Pack" ? requestData.qty_per_pack : "Not applicable"],
                    ["Category", requestData.category], ["Required date", requestData.required_date],
                  ].map(([label, value]) => <div key={String(label)} className="min-w-0 bg-[var(--surface-lowest)] px-3 py-3"><dt className="text-[10px] font-medium uppercase tracking-wide text-[var(--on-surface-subtle)]">{String(label)}</dt><dd className="mt-1 break-words text-xs font-semibold text-[var(--on-surface)]">{display(value)}</dd></div>)}
                  <div className="col-span-full bg-[var(--surface-lowest)] px-3 py-3"><dt className="text-[10px] font-medium uppercase tracking-wide text-[var(--on-surface-subtle)]">Product description</dt><dd className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[var(--on-surface)]">{display(record.product_description)}</dd></div>
                </dl>
              </section>

              <section aria-labelledby="costing-product-specifications-title" className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div><h3 id="costing-product-specifications-title" className="text-xs font-bold uppercase tracking-wide text-[var(--on-surface-subtle)]">Product class & specifications</h3><p className="mt-1 text-[11px] text-[var(--on-surface-muted)]">{productSpecifications.length ? `${specificationGroups.length} product classes · ${productSpecifications.length} specifications` : "Product details linked to this request"}</p></div>
                  {mode === "creative" && creativeFields.length > 0 && <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${missingCreativeFields.length ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>{missingCreativeFields.length ? `${missingCreativeFields.length} Creative fields need values` : "Creative fields complete"}</span>}
                </div>
                {isLoadingSpecifications ? <p role="status" className="rounded-xl bg-[var(--surface-low)] px-3 py-4 text-xs text-[var(--on-surface-muted)]">Loading product classes and specifications…</p> : specificationsLoadError ? <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-3 text-xs text-rose-800 dark:text-rose-200">{specificationsLoadError}</p> : productSpecifications.length ? <div className="space-y-4">
                  <div className="overflow-x-auto rounded-xl border border-sky-300 bg-white p-2 dark:border-sky-900 dark:bg-zinc-950 sm:p-3">
                    <div className="min-w-[740px]">
                      <ProductDocketView
                        product={{
                          id: Number(record.sample_request_id),
                          sr_number: record.sr_number,
                          material_code: record.material_code || "",
                          product_description: record.product_description || "",
                          customer: record.customer || "",
                          source_sample_code: [requestData.barcode, requestData.customer_product_code].filter(Boolean).join(" / "),
                          brand: record.brand_name || "",
                        } as ProductSearchResult & { brand?: string }}
                        classGroups={specificationGroups}
                        containerId={`costing-docket-${record.sample_request_id}`}
                      />
                    </div>
                  </div>
                  {mode === "creative" && <div className="space-y-3">
                  {specificationGroups.map(([className, details]) => <section key={className} className="overflow-hidden rounded-xl bg-[var(--surface-low)]">
                    <h4 className="px-3 py-2.5 text-xs font-bold text-[var(--on-surface)]">{className}<span className="ml-2 font-normal text-[10px] text-[var(--on-surface-subtle)]">{details.length} specifications</span></h4>
                    <div className="divide-y divide-[var(--border-subtle)]/60">
                      {details.map((detail) => {
                        const isCreativeField = isMockupCreativeCharacteristic(detail.className, detail.characteristicName);
                        const value = String(detail.value ?? "");
                        return <div key={`${detail.className}::${detail.characteristicName}`} className="grid grid-cols-[minmax(0,1fr)_minmax(120px,0.9fr)_auto] items-center gap-3 bg-[var(--surface-lowest)] px-3 py-2.5">
                          <div className="min-w-0"><p className="break-words text-[11px] font-medium text-[var(--on-surface)]">{detail.characteristicName}</p>{mode === "creative" && isCreativeField && <span className="mt-1 inline-flex rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] font-semibold text-violet-700 dark:text-violet-300">Creative input</span>}</div>
                          {mode === "creative" && isCreativeField ? <input aria-label={`${className} ${detail.characteristicName}`} value={isMissingSpecificationValue(value) ? "" : value} onChange={(event) => setProductSpecifications((current) => current.map((item) => item.className === detail.className && item.characteristicName === detail.characteristicName ? { ...item, value: event.target.value } : item))} placeholder="Enter specification" className="h-9 min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-2.5 text-xs outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20" /> : <span className="min-w-0 break-words text-xs font-semibold text-[var(--on-surface)]">{display(detail.value)}</span>}
                          <span className="min-w-8 text-right text-[10px] text-[var(--on-surface-subtle)]">{display(detail.uom)}</span>
                        </div>;
                      })}
                    </div>
                  </section>)}
                  </div>}
                </div> : <p className="rounded-xl bg-amber-500/10 px-3 py-3 text-xs text-amber-800 dark:text-amber-200">No product class or specification rows are attached yet. Ask Marketing to add the product specifications before Costing proceeds.</p>}
              </section>

              {record.costing_output_path && <section className="rounded-xl bg-[var(--surface-low)] p-3.5"><p className="text-[10px] font-bold uppercase tracking-wide text-[var(--on-surface-subtle)]">Costing sheet already attached</p><div className="mt-2 flex min-w-0 items-center justify-between gap-3"><span className="min-w-0 break-all font-mono text-xs text-[var(--on-surface)]">{record.costing_output_path}</span>{externalUrl(record.costing_output_path) && <a href={externalUrl(record.costing_output_path)} target="_blank" rel="noreferrer" aria-label="Open costing sheet" className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-2.5 text-[11px] font-semibold text-[var(--accent-primary)]"><ExternalLink className="h-3.5 w-3.5" />Open</a>}</div>{record.costing_notes && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[var(--on-surface-muted)]">{record.costing_notes}</p>}</section>}

              {canSubmitCosting && <section className="space-y-3 rounded-xl bg-[var(--surface-low)] p-4">
                <div><h3 className="text-sm font-bold">Complete Costing</h3><p className="mt-1 text-xs text-[var(--on-surface-muted)]">Attach the saved workbook, then pass it to Sampling for review.</p></div>
                <label htmlFor="costing-output-path" className="block text-xs font-semibold">Costing sheet link or file path <span className="text-rose-600">*</span><input id="costing-output-path" value={outputPath} onChange={(event) => setOutputPath(event.target.value)} maxLength={4000} placeholder="Paste the costing workbook link or shared path" className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-3 text-xs font-normal outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20" /></label>
                <label htmlFor="costing-notes" className="block text-xs font-semibold">Handoff note <span className="font-normal text-[var(--on-surface-subtle)]">(optional)</span><textarea id="costing-notes" rows={3} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add assumptions or context for the reviewer" className="mt-1.5 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-3 text-xs font-normal outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20" /></label>
              </section>}

              {canReview && <section className="space-y-3 rounded-xl bg-[var(--surface-low)] p-4">
                <div><h3 className="text-sm font-bold">Sampling review</h3><p className="mt-1 text-xs text-[var(--on-surface-muted)]">Approve to close, or return the request to Costing. A note is required when returning.</p></div>
                <label htmlFor="costing-review-note" className="block text-xs font-semibold">Review note<textarea id="costing-review-note" rows={3} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What did you verify? What should Costing change?" className="mt-1.5 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-3 text-xs font-normal outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20" /></label>
              </section>}

              {canReleaseToCosting && <section className="space-y-3 rounded-xl bg-[var(--surface-low)] p-4">
                <div><h3 className="text-sm font-bold">Creative handoff</h3><p className="mt-1 text-xs text-[var(--on-surface-muted)]">Costing receives the product classes, specification values, quantity, and unit from this request.</p></div>
                <label htmlFor="creative-costing-note" className="block text-xs font-semibold">Handoff note <span className="font-normal text-[var(--on-surface-subtle)]">(optional)</span><textarea id="creative-costing-note" rows={2} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add context for the Costing team" className="mt-1.5 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-3 text-xs font-normal outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20" /></label>
              </section>}

              {readOnly && <p className="rounded-lg bg-[var(--surface-low)] px-3 py-2.5 text-xs text-[var(--on-surface-muted)]">You have read-only access to this request.</p>}
            </div>

            <aside className="min-w-0">
              <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wide text-[var(--on-surface-subtle)]">Activity history</h3><span className="rounded-full bg-[var(--surface-low)] px-2 py-0.5 text-[10px] text-[var(--on-surface-muted)]">{record.logs.length}</span></div>
              <ol className="max-h-[560px] space-y-3 overflow-y-auto rounded-xl bg-[var(--surface-low)] p-4">
                {record.logs.map((log) => <li key={log.id} className="relative border-l border-[var(--border-subtle)] pb-1 pl-4 last:border-transparent"><span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-[var(--accent-primary)]" /><p className="text-xs font-semibold">{formatWorkflowAction(log.action)}</p>{log.from_stage && log.to_stage && log.from_stage !== log.to_stage && <p className="mt-1 flex items-center gap-1 text-[10px] text-[var(--on-surface-muted)]">{stageLabels[log.from_stage] || log.from_stage}<ArrowRight className="h-3 w-3" />{stageLabels[log.to_stage] || log.to_stage}</p>}<p className="mt-1 text-[10px] text-[var(--on-surface-muted)]">{log.actor_name} · {log.actor_team}</p><p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--on-surface-subtle)]"><Clock3 className="h-3 w-3" />{formatDate(log.created_at)}</p>{Boolean((typeof log.details.remark === "string" && log.details.remark) || (typeof log.details.note === "string" && log.details.note)) && <p className="mt-1 whitespace-pre-wrap break-words text-[11px] text-[var(--on-surface-muted)]">{String(log.details.remark || log.details.note)}</p>}</li>)}
                {!record.logs.length && <li className="text-xs text-[var(--on-surface-muted)]">No activity has been recorded yet.</li>}
              </ol>
            </aside>
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-4 py-3 sm:px-6">
          <p className="hidden items-center gap-1.5 text-[10px] text-[var(--on-surface-subtle)] sm:flex"><Clock3 className="h-3.5 w-3.5" />Last updated {formatDate(record.updated_at)}</p>
          <div className="ml-auto flex w-full flex-wrap justify-end gap-2 sm:w-auto">
            <button type="button" disabled={isSaving} onClick={onClose} className="min-h-10 rounded-lg border border-[var(--border-subtle)] px-4 text-xs font-semibold hover:bg-[var(--surface-low)] disabled:opacity-50">Close</button>
            {canSubmitCosting && <button type="button" disabled={isSaving || !outputPath.trim() || isLoadingSpecifications || Boolean(specificationsLoadError) || productSpecifications.length === 0} onClick={() => void save()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? "Submitting…" : "Submit to Sampling"}<ArrowRight className="h-3.5 w-3.5" /></button>}
            {canReleaseToCosting && <button type="button" disabled={isSaving || isLoadingSpecifications || Boolean(specificationsLoadError) || productSpecifications.length === 0 || missingCreativeFields.length > 0} onClick={() => void save()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? "Sending…" : "Send to Costing"}<ArrowRight className="h-3.5 w-3.5" /></button>}
            {canReview && <><button type="button" disabled={isSaving || !notes.trim()} onClick={() => void save("return")} className="min-h-10 rounded-lg border border-[var(--border-subtle)] px-4 text-xs font-semibold disabled:opacity-50">{isSaving ? "Saving…" : "Return to Costing"}</button><button type="button" disabled={isSaving} onClick={() => void save("approve")} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 text-xs font-bold text-white disabled:opacity-50"><Check className="h-4 w-4" />{isSaving ? "Saving…" : "Approve and close"}</button></>}
          </div>
        </footer>
      </section>
    </div>
  );
};

export default CostingWorkflowInspectorModal;
