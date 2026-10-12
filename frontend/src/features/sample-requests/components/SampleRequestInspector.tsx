import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ExternalLink } from "lucide-react";
import {
  SampleRequestItem,
  ProgramMaterialItem,
  AddProgramMaterialPayload,
} from "../types";
import { getRequestTrackType } from "../utils/trackTypes";
import {
  updateSingleMaterialSampRemarkApi,
  addProgramMaterialApi,
  recordFeasibilityMarketingDecisionApi,
  recordFeasibilityViewedApi,
  convertFeasibilityToSamplingApi,
  cleanFeasibilityDescription,
  fetchProductDetailsApi,
} from "@/infrastructure/api";
import { FeasibilityActivityTimeline } from "./FeasibilityActivityTimeline";
import { useFeasibilityImageSources } from "../hooks/useFeasibilityImageSources";
import { formatOdooLogDate, formatOdooDate } from "../utils/dateUtils";

// Modular Sub-Components
import {
  InspectorControlPanel,
  InspectorSheetHeader,
  InspectorSpecsTab,
  InspectorReviewTab,
  InspectorDecisionTab,
  InspectorAttachmentsTab,
  InspectorChatter,
  ChatterMessageItem,
  ImageLightboxModal,
} from "./inspector";

// Domain Parsers & Types
import {
  ParsedMatrixRow,
  ParsedImageRef,
  ParsedFeasibilityDetails,
  FEASIBILITY_TYPES,
  getFeasibilityTypeDisplay,
  getFeasibilityTypeId,
  parseFeasibilityDetails,
  formatAddedDate,
  parseProgramMatrix,
  emptyNewRow,
} from "../utils/feasibilityParsers";

// Re-export for backward compatibility
export type { ParsedMatrixRow, ParsedImageRef, ParsedFeasibilityDetails };
export {
  FEASIBILITY_TYPES,
  getFeasibilityTypeDisplay,
  getFeasibilityTypeId,
  parseFeasibilityDetails,
  formatAddedDate,
  parseProgramMatrix,
};

export interface SampleRequestInspectorProps {
  request: SampleRequestItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateFeasibility?: (
    requestId: string | number,
    team: "plant" | "sampling",
    response: "Yes" | "No" | "Maybe",
    remark?: string
  ) => Promise<void> | void;
  onMarketingApprove?: (
    requestId: string | number,
    approved: boolean,
    remark?: string
  ) => Promise<void> | void;
  onMaterialsUpdated?: (
    requestId: string | number,
    updatedMaterials: ProgramMaterialItem[]
  ) => void;
  onDeleteRequest?: (request: SampleRequestItem) => void;
  onReleaseDraft?: (request: SampleRequestItem) => Promise<void> | void;
  isAdmin?: boolean;
  readOnly?: boolean;
}

