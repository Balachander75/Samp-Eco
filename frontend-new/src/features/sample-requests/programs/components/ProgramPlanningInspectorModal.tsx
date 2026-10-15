import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Clipboard, Copy, FileSpreadsheet, MessageSquareText, X } from "lucide-react";
import { SampleRequestItem } from "../../types";
import { UserProfile } from "@/features/auth";
import { ProgramTeamOutputsPanel } from "./ProgramTeamOutputsPanel";
import { fetchProgramRequestApi, markProgramSeenApi, mapProgramRequestToSampleRequest } from "@/infrastructure/api/programsApi";

export interface ProgramPlanningInspectorModalProps {
  request: SampleRequestItem | null;
  isOpen: boolean;
  onClose: () => void;
  mode?: "marketing" | "sampling" | "plant";
  userRole?: string;
  user?: UserProfile | null;
  currentUser?: UserProfile | null;
  onDeleteRequest?: (req: SampleRequestItem) => void;
  readOnly?: boolean;
}

type Section = "plan" | "notes";

export const ProgramPlanningInspectorModal: React.FC<ProgramPlanningInspectorModalProps> = ({
  request,
  isOpen,
  onClose,
  mode = "marketing",
  user,
  currentUser,
  onDeleteRequest,
  readOnly = false,
}) => {
  const [activeRequest, setActiveRequest] = useState<SampleRequestItem | null>(request);
  const [section, setSection] = useState<Section>(mode === "marketing" ? "plan" : "plan");
  const [copiedCode, setCopiedCode] = useState(false);
  const effectiveUser = currentUser || user;
  const isSampling = mode === "sampling";
  const isPlant = mode === "plant";
  const materials = activeRequest?.programMaterials || [];

  useEffect(() => {
    if (!isOpen || !request?.id) return;
    let cancelled = false;
    setActiveRequest(request);
    fetchProgramRequestApi(request.id)
      .then((latest) => {
        if (!cancelled) setActiveRequest(latest);
      })
      .catch(() => {
        // Keep the queue snapshot visible if the detail request temporarily fails.
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, request?.id]);

  useEffect(() => {
    setSection("plan");
  }, [mode, request?.id]);

  useEffect(() => {
    if (!isOpen || !activeRequest?.id) return;
    const department = isSampling ? "sampling" : isPlant ? "plant" : null;
    if (!department || (department === "sampling" ? activeRequest.samplingSeenAt : activeRequest.plantSeenAt)) return;
    markProgramSeenApi(activeRequest.id, { department, actor_name: effectiveUser?.name })
      .then((updated) => setActiveRequest(mapProgramRequestToSampleRequest(updated)))
      .catch(() => {});
  }, [isOpen, isPlant, isSampling, activeRequest?.id, activeRequest?.samplingSeenAt, activeRequest?.plantSeenAt, effectiveUser?.name]);

  const tabs = useMemo(() => [
    { id: "plan" as const, title: "Annual plan", icon: FileSpreadsheet },
    { id: "notes" as const, title: "Team notes", icon: MessageSquareText },
  ], []);

  if (!isOpen || !activeRequest) return null;
  const requestCode = activeRequest.srNumber || activeRequest.materialCode || `PG-${activeRequest.id}`;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-2 sm:p-5" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="program-inspector-title"
        onClick={(event) => event.stopPropagation()}
        className="relative flex h-[92vh] max-h-[92vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-[var(--surface-lowest)] shadow-[0_24px_70px_-12px_rgba(11,28,48,0.25)] border-[var(--border-subtle)] xl:max-w-7xl"
      >
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-base)] px-4 py-2.5 shadow-2xs sm:px-6">
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={onClose} className="rounded-xl bg-[var(--accent-primary)] px-4 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[var(--accent-primary-hover)]">{readOnly ? "Close" : "Save & Close"}</button>
            {!readOnly && <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-3.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200">Discard</button>}
            <span className="mx-1 h-4 w-px bg-slate-200" />
            <button type="button" onClick={() => { void navigator.clipboard.writeText(requestCode); setCopiedCode(true); window.setTimeout(() => setCopiedCode(false), 1500); }} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-[var(--accent-primary-subtle)] hover:text-[var(--accent-primary)]">
              {copiedCode ? <Check className="h-3.5 w-3.5 text-[var(--accent-primary)]" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}{copiedCode ? "Copied" : "Copy Code"}
            </button>
            {!readOnly && onDeleteRequest && <button type="button" onClick={() => onDeleteRequest(activeRequest)} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 hover:text-rose-900">Delete</button>}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1 rounded-xl bg-slate-100/70 p-1 sm:flex">
              {tabs.map(({ id }) => <button key={id} type="button" onClick={() => setSection(id)} className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${section === id ? "bg-white text-[var(--accent-primary)] shadow-sm ring-1 ring-[var(--accent-primary)]/20" : "text-slate-500 hover:text-slate-800"}`}>{id === "plan" ? "1. Annual Plan" : "2. Team Notes"}</button>)}
            </div>
            <button type="button" onClick={onClose} aria-label="Close inspector" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"><X className="h-4 w-4" /></button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <main className="min-w-0 flex-1 overflow-y-auto bg-[var(--bg-app)] p-4 md:p-6">
            <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-2xs">
              <div className="border-b border-slate-100 bg-[var(--surface-lowest)] px-5 py-3 border-[var(--border-subtle)] sm:px-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-lg border border-[var(--accent-primary)]/20 bg-[var(--accent-primary-subtle)] px-2.5 py-0.5 font-mono text-xs font-bold text-[var(--accent-primary)]">{requestCode}</span>
                    <span className="text-slate-300">/</span><span className="text-xs font-semibold text-slate-500">Program Planning Sheet</span>
                  </div>
                  <span className="rounded-lg border border-[var(--accent-primary)]/20 bg-[var(--accent-primary-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-primary)]">{materials.length} plan {materials.length === 1 ? "line" : "lines"}</span>
                </div>
              </div>
              <div className="px-5 pt-5 sm:px-8">
                <h1 id="program-inspector-title" className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 sm:text-3xl">{activeRequest.programName || "Annual plan"}</h1>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400"><span>{activeRequest.customer}</span><span>·</span><span>{activeRequest.programYear || "Program year"}</span><span>·</span><span>Created by {activeRequest.createdBy || "Marketing"}</span></p>
              </div>
            <nav aria-label="Program sections" className="mt-4 flex gap-6 overflow-x-auto border-b border-slate-100 px-5 dark:border-white/10 sm:px-8">
              {tabs.map(({ id, title, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setSection(id)} className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 text-xs font-semibold transition ${section === id ? "border-emerald-600 text-[var(--accent-primary)] dark:text-[var(--accent-primary)]" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"}`}>
                  <Icon className="h-3.5 w-3.5" />{title}
                  {id === "notes" && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{(activeRequest.activities || []).filter((activity: any) => ["SAMP_OUTPUT", "PLANT_OUTPUT"].includes(activity.action)).length}</span>}
                </button>
              ))}
            </nav>

            {section === "plan" ? (
              <div className="p-5 dark:text-zinc-100 sm:p-8">
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Customer</p><p className="mt-1 text-sm font-semibold text-slate-900">{activeRequest.customer || "—"}</p></div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Program year</p><p className="mt-1 text-sm font-semibold text-slate-900">{activeRequest.programYear || "—"}</p></div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Plan lines</p><p className="mt-1 text-sm font-semibold text-slate-900">{materials.length}</p></div>
                </div>

                {materials.length ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3"><Clipboard className="h-4 w-4 text-emerald-700 dark:text-emerald-400" /><h2 className="text-sm font-semibold text-slate-900">Marketing annual material plan</h2></div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr>{["Material", "Supplier", "Grade", "Color", "Caliper / weight", "Quantity", "Marketing note"].map((name) => <th key={name} className="px-3 py-2.5 font-semibold">{name}</th>)}</tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {materials.map((material, index) => <tr key={material.id ?? index} className="align-top hover:bg-slate-50/70"><td className="px-3 py-3 font-medium text-slate-900">{material.materialType || "—"}</td><td className="px-3 py-3 text-slate-700">{material.supplierName || "—"}</td><td className="px-3 py-3 text-slate-700">{material.grade || "—"}</td><td className="px-3 py-3 text-slate-700">{material.colorVariant || "—"}</td><td className="px-3 py-3 text-slate-700">{material.caliperWt || "—"}</td><td className="px-3 py-3 text-slate-700">{material.quantity ? `${material.quantity} ${material.unit || ""}` : "—"}</td><td className="max-w-[280px] whitespace-pre-wrap px-3 py-3 text-slate-600">{material.remark || "—"}</td></tr>)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center text-sm text-slate-500">Marketing has not added material lines to this annual plan yet.</div>
                )}

                <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/80 dark:bg-emerald-950/20 px-4 py-3 text-xs leading-5 text-emerald-900 dark:text-emerald-200">
                  <Check className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                  {isSampling ? "Review the plan and add SAMP planning ideas under Team notes." : isPlant ? "Review the plan and add Plant material needs under Team notes." : "Team notes are saved with this plan. Pin a useful SAMP or Plant note and add your response."}
                </div>
              </div>
            ) : (
              <div className="p-5 dark:text-zinc-100 sm:p-8">
                <div className="mx-auto max-w-xl rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-5">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Planning notes and replies</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">Use the Team notes panel to share an idea, pin a useful note, or respond to a pinned note.</p>
                </div>
                <div className="mx-auto mt-4 min-h-[350px] max-w-xl xl:hidden">
                  <ProgramTeamOutputsPanel request={activeRequest} mode={mode} onUpdated={setActiveRequest} readOnly={readOnly} />
                </div>
              </div>
            )}
            </div>
          </main>

          <div className="hidden min-h-0 w-80 shrink-0 bg-[var(--surface-lowest)] border-[var(--border-subtle)] xl:flex lg:w-[390px]">
            <ProgramTeamOutputsPanel request={activeRequest} mode={mode} onUpdated={setActiveRequest} readOnly={readOnly} />
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
};

export default ProgramPlanningInspectorModal;
