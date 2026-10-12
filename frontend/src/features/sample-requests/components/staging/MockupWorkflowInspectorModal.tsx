import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import type { ProductSearchResult, SampleRequestItem } from "../../types";
import { fetchProductInspectionDetailsApi, saveProductDetailsApi, type ProductDetailItem } from "@/infrastructure/api/masterApi";
import {
  sendMockupRequestToStudioApi,
  submitStudioMockupToMarketingApi,
} from "@/infrastructure/api/sampleRequestsApi";
import { CatalogProductInspectModal } from "./CatalogProductInspectModal";
import { creativeCharacteristicKey, isListedCreativeCharacteristic } from "./mockupCreativeFields";

export interface MockupWorkflowInspectorModalProps {
  request: SampleRequestItem | null;
  role: "creative" | "studio";
  readOnly?: boolean;
  actorName?: string;
  onClose: () => void;
  onRefresh?: () => Promise<void>;
}

export const MockupWorkflowInspectorModal: React.FC<MockupWorkflowInspectorModalProps> = ({
  request,
  role,
  readOnly = false,
  actorName,
  onClose,
  onRefresh,
}) => {
  const [mockupUrl, setMockupUrl] = useState("");
  const [creativeDetails, setCreativeDetails] = useState<ProductDetailItem[]>([]);
  const [creativeValues, setCreativeValues] = useState<Record<string, string>>({});
  const [creativeShutterstockNo, setCreativeShutterstockNo] = useState("");
  const [creativeRemark, setCreativeRemark] = useState("");
  const [isLoadingCreativeDetails, setIsLoadingCreativeDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMockupUrl(request?.mockupWorkflowState?.mockupUrl || "");
    setCreativeShutterstockNo(request?.mockupWorkflowState?.creativeShutterstockNo || "");
    setCreativeRemark(request?.mockupWorkflowState?.creativeRemark || "");
    setError("");
    setIsSubmitting(false);
  }, [request?.id, request?.mockupWorkflowState?.mockupUrl, request?.mockupWorkflowState?.creativeShutterstockNo, request?.mockupWorkflowState?.creativeRemark]);

  useEffect(() => {
    let cancelled = false;
    const mockupState = request?.mockupWorkflowState;
    setCreativeDetails([]);
    setCreativeValues({});
    if (!request || role !== "creative" || mockupState?.designNeeded !== true) {
      setIsLoadingCreativeDetails(false);
      return;
    }
    setIsLoadingCreativeDetails(true);
    fetchProductInspectionDetailsApi(request.id)
      .then((details) => {
        if (cancelled) return;
        setCreativeDetails(details);
        setCreativeValues(Object.fromEntries(
          details
            .filter((detail) => isListedCreativeCharacteristic(detail, mockupState.creativeCharacteristicKeys))
            .map((detail) => [creativeCharacteristicKey(detail.className, detail.characteristicName), detail.value || ""])
        ));
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the cleared Creative characteristics. Close this view and retry.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCreativeDetails(false);
      });
    return () => { cancelled = true; };
  }, [request?.id, request?.mockupWorkflowState?.designNeeded, request?.mockupWorkflowState?.creativeCharacteristicsClearedAt, request?.mockupWorkflowState?.creativeCharacteristicKeys, role]);

  const product = useMemo<ProductSearchResult | null>(() => {
    if (!request) return null;
    const id = Number(request.id);
    if (!Number.isInteger(id) || id <= 0) return null;
    return {
      id,
      sr_number: request.srNumber,
      material_code: request.materialCode,
      product_description: request.productDescription,
      customer: request.customer,
      target_plant: request.targetPlant,
      product_category: request.productCategory,
      product_sub_category: request.productSubCategory,
      product_third_category: request.productThirdCategory,
    };
  }, [request]);

  if (!request) return null;

  const handleAction = async () => {
    if (!product) {
      setError("This request is missing its saved product record.");
      return;
    }
    if (role === "studio") {
      const val = mockupUrl.trim();
      if (!val) {
        setError("Enter an output file link or local/network file path.");
        return;
      }
      if (val.startsWith("http://") || val.startsWith("https://")) {
        try {
          new URL(val);
        } catch {
          setError("Enter a valid URL or network/file path.");
          return;
        }
      }
    }
    const mockupState = request.mockupWorkflowState;
    const creativeFields = creativeDetails.filter((detail) =>
      isListedCreativeCharacteristic(detail, mockupState?.creativeCharacteristicKeys)
    );
    const requiredKeys = mockupState?.creativeRequiredCharacteristicKeys ?? mockupState?.creativeCharacteristicKeys;
    const requiredCreativeFields = creativeDetails.filter((detail) =>
      isListedCreativeCharacteristic(detail, requiredKeys)
    );
    if (role === "creative" && mockupState?.designNeeded === true) {
      if (!creativeShutterstockNo.trim() && !creativeRemark.trim()) {
        setError("Add a Creative Shutterstock number or remark before sending this Mockup to Studio.");
        return;
      }
      if (requiredCreativeFields.some((detail) => {
        const value = creativeValues[creativeCharacteristicKey(detail.className, detail.characteristicName)]?.trim().toUpperCase();
        return !value || ["NA", "N/A", "NAN", "NULL", "NONE", "-"].includes(value);
      })) {
        setError("Complete each highlighted characteristic before sending this Mockup to Studio.");
        return;
      }
    }

    setIsSubmitting(true);
    setError("");
    try {
      if (role === "creative") {
        if (mockupState?.designNeeded === true && creativeFields.length > 0) {
          const saved = await saveProductDetailsApi(Number(request.id), creativeFields.map((detail) => ({
            className: detail.className,
            characteristicName: detail.characteristicName,
            value: creativeValues[creativeCharacteristicKey(detail.className, detail.characteristicName)]?.trim() || null,
            uom: detail.uom,
          })));
          if (!saved) throw new Error("Creative characteristics could not be saved. Please retry.");
        }
        await sendMockupRequestToStudioApi(request.id, actorName, {
          shutterstockNo: creativeShutterstockNo.trim(),
          remark: creativeRemark.trim(),
        });
      } else {
        await submitStudioMockupToMarketingApi(request.id, mockupUrl.trim(), actorName);
      }
      await onRefresh?.();
      onClose();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not update the output request. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentOutputUrl = request.mockupWorkflowState?.mockupUrl;
  const isWebUrl = currentOutputUrl && (currentOutputUrl.startsWith("http://") || currentOutputUrl.startsWith("https://"));
  const mockupState = request.mockupWorkflowState;
  const creativeFields = creativeDetails.filter((detail) =>
    isListedCreativeCharacteristic(detail, mockupState?.creativeCharacteristicKeys)
  );
  const requiredKeys = mockupState?.creativeRequiredCharacteristicKeys ?? mockupState?.creativeCharacteristicKeys;

  const footer = readOnly ? (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
      <div className="flex items-center justify-between">
        <span>Read-only view. {request.mockupWorkflowState?.claimedBy
          ? `This task is claimed by ${request.mockupWorkflowState.claimedBy}.`
          : "Creative Studio output inspection mode."}</span>
      </div>
      {currentOutputUrl && (
        <div className="mt-1 flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-zinc-800">
          <span className="font-semibold text-slate-700 dark:text-zinc-300">Studio Output:</span>
          <span className="font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-400 truncate max-w-md">{currentOutputUrl}</span>
          {isWebUrl && (
            <a
              href={currentOutputUrl}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 font-semibold"
            >
              Open Link
            </a>
          )}
        </div>
      )}
    </div>
  ) : (
    <div className="flex flex-col gap-3">
      {role === "creative" && mockupState?.designNeeded === true && (
        <section className="max-h-[36vh] space-y-3 overflow-y-auto rounded-xl border border-rose-200 bg-rose-50/70 p-3 dark:border-rose-800/60 dark:bg-rose-950/20">
          <div>
            <h3 className="text-xs font-bold text-rose-950 dark:text-rose-200">Creative handoff details</h3>
          <p className="mt-0.5 text-[11px] text-amber-900/80 dark:text-amber-200/75">{isLoadingCreativeDetails ? "Loading cleared characteristic fields…" : "Complete the highlighted fields and add a Shutterstock number or remark before sending to Studio."}</p>
          </div>
          {creativeFields.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {creativeFields.map((detail) => {
                const key = creativeCharacteristicKey(detail.className, detail.characteristicName);
                return (
                  <label key={key} className="min-w-0 space-y-1 text-[10px] font-semibold text-rose-950 dark:text-rose-100">
                    <span className="block truncate" title={`${detail.className} · ${detail.characteristicName}`}>{detail.className.replace(/_/g, " ")} / {detail.characteristicName.replace(/_/g, " ")}</span>
                    {isListedCreativeCharacteristic(detail, requiredKeys) && <span className="block text-[9px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">Required: this value was cleared for Creative</span>}
                    <input
                      value={creativeValues[key] || ""}
                      onChange={(event) => setCreativeValues((current) => ({ ...current, [key]: event.target.value }))}
                      placeholder="Enter Creative value"
                      className="h-9 w-full rounded-lg border border-rose-300 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 dark:border-rose-800 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-rose-200/80 bg-white/70 px-3 py-2 text-[11px] text-rose-900 dark:border-rose-800/50 dark:bg-white/[0.03] dark:text-rose-200">No Creative-owned characteristics are linked to this product.</p>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-[10px] font-semibold text-rose-950 dark:text-rose-100">Shutterstock No. (optional)
              <input value={creativeShutterstockNo} onChange={(event) => setCreativeShutterstockNo(event.target.value)} placeholder="Enter Shutterstock No." className="h-9 w-full rounded-lg border border-rose-300 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 dark:border-rose-800 dark:bg-zinc-950 dark:text-zinc-100" />
            </label>
            <label className="space-y-1 text-[10px] font-semibold text-rose-950 dark:text-rose-100">Creative remark (optional)
              <input value={creativeRemark} onChange={(event) => setCreativeRemark(event.target.value)} placeholder="Add a short remark" className="h-9 w-full rounded-lg border border-rose-300 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 dark:border-rose-800 dark:bg-zinc-950 dark:text-zinc-100" />
            </label>
          </div>
        </section>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {role === "creative" ? (
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Creative review complete?</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">Send this product brief and Creative’s completed specifications to Studio.</p>
        </div>
      ) : (
        <label className="min-w-0 flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Studio Output Link or File Path</span>
            {request.mockupWorkflowState?.mockupUrl && (
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">Currently Submitted</span>
            )}
          </div>
          <input
            type="text"
            value={mockupUrl}
            onChange={(event) => setMockupUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleAction();
              }
            }}
            placeholder="https://... or \\server\mockups\render.pdf or P:\cad\box.dxf"
            aria-label="Studio output file path or link"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 font-mono"
          />
        </label>
      )}
      <div className="flex shrink-0 items-center justify-end gap-3">
        {error && <p role="alert" className="max-w-sm text-xs text-rose-600 dark:text-rose-300">{error}</p>}
        <button
          type="button"
          onClick={() => void handleAction()}
          disabled={isSubmitting || (role === "studio" && !mockupUrl.trim()) || (role === "creative" && mockupState?.designNeeded === true && isLoadingCreativeDetails)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {isSubmitting
            ? "Sending…"
            : role === "creative"
            ? "Send to Studio"
            : request.mockupWorkflowState?.mockupUrl
            ? "Update & Send to Marketing"
            : "Send Output to Marketing"}
        </button>
      </div>
      </div>
    </div>
  );

  if (!product) {
    return (
      <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/65 p-4">
        <section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-950">
          <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Mockup request cannot be opened</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">This request does not have a valid saved product record.</p>
          <button type="button" onClick={onClose} className="mt-5 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">Close</button>
        </section>
      </div>
    );
  }

  const noDesignHandoff = mockupState?.designNeeded === false
    ? [
        "Design not requested by Marketing.",
        mockupState.marketingShutterstockNo ? `Shutterstock No.: ${mockupState.marketingShutterstockNo}` : "",
        mockupState.marketingRemark ? `Marketing remark: ${mockupState.marketingRemark}` : "",
      ].filter(Boolean).join(" ")
    : mockupState?.stage === "studio"
      ? [
          "Design details completed by Creative.",
          mockupState.creativeShutterstockNo ? `Shutterstock No.: ${mockupState.creativeShutterstockNo}` : "",
          mockupState.creativeRemark ? `Creative remark: ${mockupState.creativeRemark}` : "",
        ].filter(Boolean).join(" ")
      : "Review the saved product category, classes and characteristics before completing the highlighted Creative fields.";

  return (
    <CatalogProductInspectModal
      product={product}
      onClose={onClose}
      heading="Mockup brief specifications"
      intro={noDesignHandoff}
      footer={footer}
      highlightCreativeFields={role === "creative" && mockupState?.designNeeded === true}
      creativeCharacteristicKeys={mockupState?.creativeCharacteristicKeys}
    />
  );
};

export default MockupWorkflowInspectorModal;
