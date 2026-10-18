import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { UserProfile } from "@/features/auth";
import { SampleRequestItem } from "../types";
import {
  claimFeasibilityTaskApi,
  recordFeasibilitySampVerdictApi,
  recordFeasibilityMarketingDecisionApi,
  convertFeasibilityToSamplingApi,
  cleanFeasibilityDescription,
  addFeasibilityNoteApi,
  proposeFeasibilityCounterDateApi,
  decideFeasibilityCounterDateApi,
  fetchFeasibilityRequestApi,
} from "@/infrastructure/api";
import { useFeasibilityImageSources } from "../hooks/useFeasibilityImageSources";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Loader2,
} from "lucide-react";

// Modular Sub-Components
import {
  FeasibilityControlPanel,
  FeasibilitySheetHeader,
  FeasibilityTechnicalReviewTab,
  FeasibilityCommercialDecisionTab,
  FeasibilityChatterFeed,
  FeasibilityCounterDateModal,
} from "./feasibility";
import { ImageLightboxModal } from "./inspector";

// Domain Parsers & Types
import {
  ParsedImageRef,
  ParsedFeasibilityDetails,
  parseFeasibilityDetails,
  getFeasibilityTypeDisplay,
} from "../utils/feasibilityParsers";

export type { ParsedImageRef, ParsedFeasibilityDetails };
export { parseFeasibilityDetails };

export interface FeasibilityInspectorModalProps {
  request: SampleRequestItem | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => Promise<void>;
  onDeleteRequest?: (req: SampleRequestItem) => void;
  user?: UserProfile | null;
  isAdmin?: boolean;
  sourceDesk?: "marketing" | "samp";
}

