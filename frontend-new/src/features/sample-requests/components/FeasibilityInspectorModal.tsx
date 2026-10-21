import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { UserProfile } from "@/features/auth";
import { SampleRequestItem } from "../types";
import {
  claimFeasibilityTaskApi,
  recordFeasibilitySampVerdictApi,
  recordFeasibilityMarketingDecisionApi,
  cleanFeasibilityDescription,
  addFeasibilityNoteApi,
  proposeFeasibilityCounterDateApi,
  decideFeasibilityCounterDateApi,
  fetchFeasibilityRequestApi,
} from "@/infrastructure/api";
import { useFeasibilityImageSources } from "../hooks/useFeasibilityImageSources";
import {
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { formatOdooDate } from "../utils/dateUtils";
import { isAdmin as isAdminUser, isReadOnlyTeamHead, hasWorkflowTeam } from "@/features/auth/permissions";

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
  user?: UserProfile | null;
  isAdmin?: boolean;
  sourceDesk?: "marketing" | "samp";
}

export const FeasibilityInspectorModal: React.FC<FeasibilityInspectorModalProps> = ({
  request,
  isOpen,
  onClose,
  onRefresh,
  user,
  isAdmin = false,
  sourceDesk = "marketing",
}) => {
  const navigate = useNavigate();
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
  const [conversionError, setConversionError] = useState<string | null>(null);
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
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isCounterDateModalOpen, setIsCounterDateModalOpen] = useState(false);

  useEffect(() => {
    setActiveImageIndex(0);
    setSampVerdictChoice("Yes");
    setSampVerdictRemark("");
    setSampConditions("");
    setSampLeadTimeNote("");
    setDecisionRemark("");
    setConversionError(null);
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
  const feasibilityRequestId = Number(String(activeRequest?.id || "").replace(/^feasibility-/, ""));
  const canCloseFeasibilityRequest = Boolean(
    !isReadOnlyTeamHead(user) && (
      isAdmin ||
      isAdminUser(user) ||
      (sourceDesk === "marketing" && hasWorkflowTeam(user, "marketing")) ||
      (sourceDesk === "samp" && hasWorkflowTeam(user, "samp"))
    )
  );

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
    if (!activeRequest) return "";
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
      ""
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
    if (sampVerdictChoice !== "Yes" && !sampVerdictRemark.trim()) {
      setSampVerdictError(`A remark is required for a ${sampVerdictChoice} verdict.`);
      return;
    }
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
        status: updated.status,
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

  // Open Product Staging. The commercial request is created only after Marketing
  // completes and stages the actual product details there.
  const handleConvertToSampling = async (requestTypes: Array<"sample" | "mockup" | "costing">) => {
    if (!activeRequest?.id || isConverting || !canMakeCommercialDecision) return;
    if (!requestTypes || requestTypes.length === 0) {
      setConversionError("Select at least one request type (Sample, Mockup, or Costing).");
      return;
    }
    if (activeRequest.samplingFeasibilityResponse === "No") {
      setConversionError("SAMP marked this request Not Feasible. Sample and Mockup requests are blocked.");
      return;
    }
    if (activeRequest.marketingDecision !== "Accepted") {
      setConversionError("Marketing must accept this feasibility result before staging a Sample or Mockup request.");
      return;
    }
    setConversionError(null);
    setIsConverting(true);
    try {
      navigate("/sample-requests/product-staging", {
        state: {
          feasibilityRequestId: activeRequest.id,
          feasibilityRequestTypes: requestTypes,
          feasibilityRequestType: requestTypes[0],
          feasibilityRequestCode: activeRequest.requestCode || activeRequest.materialCode,
          feasibilityDescription: activeRequest.feasibilityDescription || activeRequest.productDescription,
          feasibilityRequiredDate: activeRequest.sampleRequiredDate,
          feasibilityReferenceLinks: activeRequest.referenceLinks || [],
          customer: activeRequest.customer,
          programName: activeRequest.programName || activeRequest.feasibilityType || "Feasibility Request",
          programYear: activeRequest.programYear || activeRequest.year,
          year: activeRequest.year,
          targetPlant: activeRequest.targetPlant,
        },
      });
    } catch (err) {
      console.error("Could not open Product Staging for feasibility request:", err);
      setConversionError("Could not open Product Staging. Please try again.");
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
    setActiveImageIndex(nextIndex);
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
          mode={sourceDesk === "samp" ? "samp" : "marketing"}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          closureRequests={feasibilityRequestId > 0 ? [{ type: "feasibility", id: feasibilityRequestId }] : []}
          canCloseRequest={canCloseFeasibilityRequest}
          onRequestClosed={onRefresh}
        />

        {/* 2. MAIN WORKSPACE VIEWPORT (SPLIT: FORM SHEET + TIME LOG) */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: FORM SHEET (DOCUMENT BODY) */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-[var(--bg-app)]">
            <div className="max-w-4xl mx-auto rounded-2xl bg-[var(--surface-base)] border border-[var(--border-subtle)] shadow-[0_8px_30px_rgba(11,28,48,0.04)] overflow-hidden">
              {/* ── 1. PRIMARY SECTION TABS (TOP) ── */}
              <div className="px-6 sm:px-8 pt-3 bg-[var(--surface-low)] border-b border-[var(--border-subtle)]">
                <div className="flex items-center space-x-6 text-xs font-semibold overflow-x-auto">
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
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--surface-base)] text-[var(--on-surface)] font-bold border border-[var(--border-subtle)]">
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
                    <span>2. Sampling Team Review</span>
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
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-bold bg-[var(--surface-base)] text-[var(--on-surface-muted)]">
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
                    <span>3. Commercial Decision</span>
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
              </div>

              {/* ── 2. DOCUMENT HERO & 4-CARD EXECUTIVE STRIP ── */}
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
                onSelectTab={setActiveTab}
                currentUserName={user?.name}
                currentUserId={user?.id}
              />

              {/* ── 3. ACTIVE TAB CONTENT ── */}
              <div className="px-6 sm:px-8 pb-6 pt-2">

                {/* Tab 1: Scope & Specifications */}
                {activeTab === "specs" && (
                  <div className="py-4">
                    {/* 2-Column Split View: Left (Specs, 4 Boxes, Directives, Links) + Right (Direct Large Image View) */}
                    <div className={previewableImages.length > 0 ? "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" : "w-full"}>
                      {/* ── LEFT COLUMN ── */}
                      <div className={previewableImages.length > 0 ? "lg:col-span-6 space-y-4" : "w-full space-y-4"}>
                        {/* 1. Technical Description & Product Scope (Prominent on Top) */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">
                              Technical Description &amp; Scope
                            </span>
                            {displayDescription && (
                              <CopyBadge text={displayDescription} label="Copy Scope" className="text-[10px] py-0.5 px-2" />
                            )}
                          </div>
                          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs sm:text-[13px] text-[var(--on-surface)] leading-relaxed font-sans shadow-2xs whitespace-pre-wrap min-h-[96px]">
                            {displayDescription || (
                              <span className="text-[var(--on-surface-subtle)] italic font-normal">
                                No technical description specified by Marketing.
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 2. Four Informational Metric Cards */}
                        <div className={`grid gap-2.5 ${previewableImages.length > 0 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
                          {/* Box 1: Assigned Reviewer */}
                          <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] flex flex-col justify-between gap-1 shadow-2xs">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] font-semibold">
                              Reviewer
                            </span>
                            <div className="font-sans font-bold text-xs truncate">
                              {activeRequest.takenBySamp ? (
                                <span className="text-[var(--on-surface)]">{activeRequest.takenBySamp}</span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold italic">
                                  Pending Claim
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Box 2: Feasibility Required Date */}
                          <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] flex flex-col justify-between gap-1 shadow-2xs">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] font-semibold">
                              Required Date
                            </span>
                            <div className="font-mono font-bold text-xs text-[var(--on-surface)] flex items-center justify-between gap-1">
                              <span className="truncate">
                                {activeRequest.sampleRequiredDate ? formatOdooDate(activeRequest.sampleRequiredDate) : "—"}
                              </span>
                              {canEvaluateTechnical && !activeRequest.samplingFeasibilityResponse && !activeRequest.sampCounterDate && activeRequest.takenBySamp && (
                                <button
                                  type="button"
                                  onClick={() => setIsCounterDateModalOpen(true)}
                                  className="text-[10px] text-[var(--accent-primary)] hover:underline font-sans font-semibold cursor-pointer shrink-0"
                                >
                                  Propose
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Box 3: NPD Technical Feasibility Dossier */}
                          <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] flex flex-col justify-between gap-1 shadow-2xs">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] font-semibold">
                              NPD Dossier
                            </span>
                            <div className="font-mono font-bold text-xs text-[var(--on-surface)] truncate">
                              {activeRequest.materialCode || activeRequest.requestCode || "—"}
                            </div>
                          </div>

                          {/* Box 4: Feasibility Scope / Category */}
                          <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] flex flex-col justify-between gap-1 shadow-2xs">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] font-semibold">
                              Feasibility Scope
                            </span>
                            <div className="font-display font-bold text-xs text-[var(--on-surface)] truncate">
                              {classificationLabel || "—"}
                            </div>
                          </div>
                        </div>

                        {/* 3. Marketing Directives & Commercial Notes */}
                        {displayRemark && (
                          <div className="space-y-1.5">
                            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                              Marketing Directives &amp; Commercial Notes
                            </div>
                            <div className="p-3.5 rounded-xl border border-amber-200/70 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20 text-xs text-[var(--on-surface)] font-sans leading-relaxed shadow-2xs whitespace-pre-wrap">
                              {displayRemark}
                            </div>
                          </div>
                        )}

                        {/* 4. Reference URLs & Benchmark Links */}
                        {feasibilityDetails.referenceLinks.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">
                              Reference URLs &amp; Benchmark Links ({feasibilityDetails.referenceLinks.length})
                            </div>
                            <div className="flex flex-col gap-2">
                              {feasibilityDetails.referenceLinks.map((url, i) => (
                                <a
                                  key={i}
                                  href={url.startsWith("http") ? url : `https://${url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group flex items-center justify-between gap-3 p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 transition shadow-2xs"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-5 h-5 rounded-md bg-[var(--surface-low)] flex items-center justify-center shrink-0 text-[10px] font-mono font-bold text-[var(--accent-primary)]">
                                      #{i + 1}
                                    </span>
                                    <span className="font-mono text-xs text-[var(--on-surface)] truncate group-hover:text-[var(--accent-primary)] transition">
                                      {url.replace(/^https?:\/\//, "")}
                                    </span>
                                  </div>
                                  <ExternalLink className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] group-hover:text-[var(--accent-primary)] shrink-0 transition" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ── RIGHT COLUMN: PURE IMMERSIVE DIRECT IMAGE VIEWER ── */}
                      {previewableImages.length > 0 && (() => {
                        const safeIdx = activeImageIndex >= previewableImages.length ? 0 : activeImageIndex;
                        const currentImg = previewableImages[safeIdx] || previewableImages[0];
                        return (
                          <div className="lg:col-span-6 sticky top-4">
                            <div className="relative w-full h-[480px] sm:h-[520px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-low)]/50 overflow-hidden shadow-inner flex items-center justify-center p-4 sm:p-6 select-none group">
                              {/* Studio Light-Table Grid Backdrop (blends seamlessly with active theme) */}
                              <div
                                className="absolute inset-0 opacity-[0.35] dark:opacity-[0.18] pointer-events-none"
                                style={{
                                  backgroundImage: `radial-gradient(var(--border-strong) 1px, transparent 1px)`,
                                  backgroundSize: "20px 20px",
                                }}
                              />
                              {/* Soft Radial Ambient Vignette */}
                              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--surface-container)_100%)] opacity-40 pointer-events-none" />

                              {/* Direct Full Image */}
                              {imageSourceFor(currentImg.url) ? (
                                <img
                                  src={imageSourceFor(currentImg.url)}
                                  alt={currentImg.name || "Reference image"}
                                  onClick={() => setSelectedPreviewImage(currentImg.url)}
                                  className="max-w-full max-h-full object-contain rounded-xl transition duration-300 group-hover:scale-[1.015] cursor-zoom-in filter drop-shadow-[0_8px_20px_rgba(11,28,48,0.12)] dark:drop-shadow-[0_12px_28px_rgba(0,0,0,0.6)] z-[1]"
                                />
                              ) : imageStatusFor(currentImg.url) === "error" ? (
                                <div className="flex flex-col items-center justify-center gap-2 text-rose-500 text-xs z-[1]">
                                  <AlertTriangle className="w-8 h-8 opacity-60" />
                                  <span>Could not load image</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center gap-2 text-[var(--on-surface-subtle)] text-xs z-[1]">
                                  <Loader2 className="w-7 h-7 animate-spin text-[var(--accent-primary)]" />
                                  <span>Loading image…</span>
                                </div>
                              )}

                              {/* Direct Navigation Arrows (< and >) */}
                              {previewableImages.length > 1 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : previewableImages.length - 1));
                                    }}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[var(--surface-base)]/85 hover:bg-[var(--surface-base)] text-[var(--on-surface)] flex items-center justify-center backdrop-blur-md transition shadow-md cursor-pointer active:scale-95 z-10 border border-[var(--border-subtle)] opacity-0 group-hover:opacity-100 hover:scale-105"
                                    title="Previous Image"
                                    aria-label="Previous image"
                                  >
                                    <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveImageIndex((prev) => (prev < previewableImages.length - 1 ? prev + 1 : 0));
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[var(--surface-base)]/85 hover:bg-[var(--surface-base)] text-[var(--on-surface)] flex items-center justify-center backdrop-blur-md transition shadow-md cursor-pointer active:scale-95 z-10 border border-[var(--border-subtle)] opacity-0 group-hover:opacity-100 hover:scale-105"
                                    title="Next Image"
                                    aria-label="Next image"
                                  >
                                    <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                                  </button>
                                </>
                              )}

                              {/* Minimal Bottom Indicator Dots */}
                              {previewableImages.length > 1 && (
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-[var(--surface-base)]/85 backdrop-blur-md border border-[var(--border-subtle)] flex items-center gap-1.5 z-10 shadow-sm">
                                  {previewableImages.map((_, dotIdx) => (
                                    <button
                                      key={dotIdx}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveImageIndex(dotIdx);
                                      }}
                                      className={`transition-all rounded-full cursor-pointer ${
                                        safeIdx === dotIdx
                                          ? "w-4 h-1.5 bg-[var(--accent-primary)] shadow-xs"
                                          : "w-1.5 h-1.5 bg-[var(--on-surface-subtle)]/30 hover:bg-[var(--on-surface-subtle)]/60"
                                      }`}
                                      title={`Go to image ${dotIdx + 1}`}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Tab 2: Sampling Team Review */}
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
                    onProposeCounterDateDirect={handleProposeCounterDateSubmit}
                    onNavigateToDecision={() => setActiveTab("decision")}
                    onOpenCounterDateModal={() => setIsCounterDateModalOpen(true)}
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
                    conversionError={conversionError}
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
        onSelectImage={(url) => {
          setSelectedPreviewImage(url);
          const idx = previewableImages.findIndex((img) => img.url === url);
          if (idx >= 0) setActiveImageIndex(idx);
        }}
      />
    </div>,
    document.body
  );
};

export default FeasibilityInspectorModal;