export const SampleRequestInspector: React.FC<SampleRequestInspectorProps> = ({
  request,
  isOpen,
  onClose,
  onMarketingApprove,
  onMaterialsUpdated,
  onDeleteRequest,
  onReleaseDraft,
  readOnly = false,
}) => {
  const [localOverride, setLocalOverride] = useState<SampleRequestItem | null>(null);
  useEffect(() => {
    setLocalOverride(null);
  }, [request?.id]);

  const activeRequest = localOverride || request;
  const trackType = activeRequest ? getRequestTrackType(activeRequest) : null;

  // Request lists carry a compact detail summary; load the full specification
  // only for the single record the user opens in Inspect.
  useEffect(() => {
    if (!isOpen || !request || request.customDetails?.length) return;
    const numericId = Number(String(request.id).replace(/^sample-/, ""));
    if (!Number.isInteger(numericId) || numericId <= 0) return;
    let cancelled = false;
    fetchProductDetailsApi(numericId, false)
      .then((details) => {
        if (cancelled) return;
        setLocalOverride((current) => ({
          ...(current || request),
          customDetails: details.map((detail) => ({
            id: detail.id,
            className: detail.className,
            characteristicName: detail.characteristicName,
            value: detail.value,
            uom: detail.uom,
          })),
        }));
      })
      .catch((error) => console.error("Failed to load request specifications:", error));
    return () => {
      cancelled = true;
    };
  }, [isOpen, request?.id]);

  // Feasibility flow states
  const [isConverting, setIsConverting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Keyboard navigation: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("specs");
  const [decisionRemark, setDecisionRemark] = useState("");

  // Chatter State
  const [chatterFeed, setChatterFeed] = useState<ChatterMessageItem[]>([]);

  // Local state for material specification rows and SAMP remarks
  const [localMaterials, setLocalMaterials] = useState<ProgramMaterialItem[]>(
    request?.programMaterials || []
  );
  const [matrixRemarks, setMatrixRemarks] = useState<Record<string | number, string>>({});
  const [savingRemarkId, setSavingRemarkId] = useState<string | number | null>(null);
  const [savedRemarkId, setSavedRemarkId] = useState<string | number | null>(null);

  // State for adding a new material row directly from the Inspector
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [isSavingNewRow, setIsSavingNewRow] = useState(false);
  const [newRowData, setNewRowData] = useState<AddProgramMaterialPayload>(emptyNewRow);
  const [addRowFeedback, setAddRowFeedback] = useState<string | null>(null);

  // Synchronize localMaterials and reset adding row whenever request changes
  useEffect(() => {
    setLocalMaterials(request?.programMaterials || []);
    setIsAddingRow(false);
    setNewRowData(emptyNewRow);
    setAddRowFeedback(null);
  }, [request?.id, request?.programMaterials]);

  // Unified matrix items (from localMaterials or request?.programMaterials or parsedMatrix)
  const unifiedMatrixRows = useMemo(() => {
    if (!request) return [];
    const sourceMaterials =
      localMaterials && localMaterials.length > 0
        ? localMaterials
        : request.programMaterials && request.programMaterials.length > 0
        ? request.programMaterials
        : null;

    if (sourceMaterials && sourceMaterials.length > 0) {
      return sourceMaterials.map((m, idx) => ({
        id: m.id ?? idx + 1,
        index: idx + 1,
        type: m.materialType || "—",
        supplier: m.supplierName || "—",
        grade: m.grade || "—",
        color: m.colorVariant || "—",
        caliper: m.caliperWt || "—",
        qty: m.quantity || "—",
        unit: m.unit || "—",
        remark: m.remark || "—",
        sampRemark: m.sampRemark || "",
        createdAt: m.createdAt,
      }));
    }
    const fallbackParsed = request.productDescription ? parseProgramMatrix(request.productDescription) : [];
    return fallbackParsed.map((p) => ({
      id: p.index,
      index: p.index,
      type: p.type,
      supplier: p.supplier,
      grade: p.grade,
      color: p.color,
      caliper: p.caliper,
      qty: p.qty,
      unit: p.unit || "—",
      remark: p.remark,
      sampRemark: "",
      createdAt: p.createdAt,
    }));
  }, [localMaterials, request?.programMaterials, request?.productDescription]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab("specs");
    }
  }, [isOpen, request?.id]);

  useEffect(() => {
    if (unifiedMatrixRows.length > 0) {
      const initial: Record<string | number, string> = {};
      unifiedMatrixRows.forEach((r) => {
        initial[r.id ?? r.index] = r.sampRemark || "";
      });
      setMatrixRemarks(initial);
    } else {
      setMatrixRemarks({});
    }
  }, [request?.id, unifiedMatrixRows]);

  // Initialize Chatter Feed based on request
  useEffect(() => {
    if (!request) return;
    const feed: ChatterMessageItem[] = [];

    // System logged entry
    feed.push({
      id: "f-1",
      author: request.createdBy || "Parin D",
      initials: (request.createdBy || "PD").slice(0, 2).toUpperCase(),
      time: formatOdooLogDate(request.createdAt || request.dateRequestCreated),
      type: "audit",
      title: "Request Logged into System",
      content: `Request registered for account ${request.customer || "General"} with SLA target ${
        request.sampleRequiredDate ? formatOdooDate(request.sampleRequiredDate) : "Flexible"
      }.`,
    });

    // Technical Review entry if present
    if (request.samplingFeasibilityResponse) {
      feed.push({
        id: "f-2",
        author: request.samplingFeasibilityApprovedBy || "SAMP Technical Team",
        initials: (request.samplingFeasibilityApprovedBy || "ST").slice(0, 2).toUpperCase(),
        time: formatOdooLogDate(request.samplingFeasibilityApprovedDate || request.feasibilityClosedAt),
        type: "message",
        title: `Technical Evaluation: ${request.samplingFeasibilityResponse}`,
        content: request.samplingFeasibilityRemark || "Technical manufacturing specifications verified feasible.",
      });
    }

    // Commercial decision if present
    if (request.marketingDecision) {
      feed.push({
        id: "f-3",
        author: request.marketingDecisionBy || "Marketing Authority",
        initials: (request.marketingDecisionBy || "MA").slice(0, 2).toUpperCase(),
        time: formatOdooLogDate(request.marketingDecisionAt),
        type: "audit",
        title: `Commercial Decision: ${request.marketingDecision}`,
        content: request.marketingDecisionRemark || "Commercial decision recorded.",
      });
    }

    setChatterFeed(feed);
  }, [request]);

  const handleConvertToSampling = async () => {
    if (!activeRequest) return;
    setIsConverting(true);
    try {
      const result = await convertFeasibilityToSamplingApi(activeRequest.id);
      setLocalOverride(result.feasibility);
      setSubmitFeedback(
        `✓ Commercial Sample Request ${result.sampleSrNumber} successfully created from this feasibility check!`
      );
      setTimeout(() => setSubmitFeedback(null), 4000);
    } catch (err: any) {
      setSubmitFeedback(err?.message || "Failed to convert to sample request.");
    } finally {
      setIsConverting(false);
    }
  };

  const handleMarketingFinalApprove = async (approved: boolean, remark?: string) => {
    if (!activeRequest) return;
    setIsSubmitting(true);
    try {
      if (trackType === "feasibility_check") {
        const updated = await recordFeasibilityMarketingDecisionApi(activeRequest.id, {
          decision: approved ? "Accepted" : "Rejected",
          decision_remark: remark || decisionRemark || null,
        });
        setLocalOverride(updated);
      }
      if (onMarketingApprove) {
        await onMarketingApprove(activeRequest.id, approved, remark || decisionRemark);
      }
      setDecisionRemark("");
      setSubmitFeedback(
        approved
          ? "✓ Feasibility approved by Marketing. Ready to create commercial sample request."
          : "Feasibility request closed (rejected) by Marketing."
      );
      setTimeout(() => setSubmitFeedback(null), 3500);
    } catch (err: any) {
      console.error("Failed to record marketing decision:", err);
      setSubmitFeedback(err?.message || "Failed to record marketing decision.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isOpen && request?.id && trackType === "feasibility_check") {
      recordFeasibilityViewedApi(request.id);
    }
  }, [isOpen, request?.id, trackType]);

  // Handle keyboard shortcuts (Escape and Arrow navigation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedPreviewImage) {
          setSelectedPreviewImage(null);
        } else if (isOpen) {
          onClose();
        }
      }

      if (selectedPreviewImage && (e.key === "ArrowLeft" || e.key === "ArrowRight") && request) {
        const details = parseFeasibilityDetails(
          request.productDescription,
          request.referenceImages,
          request.referenceLinks,
          request.productImagePath
        );
        const images = details.referenceImages.filter((image) => Boolean(image.url));
        const currentIndex = images.findIndex((image) => image.url === selectedPreviewImage);
        if (images.length > 1 && currentIndex >= 0) {
          const nextIndex =
            e.key === "ArrowRight"
              ? (currentIndex + 1) % images.length
              : (currentIndex - 1 + images.length) % images.length;
          setSelectedPreviewImage(images[nextIndex].url || null);
        }
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, request, selectedPreviewImage]);

  const rawLinks = [
    ...(Array.isArray(request?.referenceLinks) ? request.referenceLinks : []),
    ...(Array.isArray((request as any)?.reference_links) ? (request as any).reference_links : []),
    ...(Array.isArray((request as any)?.webLinks) ? (request as any).webLinks : []),
  ];

  const combinedDescriptionText = request
    ? [
        (request as any).descriptionNotes,
        (request as any).description_notes,
        request.feasibilityDescription,
        request.productDescription,
      ]
        .filter(Boolean)
        .join("\n\n")
    : "";

  const imageDetails = request
    ? parseFeasibilityDetails(
        combinedDescriptionText,
        request.referenceImages,
        rawLinks,
        request.productImagePath,
        request.referenceImageNames
      )
    : null;
  const { sourceFor: imageSourceFor, statusFor: imageStatusFor } = useFeasibilityImageSources(
    isOpen ? imageDetails?.referenceImages.map((image) => image.url) || [] : []
  );

  if (!isOpen || !request || !activeRequest) return null;

  const feasibilityDetails = parseFeasibilityDetails(
    combinedDescriptionText,
    request.referenceImages,
    rawLinks,
    request.productImagePath,
    request.referenceImageNames
  );
  const previewableImages = feasibilityDetails.referenceImages.filter((image) => Boolean(image.url));
  const displayType = getFeasibilityTypeDisplay(request);
  const displayDescription = cleanFeasibilityDescription(
    request.feasibilityDescription || feasibilityDetails.requirements || request.productDescription
  );
  const displayRemark = (request.marketingRemarks || feasibilityDetails.marketingRemarks || "").trim();

  // Primary title extraction
  const primaryTitle = request.productDescription
    ? request.productDescription
        .split("\n")[0]
        .replace(/^\[.*?\]\s*/, "")
        .replace(/Attached Images:[\s\S]*/, "")
        .trim()
    : `${request.customer || "General"} · ${displayType}`;

  const handleSaveMaterialSampRemark = async (materialId: number | string) => {
    const remarkValue = matrixRemarks[materialId] ?? "";
    setSavingRemarkId(materialId);
    try {
      const rawReqId = String(request?.id || "").replace(/^program-/, "");
      if (typeof materialId === "number" || (!isNaN(Number(materialId)) && Number(materialId) > 0)) {
        await updateSingleMaterialSampRemarkApi(rawReqId, materialId, remarkValue);
      }
      setSavedRemarkId(materialId);
      setTimeout(() => setSavedRemarkId(null), 2500);
    } catch (err) {
      console.error("Failed to save SAMP remark:", err);
      setSavedRemarkId(materialId);
      setTimeout(() => setSavedRemarkId(null), 2500);
    } finally {
      setSavingRemarkId(null);
    }
  };

  const handleSaveNewMaterialRow = async () => {
    if (!newRowData.material_type?.trim()) {
      setAddRowFeedback("Please specify a Material Type.");
      return;
    }
    setIsSavingNewRow(true);
    setAddRowFeedback(null);
    try {
      const rawReqId = String(request.id).replace(/^program-/, "");
      const res = await addProgramMaterialApi(rawReqId, newRowData);
      setLocalMaterials(res.materials);
      if (onMaterialsUpdated) {
        onMaterialsUpdated(request.id, res.materials);
      }
      setIsAddingRow(false);
      setNewRowData(emptyNewRow);
      setAddRowFeedback("Material row successfully recorded and saved to database.");
      setTimeout(() => setAddRowFeedback(null), 3500);
    } catch (err: any) {
      console.error("Failed to add material row:", err);
      setAddRowFeedback(err?.message || "Failed to save material row to database.");
    } finally {
      setIsSavingNewRow(false);
    }
  };

  const movePreview = (direction: -1 | 1) => {
    const currentIndex = previewableImages.findIndex((image) => image.url === selectedPreviewImage);
    if (previewableImages.length < 2 || currentIndex < 0) return;
    const nextIndex = (currentIndex + direction + previewableImages.length) % previewableImages.length;
    setSelectedPreviewImage(previewableImages[nextIndex].url || null);
  };

  const handleCopyCode = () => {
    if (!activeRequest?.srNumber) return;
    navigator.clipboard.writeText(activeRequest.srNumber);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-smooth-backdrop"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[96vw] xl:max-w-7xl h-[92vh] max-h-[92vh] flex flex-col bg-[var(--surface-lowest)] border border-[var(--border-subtle)] rounded-2xl shadow-[0_24px_70px_-12px_rgba(11,28,48,0.25)] overflow-hidden select-text text-xs animate-smooth-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. TOP CONTROL PANEL */}
        <InspectorControlPanel
          request={request}
          activeRequest={activeRequest}
          trackType={trackType}
          copiedCode={copiedCode}
          isConverting={isConverting}
          isReleasing={isReleasing}
          isSubmitting={isSubmitting}
          readOnly={readOnly}
          onClose={onClose}
          onCopyCode={handleCopyCode}
          onDeleteRequest={onDeleteRequest}
          onReleaseDraft={onReleaseDraft}
          onConvertToSampling={handleConvertToSampling}
          onMarketingFinalApprove={handleMarketingFinalApprove}
          setIsReleasing={setIsReleasing}
        />

        {/* 2. MAIN WORKSPACE VIEWPORT (SPLIT: FORM SHEET + CHATTER) */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: DOCUMENT FORM SHEET */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-[var(--bg-app)]">
            {submitFeedback && (
              <div
                className={`max-w-4xl mx-auto p-3 rounded-xl text-xs font-medium border ${
                  submitFeedback.startsWith("✓")
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300"
                }`}
              >
                {submitFeedback}
              </div>
            )}

            <div className="max-w-4xl mx-auto rounded-2xl bg-[var(--surface-base)] border border-[var(--border-subtle)] shadow-[0_8px_30px_rgba(11,28,48,0.04)] overflow-hidden">
              <InspectorSheetHeader
                request={request}
                activeRequest={activeRequest}
                trackType={trackType}
                displayType={displayType}
                primaryTitle={primaryTitle}
                feasibilityDetails={feasibilityDetails}
                previewableImagesCount={previewableImages.length}
                isSubmitting={isSubmitting}
                isConverting={isConverting}
                onOpenReviewTab={() => setActiveTab("review")}
                onMarketingFinalApprove={handleMarketingFinalApprove}
                onConvertToSampling={handleConvertToSampling}
              />

              {/* NOTEBOOK TABS CONTAINER */}
              <div className="px-8 pb-6 pt-3">
                {/* Tab Navigation Strip */}
                <div className="border-b border-slate-100 dark:border-white/10 flex items-center space-x-6 text-xs font-semibold overflow-x-auto">
                  {trackType === "feasibility_check" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveTab("specs")}
                        className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                          activeTab === "specs"
                            ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                            : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                        }`}
                      >
                        <span>1. Specifications &amp; Scope</span>
                        {(previewableImages.length > 0 || feasibilityDetails.referenceLinks.length > 0) && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] font-bold border border-[var(--accent-primary)]/25">
                            {previewableImages.length + feasibilityDetails.referenceLinks.length}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab("review")}
                        className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                          activeTab === "review"
                            ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                            : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                        }`}
                      >
                        <span>2. SAMP Technical Review</span>
                        {activeRequest.samplingFeasibilityResponse ? (
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-display font-bold ${
                              activeRequest.samplingFeasibilityResponse === "Yes"
                                ? "bg-emerald-50 text-[var(--accent-primary)] dark:bg-emerald-950/60 text-[var(--accent-primary)]"
                                : activeRequest.samplingFeasibilityResponse === "No"
                                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                            }`}
                          >
                            {activeRequest.samplingFeasibilityResponse}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                            {activeRequest.takenBySamp ? "In Review" : "Pending Claim"}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab("decision")}
                        className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                          activeTab === "decision"
                            ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                            : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                        }`}
                      >
                        <span>3. Commercial Sign-Off &amp; Sampling</span>
                        {activeRequest.convertedSrNumber ? (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-bold bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30">
                            ✓ {activeRequest.convertedSrNumber}
                          </span>
                        ) : activeRequest.marketingDecision ? (
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-display font-bold ${
                              activeRequest.marketingDecision === "Accepted"
                                ? "bg-emerald-50 text-[var(--accent-primary)]"
                                : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {activeRequest.marketingDecision}
                          </span>
                        ) : activeRequest.samplingFeasibilityResponse ? (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-bold bg-teal-50 text-teal-800 border border-teal-200 ">
                            Ready
                          </span>
                        ) : null}
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab("attachments")}
                        className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                          activeTab === "attachments"
                            ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                            : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                        }`}
                      >
                        <span>4. Attachments &amp; Links</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab("timeline")}
                        className={`pb-3 border-b-2 font-display transition cursor-pointer select-none whitespace-nowrap ${
                          activeTab === "timeline"
                            ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                            : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                        }`}
                      >
                        5. Workflow Audit Trail
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveTab("specs")}
                        className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                          activeTab === "specs"
                            ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                            : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                        }`}
                      >
                        <span>
                          {trackType === "program_planning"
                            ? "1. Material Specification Matrix"
                            : "1. Specifications & Scope"}
                        </span>
                        {trackType === "program_planning" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 text-slate-700">
                            {unifiedMatrixRows.length}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab("review")}
                        className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                          activeTab === "review"
                            ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                            : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                        }`}
                      >
                        <span>
                          {trackType === "program_planning"
                            ? "2. Plant Planning & SCU Capacity"
                            : "2. Technical & Plant Review"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab("attachments")}
                        className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                          activeTab === "attachments"
                            ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                            : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                        }`}
                      >
                        <span>3. Attachments &amp; Benchmark Links</span>
                        {(previewableImages.length > 0 || feasibilityDetails.referenceLinks.length > 0) && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] font-bold border border-[var(--accent-primary)]/25">
                            {previewableImages.length + feasibilityDetails.referenceLinks.length}
                          </span>
                        )}
                      </button>
                    </>
                  )}
                </div>

                {/* Tab 1: Specifications & Scope */}
                {activeTab === "specs" && (
                  <>
                  <InspectorSpecsTab
                    trackType={trackType}
                    request={request}
                    activeRequest={activeRequest}
                    feasibilityDetails={feasibilityDetails}
                    displayDescription={displayDescription}
                    displayRemark={displayRemark}
                    previewableImages={previewableImages}
                    imageSourceFor={imageSourceFor}
                    onSelectPreviewImage={setSelectedPreviewImage}
                    unifiedMatrixRows={unifiedMatrixRows}
                    matrixRemarks={matrixRemarks}
                    savingRemarkId={savingRemarkId}
                    savedRemarkId={savedRemarkId}
                    isAddingRow={isAddingRow}
                    readOnly={readOnly}
                    isSavingNewRow={isSavingNewRow}
                    newRowData={newRowData}
                    addRowFeedback={addRowFeedback}
                    onRemarkChange={(rowId, val) =>
                      setMatrixRemarks((prev) => ({ ...prev, [rowId]: val }))
                    }
                    onSaveRemark={handleSaveMaterialSampRemark}
                    onStartAddRow={() => setIsAddingRow(true)}
                    onCancelAddRow={() => setIsAddingRow(false)}
                    onNewRowDataChange={(field, val) =>
                      setNewRowData((prev) => ({ ...prev, [field]: val }))
                    }
                    onSaveNewRow={handleSaveNewMaterialRow}
                  />
                  {activeRequest.mockupWorkflowState?.stage === "marketing" && activeRequest.mockupWorkflowState.mockupUrl && (
                    <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                      <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Studio mockup ready</h3>
                      <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-300/80">
                        Studio submitted the mockup for this request.
                      </p>
                      <a
                        href={activeRequest.mockupWorkflowState.mockupUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800"
                      >
                        Open mockup <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </section>
                  )}
                  </>
                )}

                {/* Tab 2: Technical Review */}
                {activeTab === "review" && (
                  <InspectorReviewTab
                    trackType={trackType}
                    activeRequest={activeRequest}
                  />
                )}

                {/* Tab 3: Commercial Sign-Off & Sampling */}
                {activeTab === "decision" && trackType === "feasibility_check" && (
                  <InspectorDecisionTab
                    activeRequest={activeRequest}
                    decisionRemark={decisionRemark}
                    isSubmitting={isSubmitting}
                    isConverting={isConverting}
                    readOnly={readOnly}
                    onDecisionRemarkChange={setDecisionRemark}
                    onMarketingFinalApprove={handleMarketingFinalApprove}
                    onConvertToSampling={handleConvertToSampling}
                  />
                )}

                {/* Tab 4: Reference Attachments & Links */}
                {activeTab === "attachments" && (
                  <InspectorAttachmentsTab
                    previewableImages={previewableImages}
                    referenceLinks={feasibilityDetails.referenceLinks}
                    imageSourceFor={imageSourceFor}
                    onSelectPreviewImage={setSelectedPreviewImage}
                  />
                )}

                {/* Tab 5: Workflow Audit Trail */}
                {activeTab === "timeline" && trackType === "feasibility_check" && (
                  <div className="py-4">
                    <FeasibilityActivityTimeline
                      request={request}
                      activities={request.activities}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: NATIVE ODOO CHATTER (.o_chatter) */}
          <InspectorChatter chatterFeed={chatterFeed} />
        </div>
      </div>

      {/* Full Resolution Image Lightbox Modal */}
      <ImageLightboxModal
        selectedImage={selectedPreviewImage}
        images={previewableImages}
        onClose={() => setSelectedPreviewImage(null)}
        onNavigate={movePreview}
        imageSourceFor={imageSourceFor}
        imageStatusFor={imageStatusFor}
      />
    </div>,
    document.body
  );
};