export const FeasibilityInspectorModal: React.FC<FeasibilityInspectorModalProps> = ({
  request,
  isOpen,
  onClose,
  onRefresh,
  onDeleteRequest,
  user,
  isAdmin = false,
  sourceDesk = "marketing",
}) => {
  const [localOverride, setLocalOverride] = useState<SampleRequestItem | null>(null);

  useEffect(() => {
    setLocalOverride(null);
  }, [request?.id]);

  useEffect(() => {
    if (!isOpen || !request?.id) return;
    let stopped = false;
    fetchFeasibilityRequestApi(request.id)
      .then((latest) => {
        if (!stopped) setLocalOverride(latest);
      })
      .catch((error) => {
        console.warn("Could not load feasibility detail:", error);
      });
    return () => {
      stopped = true;
    };
  }, [isOpen, request?.id]);

  const activeRequest = localOverride || request;

  // Feasibility flow states
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [sampVerdictChoice, setSampVerdictChoice] = useState<"Yes" | "No" | "Maybe">("Yes");
  const [sampVerdictRemark, setSampVerdictRemark] = useState("");
  const [sampConditions, setSampConditions] = useState("");
  const [sampLeadTimeNote, setSampLeadTimeNote] = useState("");
  const [sampVerdictError, setSampVerdictError] = useState<string | null>(null);
  const [isSubmittingSampVerdict, setIsSubmittingSampVerdict] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionRemark, setDecisionRemark] = useState("");
  const [counterDate, setCounterDate] = useState("");
  const [counterDateReason, setCounterDateReason] = useState("");
  const [counterDateError, setCounterDateError] = useState<string | null>(null);
  const [isSubmittingCounterDate, setIsSubmittingCounterDate] = useState(false);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"specs" | "review" | "decision">("specs");
  const [isCounterDateModalOpen, setIsCounterDateModalOpen] = useState(false);

  useEffect(() => {
    setSampVerdictChoice("Yes");
    setSampVerdictRemark("");
    setSampConditions("");
    setSampLeadTimeNote("");
    setDecisionRemark("");
    setCounterDate("");
    setCounterDateReason("");
    setCounterDateError(null);
    setIsCounterDateModalOpen(false);
  }, [request?.id]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab("specs");
    }
  }, [isOpen, request?.id]);

  useEffect(() => {
    if (!isOpen || !activeRequest?.id || activeRequest.counterDateDecision !== "pending") return;
    let stopped = false;
    const refreshCounterDate = async () => {
      try {
        const latest = await fetchFeasibilityRequestApi(activeRequest.id);
        if (!stopped) {
          setLocalOverride(latest);
          if (latest.counterDateDecision !== "pending") {
            window.dispatchEvent(new CustomEvent("samp:requests-changed"));
            await onRefresh?.();
          }
        }
      } catch (error) {
        console.warn("Could not refresh pending counter-date decision:", error);
      }
    };
    const timer = window.setInterval(() => void refreshCounterDate(), 15000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [isOpen, activeRequest?.id, activeRequest?.counterDateDecision, onRefresh]);

  // Operational desk persona permissions
  const isMarketingDesk = sourceDesk === "marketing";
  const canEvaluateTechnical = sourceDesk === "samp";
  const canMakeCommercialDecision = isMarketingDesk;

  // Parse feasibility technical data
  const feasibilityDetails = useMemo(() => {
    if (!activeRequest) {
      return {
        category: "",
        requirements: "",
        marketingRemarks: "",
        referenceLinks: [],
        referenceImages: [],
      };
    }
    const rawImages = [
      ...(Array.isArray(activeRequest.referenceImages) ? activeRequest.referenceImages : []),
      ...(Array.isArray((activeRequest as any).attached_images)
        ? (activeRequest as any).attached_images
        : []),
      ...(Array.isArray((activeRequest as any).reference_images)
        ? (activeRequest as any).reference_images
        : []),
    ];
    const rawLinks = [
      ...(Array.isArray(activeRequest.referenceLinks) ? activeRequest.referenceLinks : []),
      ...(Array.isArray((activeRequest as any).reference_links)
        ? (activeRequest as any).reference_links
        : []),
      ...(Array.isArray((activeRequest as any).webLinks) ? (activeRequest as any).webLinks : []),
    ];
    const rawImageNames = [
      ...(Array.isArray(activeRequest.referenceImageNames)
        ? activeRequest.referenceImageNames
        : []),
      ...(Array.isArray((activeRequest as any).image_names)
        ? (activeRequest as any).image_names
        : []),
    ];

    return parseFeasibilityDetails(
      activeRequest.productDescription,
      rawImages,
      rawLinks,
      null,
      rawImageNames
    );
  }, [activeRequest]);

  // Previewable image assets
  const previewableImages = useMemo(() => {
    const list: { id: string; url: string; name: string }[] = [];
    (feasibilityDetails.referenceImages || []).forEach((img, idx) => {
      const url = typeof img === "string" ? img : img.url;
      const name = typeof img === "string" ? `Attachment ${idx + 1}` : img.name || `Attachment ${idx + 1}`;
      if (url) {
        list.push({ id: `parsed-${idx}`, url, name });
      }
    });

    if (activeRequest?.productImagePath) {
      const isAlreadyIncluded = list.some((item) => item.url === activeRequest.productImagePath);
      if (!isAlreadyIncluded) {
        list.unshift({
          id: "primary-photo",
          url: activeRequest.productImagePath,
          name: "Primary Product Photo",
        });
      }
    }
    return list;
  }, [feasibilityDetails.referenceImages, activeRequest?.productImagePath]);

  const { sourceFor: imageSourceFor, statusFor: imageStatusFor } = useFeasibilityImageSources(
    isOpen ? previewableImages.map((image) => image.url) : []
  );

  const classificationLabel = useMemo(() => {
    if (!activeRequest) return "New Category";
    if (activeRequest.customFeasibilityType && activeRequest.customFeasibilityType.trim()) {
      return activeRequest.customFeasibilityType.trim();
    }
    if (activeRequest.feasibilityType && activeRequest.feasibilityType.trim()) {
      return getFeasibilityTypeDisplay(activeRequest);
    }
    if (feasibilityDetails.category && feasibilityDetails.category.trim()) {
      return feasibilityDetails.category.trim();
    }
    return (
      activeRequest.productTypeNavneet ||
      activeRequest.productType ||
      "New Category"
    );
  }, [activeRequest, feasibilityDetails.category]);

  // Clean description and remarks
  const displayDescription = useMemo(() => {
    return cleanFeasibilityDescription(
      feasibilityDetails.requirements || activeRequest?.productDescription || ""
    );
  }, [feasibilityDetails.requirements, activeRequest?.productDescription]);

  const displayRemark = useMemo(() => {
    const raw =
      feasibilityDetails.marketingRemarks ||
      (activeRequest as any)?.marketingRemarks ||
      (activeRequest as any)?.remarks ||
      "";
    return typeof raw === "string" ? raw.trim() : "";
  }, [feasibilityDetails.marketingRemarks, activeRequest]);

  // Actions
  const handleCopyCode = () => {
    const code = activeRequest?.materialCode || `FC-${String(activeRequest?.id).padStart(4, "0")}`;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // SAMP Claim Task
  const handleClaimTask = async () => {
    if (!activeRequest?.id || isClaiming || !canEvaluateTechnical) return;
    setIsClaiming(true);
    setClaimError(null);
    try {
      const updated = await claimFeasibilityTaskApi(activeRequest.id);
      setLocalOverride(updated);
      window.dispatchEvent(new CustomEvent("samp:requests-changed"));
      await onRefresh?.();
    } catch (err: any) {
      console.error("Failed to claim feasibility task:", err);
      setClaimError(err?.message || "Failed to claim feasibility task.");
    } finally {
      setIsClaiming(false);
    }
  };

  // SAMP Technical Verdict Submission
  const handleSubmitSampVerdict = async () => {
    if (!activeRequest?.id || isSubmittingSampVerdict || !canEvaluateTechnical) return;
    setSampVerdictError(null);
    setIsSubmittingSampVerdict(true);
    try {
      const updated = await recordFeasibilitySampVerdictApi(activeRequest.id, {
        response: sampVerdictChoice,
        remark: sampVerdictRemark.trim() || undefined,
        conditions: sampConditions.trim() || undefined,
        lead_time_note: sampLeadTimeNote.trim() || undefined,
      });
      setLocalOverride(updated);
      window.dispatchEvent(new CustomEvent("samp:requests-changed"));
      await onRefresh?.();
    } catch (err: any) {
      console.error("Failed to submit SAMP verdict:", err);
      setSampVerdictError(err.message || "Failed to submit technical verdict.");
    } finally {
      setIsSubmittingSampVerdict(false);
    }
  };

  const handleProposeCounterDate = async () => {
    if (!activeRequest?.id || !counterDate || !counterDateReason.trim() || isSubmittingCounterDate) return;
    setCounterDateError(null);
    setIsSubmittingCounterDate(true);
    try {
      const updated = await proposeFeasibilityCounterDateApi(activeRequest.id, counterDate, counterDateReason.trim());
      setLocalOverride(updated);
      window.dispatchEvent(new CustomEvent("samp:requests-changed"));
      await onRefresh?.();
    } catch (err) {
      setCounterDateError(err instanceof Error ? err.message : "Could not propose the revised date.");
    } finally {
      setIsSubmittingCounterDate(false);
    }
  };

  const handleProposeCounterDateSubmit = async (newDate: string, reason: string) => {
    if (!activeRequest?.id || isSubmittingCounterDate) return;
    setIsSubmittingCounterDate(true);
    try {
      const updated = await proposeFeasibilityCounterDateApi(activeRequest.id, newDate, reason);
      setLocalOverride(updated);
      window.dispatchEvent(new CustomEvent("samp:requests-changed"));
      await onRefresh?.();
    } catch (err: any) {
      throw new Error(err?.message || "Could not propose revised target date.");
    } finally {
      setIsSubmittingCounterDate(false);
    }
  };

  const handleCounterDateDecision = async (accepted: boolean, notes?: string) => {
    if (!activeRequest?.id || isSubmittingDecision) return;
    setDecisionError(null);
    setIsSubmittingDecision(true);
    try {
      const updated = await decideFeasibilityCounterDateApi(
        activeRequest.id,
        accepted ? "accepted" : "rejected",
        notes
      );
      setLocalOverride(updated);
      window.dispatchEvent(new CustomEvent("samp:requests-changed"));
      await onRefresh?.();
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : "Could not record the counter-date decision.");
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Marketing Final Decision (Accept / Reject)
  const handleMarketingFinalApprove = async (approved: boolean) => {
    if (!activeRequest?.id || isSubmittingDecision || !canMakeCommercialDecision) return;
    if (approved && activeRequest.samplingFeasibilityResponse === "No" && !decisionRemark.trim()) {
      setDecisionError("Add a reason to document this Marketing exception for a Not Feasible result.");
      return;
    }
    setDecisionError(null);
    setIsSubmittingDecision(true);
    try {
      const decisionStr = approved ? "Accepted" : "Rejected";
      const decider = user?.name || user?.userid || "Marketing Authority";
      const updated = await recordFeasibilityMarketingDecisionApi(activeRequest.id, {
        decision: decisionStr,
        decision_remark: decisionRemark.trim() || undefined,
      });

      setLocalOverride({
        ...updated,
        marketingDecision: decisionStr,
        marketingDecisionBy: updated.marketingDecisionBy || decider,
        marketingDecisionAt: updated.marketingDecisionAt || new Date().toISOString(),
        marketingDecisionRemark: decisionRemark.trim(),
        status: approved ? "Feasibility Approved" : "Feasibility Rejected",
      });
      window.dispatchEvent(new CustomEvent("samp:requests-changed"));
      await onRefresh?.();
    } catch (err) {
      console.error("Failed to record marketing decision:", err);
      setDecisionError(err instanceof Error ? err.message : "Failed to record Marketing decision.");
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Convert to Commercial Sampling Request
  const handleConvertToSampling = async (requestTypes: Array<"sample" | "costing"> = ["sample"]) => {
    if (!activeRequest?.id || isConverting || !canMakeCommercialDecision) return;
    setIsConverting(true);
    try {
      const converter = user?.name || user?.userid || "Marketing Team";
      const result = await convertFeasibilityToSamplingApi(activeRequest.id, requestTypes);
      if (result && result.sampleRequestId) {
        setLocalOverride({
          ...activeRequest,
          convertedSampleRequestId: result.sampleRequestId,
          convertedSrNumber: result.sampleSrNumber,
          convertedRequestCode: result.sampleRequestCode,
          convertedRequestTypes: result.requestTypes,
          convertedBy: converter,
          convertedAt: new Date().toISOString(),
          status: result.requestTypes.includes("sample")
            ? result.requestTypes.includes("costing") ? "Converted to Sampling and Costing" : "Converted to Sampling"
            : "Converted to Costing",
        });
        window.dispatchEvent(new CustomEvent("samp:requests-changed"));
        await onRefresh?.();
      }
    } catch (err) {
      console.error("Failed to convert feasibility to sampling request:", err);
    } finally {
      setIsConverting(false);
    }
  };

  // Chatter Note Creation
  const handleAddNote = async (note: string) => {
    if (!activeRequest?.id) return;
    try {
      const updated = await addFeasibilityNoteApi(activeRequest.id, note);
      setLocalOverride(updated);
      window.dispatchEvent(new CustomEvent("samp:requests-changed"));
    } catch (err) {
      console.error("Failed to post chatter note:", err);
    }
  };

  const movePreview = (direction: -1 | 1) => {
    const currentIndex = previewableImages.findIndex((image) => image.url === selectedPreviewImage);
    if (previewableImages.length < 2 || currentIndex < 0) return;
    const nextIndex = (currentIndex + direction + previewableImages.length) % previewableImages.length;
    setSelectedPreviewImage(previewableImages[nextIndex].url || null);
  };

  if (!isOpen || !activeRequest) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/70"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[96vw] xl:max-w-7xl h-[92vh] max-h-[92vh] flex flex-col bg-[var(--surface-lowest)] border border-[var(--border-subtle)] rounded-2xl shadow-[0_24px_70px_-12px_rgba(11,28,48,0.25)] overflow-hidden select-text text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. TOP CONTROL PANEL */}
        <FeasibilityControlPanel
          activeRequest={activeRequest}
          copiedCode={copiedCode}
          onClose={onClose}
          onCopyCode={handleCopyCode}
          onDeleteRequest={onDeleteRequest}
        />

        {/* 2. MAIN WORKSPACE VIEWPORT (SPLIT: FORM SHEET + TIME LOG) */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: FORM SHEET (DOCUMENT BODY) */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-[var(--bg-app)]">
            <div className="max-w-4xl mx-auto rounded-2xl bg-[var(--surface-base)] border border-[var(--border-subtle)] shadow-[0_8px_30px_rgba(11,28,48,0.04)] overflow-hidden">
              <FeasibilitySheetHeader
                activeRequest={activeRequest}
                classificationLabel={classificationLabel}
                sourceDesk={sourceDesk}
                canEvaluateTechnical={canEvaluateTechnical}
                canMakeCommercialDecision={canMakeCommercialDecision}
                isClaiming={isClaiming}
                onClaimTask={handleClaimTask}
                onOpenCounterDateModal={() => setIsCounterDateModalOpen(true)}
                onCounterDateDecision={handleCounterDateDecision}
                currentUserName={user?.name}
                currentUserId={user?.id}
              />

              {/* Notebook Tab Strip */}
              <div className="px-6 sm:px-8 pb-6 pt-3">
                <div className="border-b border-[var(--border-subtle)] flex items-center space-x-6 text-xs font-semibold overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setActiveTab("specs")}
                    className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                      activeTab === "specs"
                        ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                        : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                    }`}
                  >
                    <span>1. Scope &amp; Specifications</span>
                    {(previewableImages.length > 0 || feasibilityDetails.referenceLinks.length > 0) && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--surface-low)] text-[var(--on-surface)] font-bold border border-[var(--border-subtle)]">
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
                        : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                    }`}
                  >
                    <span>2. SAMP Technical Review</span>
                    {activeRequest.samplingFeasibilityResponse ? (
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-display font-bold ${
                          activeRequest.samplingFeasibilityResponse === "Yes"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : activeRequest.samplingFeasibilityResponse === "No"
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                            : "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        }`}
                      >
                        {activeRequest.samplingFeasibilityResponse}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-bold bg-[var(--surface-low)] text-[var(--on-surface-muted)]">
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
                        : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                    }`}
                  >
                    <span>3. Commercial Decision &amp; Request</span>
                    {activeRequest.convertedRequestCode || activeRequest.convertedSrNumber ? (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] border border-[var(--border-subtle)]">
                        ✓ {activeRequest.convertedRequestCode || activeRequest.convertedSrNumber}
                      </span>
                    ) : activeRequest.marketingDecision ? (
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-display font-bold ${
                          activeRequest.marketingDecision === "Accepted"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                        }`}
                      >
                        {activeRequest.marketingDecision}
                      </span>
                    ) : activeRequest.counterDateDecision === "pending" ? (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                        Date Decision
                      </span>
                    ) : activeRequest.samplingFeasibilityResponse ? (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-bold bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)]">
                        Ready
                      </span>
                    ) : null}
                  </button>
                </div>

                {/* Tab 1: Scope & Specifications */}
                {activeTab === "specs" && (
                  <div className="py-5 space-y-5">
                    {canMakeCommercialDecision && activeRequest.counterDateDecision === "pending" && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-4">
                        <div>
                          <p className="text-xs font-bold text-amber-900 dark:text-amber-200">SAMP proposed revised date: {activeRequest.sampCounterDate}</p>
                          <p className="mt-1 text-[11px] text-amber-800/80 dark:text-amber-300/80">Marketing response is due within 4 working days.</p>
                        </div>
                        <button type="button" onClick={() => setActiveTab("decision")} className="rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] px-3.5 py-2 text-xs font-bold text-white transition-colors cursor-pointer shadow-2xs">Review Date</button>
                      </div>
                    )}
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] p-3">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Feasibility Required Date</div>
                      <div className="mt-1 text-sm font-semibold font-mono text-[var(--on-surface)]">{activeRequest.sampleRequiredDate || "—"}</div>
                    </div>
                    {/* Primary Technical Description & Product Scope */}
                    <div>
                      <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)] mb-2">
                        Technical Description &amp; Product Scope
                      </div>
                      <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs sm:text-[13px] text-[var(--on-surface)] leading-relaxed font-sans shadow-2xs whitespace-pre-wrap">
                        {displayDescription || "No technical description specified."}
                      </div>
                    </div>

                    {/* Marketing Directives & Commercial Notes */}
                    {displayRemark && (
                      <div>
                        <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--accent-primary)] mb-2">
                          Marketing Directives &amp; Commercial Notes
                        </div>
                        <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] text-xs text-[var(--on-surface)] font-sans leading-relaxed shadow-2xs">
                          {displayRemark}
                        </div>
                      </div>
                    )}

                    {/* Benchmark URLs & Links */}
                    {feasibilityDetails.referenceLinks.length > 0 && (
                      <div>
                        <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)] mb-2">
                          Client Reference URLs &amp; Benchmark Links ({feasibilityDetails.referenceLinks.length})
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                          {feasibilityDetails.referenceLinks.map((url, i) => (
                            <a
                              key={i}
                              href={url.startsWith("http") ? url : `https://${url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] text-xs font-mono text-[var(--on-surface)] transition shadow-2xs group"
                            >
                              <span className="truncate max-w-xs">{url.replace(/^https?:\/\//, "")}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Attached Reference Images */}
                    {previewableImages.length > 0 && (
                      <div>
                        <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)] mb-2.5">
                          Attached Reference Images ({previewableImages.length})
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                          {previewableImages.map((img, idx) => (
                            <button
                              key={img.id}
                              type="button"
                              onClick={() => img.url && imageStatusFor(img.url) === "ready" && setSelectedPreviewImage(img.url)}
                              disabled={imageStatusFor(img.url) !== "ready"}
                              aria-label={`Open full-size preview of ${img.name}`}
                              className="group relative rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] overflow-hidden text-left enabled:cursor-zoom-in enabled:hover:border-[var(--accent-primary)] transition shadow-xs disabled:cursor-wait"
                            >
                              <div className="aspect-[4/3] w-full bg-[var(--surface-low)] overflow-hidden relative">
                                {imageSourceFor(img.url) ? (
                                  <img
                                    src={imageSourceFor(img.url)}
                                    alt={img.name}
                                    className="w-full h-full object-contain group-hover:scale-[1.02] transition duration-300"
                                  />
                                ) : imageStatusFor(img.url) === "error" ? (
                                  <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center text-[11px] text-rose-600 dark:text-rose-300">
                                    <AlertTriangle className="h-5 w-5" />
                                    <span>Couldn’t load this image</span>
                                  </div>
                                ) : (
                                  <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[11px] text-[var(--on-surface-subtle)]">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span>Loading image…</span>
                                  </div>
                                )}
                                {imageStatusFor(img.url) === "ready" && (
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                    <span className="text-[11px] font-sans font-semibold text-white bg-black/75 px-2.5 py-1 rounded-lg">
                                      View full size
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="p-2 flex items-center justify-between text-[10.5px] text-[var(--on-surface-muted)] font-sans">
                                <span className="truncate">{img.name}</span>
                                <span className="font-mono text-[var(--on-surface-subtle)]">#{idx + 1}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── In-Context SAMP Team Technical Verdict Spotlight ── */}
                    {activeRequest.samplingFeasibilityResponse && (
                      <div className="p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] space-y-3 mt-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-[var(--on-surface)]">
                              SAMP Team Response:
                            </span>
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-display font-bold border ${
                                activeRequest.samplingFeasibilityResponse === "Yes"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/50 dark:text-emerald-300"
                                  : activeRequest.samplingFeasibilityResponse === "No"
                                  ? "bg-rose-50 text-rose-700 border-rose-200/70 dark:bg-rose-950/50 dark:text-rose-300"
                                  : "bg-amber-50 text-amber-800 border-amber-200/70 dark:bg-amber-950/50 dark:text-amber-300"
                              }`}
                            >
                              {activeRequest.samplingFeasibilityResponse === "Yes" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                              {activeRequest.samplingFeasibilityResponse === "No" && <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                              {activeRequest.samplingFeasibilityResponse === "Maybe" && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                              <span>
                                {activeRequest.samplingFeasibilityResponse === "Yes" && "Feasible (Full Scope)"}
                                {activeRequest.samplingFeasibilityResponse === "No" && "Not Feasible"}
                                {activeRequest.samplingFeasibilityResponse === "Maybe" && "Conditional"}
                              </span>
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-[var(--on-surface-muted)]">
                            Evaluated by: <span className="font-bold text-[var(--on-surface)]">{activeRequest.samplingFeasibilityApprovedBy || "SAMP Team"}</span>
                          </span>
                        </div>

                        {activeRequest.samplingFeasibilityRemark && (
                          <p className="text-xs text-[var(--on-surface)] bg-[var(--surface-lowest)] p-3 rounded-xl border border-[var(--border-subtle)] leading-relaxed font-sans shadow-2xs">
                            {activeRequest.samplingFeasibilityRemark}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-1 text-xs">
                          <button
                            type="button"
                            onClick={() => setActiveTab("review")}
                            className="text-[var(--accent-primary)] hover:underline font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>View Full Technical Sign-Off</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>

                          {canMakeCommercialDecision && !activeRequest.marketingDecision && (
                            <button
                              type="button"
                              onClick={() => setActiveTab("decision")}
                              className="px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                            >
                              <span>Take Commercial Decision</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: SAMP Technical Review */}
                {activeTab === "review" && (
                  <FeasibilityTechnicalReviewTab
                    activeRequest={activeRequest}
                    canEvaluateTechnical={canEvaluateTechnical}
                    isClaiming={isClaiming}
                    sampVerdictChoice={sampVerdictChoice}
                    sampVerdictRemark={sampVerdictRemark}
                    sampConditions={sampConditions}
                    sampLeadTimeNote={sampLeadTimeNote}
                    sampVerdictError={sampVerdictError}
                    claimError={claimError}
                    isSubmittingSampVerdict={isSubmittingSampVerdict}
                    onClaimTask={handleClaimTask}
                    onSampVerdictChoiceChange={(choice) => {
                      setSampVerdictChoice(choice);
                      setSampVerdictError(null);
                    }}
                    onSampVerdictRemarkChange={(remark) => {
                      setSampVerdictRemark(remark);
                      if (sampVerdictError) setSampVerdictError(null);
                    }}
                    onSampConditionsChange={setSampConditions}
                    onSampLeadTimeNoteChange={setSampLeadTimeNote}
                    onSubmitSampVerdict={handleSubmitSampVerdict}
                    counterDate={counterDate}
                    counterDateReason={counterDateReason}
                    counterDateError={counterDateError}
                    isSubmittingCounterDate={isSubmittingCounterDate}
                    onCounterDateChange={setCounterDate}
                    onCounterDateReasonChange={setCounterDateReason}
                    onProposeCounterDate={handleProposeCounterDate}
                    currentUserId={user?.id}
                    currentUserName={user?.name}
                    isAdmin={isAdmin}
                  />
                )}

                {/* Tab 3: Commercial Decision & Sampling */}
                {activeTab === "decision" && (
                  <FeasibilityCommercialDecisionTab
                    activeRequest={activeRequest}
                    canMakeCommercialDecision={canMakeCommercialDecision}
                    decisionRemark={decisionRemark}
                    decisionError={decisionError}
                    isSubmittingDecision={isSubmittingDecision}
                    isConverting={isConverting}
                    onDecisionRemarkChange={setDecisionRemark}
                    onMarketingFinalApprove={handleMarketingFinalApprove}
                    onCounterDateDecision={handleCounterDateDecision}
                    onConvertToSampling={handleConvertToSampling}
                  />
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: TIME LOG AUDIT TRAIL PANEL */}
          <FeasibilityChatterFeed
            activeRequest={activeRequest}
            classificationLabel={classificationLabel}
            onAddNote={handleAddNote}
            currentUser={user}
          />
        </div>
      </div>

      {/* Counter Date Proposal Modal */}
      {isCounterDateModalOpen && (
        <FeasibilityCounterDateModal
          isOpen={isCounterDateModalOpen}
          onClose={() => setIsCounterDateModalOpen(false)}
          originalDate={activeRequest.sampleRequiredDate || ""}
          isEligible={Boolean(canEvaluateTechnical && activeRequest.takenBySamp && !activeRequest.sampCounterDate && !activeRequest.samplingFeasibilityResponse)}
          statusLabel={
            !activeRequest.takenBySamp
              ? "Claim task first"
              : activeRequest.sampCounterDate
              ? "Counter proposal already used"
              : "Within operational policy"
          }
          onSubmitCounterDate={handleProposeCounterDateSubmit}
        />
      )}

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

export default FeasibilityInspectorModal;
