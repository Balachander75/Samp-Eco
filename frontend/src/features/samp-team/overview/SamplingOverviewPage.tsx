import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Beaker,
  PackageCheck,
  Send,
  Eye,
  FlaskConical,
  Calendar,
  Layers,
  Clock,
  CheckCircle2,
  ArrowRight,
  Building2,
  Factory,
  MessageSquare,
  Zap,
  TrendingUp,
  Activity,
  ClipboardCheck,
} from "lucide-react";
import type { SampleRequestItem } from "@/features/sample-requests/types";
import { UserProfile } from "@/features/auth";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { formatOdooDate } from "@/features/sample-requests/utils/dateUtils";

export interface SamplingOverviewPageProps {
  requests: SampleRequestItem[];
  isLoading: boolean;
  selectedYear: string;
  selectedPlant: string;
  user?: UserProfile | null;
  onNavigateToSampling: () => void;
  onNavigateToFeasibility: () => void;
  onNavigateToPrograms: () => void;
  onInspectRequest: (req: SampleRequestItem) => void;
}

export const SamplingOverviewPage: React.FC<SamplingOverviewPageProps> = ({
  requests,
  isLoading,
  selectedYear,
  selectedPlant,
  user,
  onNavigateToSampling,
  onNavigateToFeasibility,
  onNavigateToPrograms,
  onInspectRequest,
}) => {
  const navigate = useNavigate();

  // Filter requests by plant prop if not "ALL"
  const baseRequests = useMemo(() => {
    if (selectedPlant === "ALL" || !selectedPlant) return requests;
    return requests.filter((r) =>
      (r.targetPlant || "").toLowerCase().includes(selectedPlant.toLowerCase())
    );
  }, [requests, selectedPlant]);

  // Classification logic
  // 1. Feasibility requests
  const feasibilityRequests = useMemo(() => {
    return baseRequests.filter((r) => {
      const mode = String(r.creationMode || "").toLowerCase();
      const kind = String(r.requestKind || "").toLowerCase();
      const idStr = String(r.id || "");
      const status = String(r.status || "").toLowerCase();
      const isConverted = status.includes("sampling requested") || status.includes("converted to sampling") || r.convertedSampleRequestId;
      if (isConverted) return false;
      return kind === "feasibility" || idStr.startsWith("feasibility-") || mode === "feasibility_check" || Boolean(r.feasibilityType);
    });
  }, [baseRequests]);

  // 2. Program planning requests
  const programRequests = useMemo(() => {
    return baseRequests.filter((r) => {
      const mode = String(r.creationMode || "").toLowerCase();
      const kind = String(r.requestKind || "").toLowerCase();
      const sr = String(r.srNumber || "").toLowerCase();
      return kind === "program" || mode === "program_planning" || sr.includes("-pg-");
    });
  }, [baseRequests]);

  // 3. Regular sample deliverables
  const sampleDeliverables = useMemo(() => {
    return baseRequests.filter((r) => {
      const kind = String(r.requestKind || "").toLowerCase();
      const mode = String(r.creationMode || "").toLowerCase();
      if (kind === "program" || mode === "program_planning" || kind === "feasibility" || mode === "feasibility_check") {
        return false;
      }
      return true;
    });
  }, [baseRequests]);

  // Ready to Release to Plant: Creative & Studio outputs done
  const readyForPlantRelease = useMemo(() => {
    return sampleDeliverables.filter((r) => {
      const status = String(r.status || "").toLowerCase();
      const state = r.mockupWorkflowState;
      const hasStudioOutput = Boolean(state?.mockupUrl);
      const isReleased = status.includes("released to plant") || Boolean(state?.plantReleasedAt);
      if (isReleased) return false;

      const creativeDone = state?.stage === "marketing" || state?.stage === "studio" || !state?.designNeeded;
      return hasStudioOutput && creativeDone;
    });
  }, [sampleDeliverables]);

  // Design review feedback pending
  const designFeedbackNeeded = useMemo(() => {
    return sampleDeliverables.filter((r) => {
      const state = r.mockupWorkflowState;
      const hasDesign = (r.requestTypes || []).includes("design") || state?.designNeeded === true;
      const status = String(r.status || "").toLowerCase();
      const isReleased = status.includes("released to plant") || Boolean(state?.plantReleasedAt);
      return hasDesign && !isReleased && !state?.samplingFeedback;
    });
  }, [sampleDeliverables]);

  // Recently released to plant
  const recentlyReleased = useMemo(() => {
    return sampleDeliverables.filter((r) => {
      const status = String(r.status || "").toLowerCase();
      const state = r.mockupWorkflowState;
      return status.includes("released to plant") || Boolean(state?.plantReleasedAt);
    }).slice(0, 5);
  }, [sampleDeliverables]);

  // Feasibility metrics
  const feasibilityUnclaimed = useMemo(() => {
    return feasibilityRequests.filter((r) => !r.takenBySamp && !r.samplingFeasibilityResponse).length;
  }, [feasibilityRequests]);

  const feasibilityActive = useMemo(() => {
    return feasibilityRequests.filter((r) => r.takenBySamp && !r.samplingFeasibilityResponse).slice(0, 5);
  }, [feasibilityRequests]);

  return (
    <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 bg-[var(--bg-app)] text-[var(--on-surface)] select-text font-sans">
      {/* ── 1. Hero Identity Banner ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Beaker className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              SAMP Lab &amp; Operations Command
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] text-[10px] font-mono font-bold">
              BY {selectedYear === "ALL" ? "Consolidated" : selectedYear}
            </span>
            <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300/40">
              Live Operations
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--on-surface)] font-display">
            {user?.name ? `Welcome back, ${user.name.split(" ")[0]}` : "Sampling Operations Overview"}
          </h1>
          <p className="text-xs text-[var(--on-surface-muted)] mt-0.5">
            Review marketing designs, inspect completed creative artwork &amp; studio CAD deliverables, release approved samples to manufacturing plants, and evaluate technical feasibility.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onNavigateToSampling}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold font-mono transition cursor-pointer shadow-xs"
          >
            <PackageCheck className="w-4 h-4" />
            <span>Open Plant Release Queue</span>
          </button>
        </div>
      </div>

      {/* ── 2. Master Interactive KPI Ribbon (4 Cards) ── */}
      <section
        aria-label="Sampling Team KPI Overview"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        {/* Card 1: Ready to Release to Plant */}
        <div
          role="button"
          tabIndex={0}
          onClick={onNavigateToSampling}
          className="bg-[var(--surface-lowest)] rounded-xl border border-emerald-500/30 p-4 hover:border-emerald-500 transition shadow-2xs cursor-pointer group card-hover-lift"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Ready for Plant Release
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            {isLoading ? "—" : readyForPlantRelease.length}
          </div>
          <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400/70 font-mono mt-1 flex items-center gap-1">
            <span>Creative &amp; Studio done</span>
            <ArrowRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition" />
          </div>
        </div>

        {/* Card 2: Design Feedback Queue */}
        <div
          role="button"
          tabIndex={0}
          onClick={onNavigateToSampling}
          className="bg-[var(--surface-lowest)] rounded-xl border border-indigo-500/30 p-4 hover:border-indigo-500 transition shadow-2xs cursor-pointer group card-hover-lift"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              Design Review &amp; Feedback
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-indigo-700 dark:text-indigo-400">
            {isLoading ? "—" : designFeedbackNeeded.length}
          </div>
          <div className="text-[10px] text-indigo-700/80 dark:text-indigo-400/70 font-mono mt-1 flex items-center gap-1">
            <span>Marketing designs in review</span>
            <ArrowRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition" />
          </div>
        </div>

        {/* Card 3: Technical Feasibility */}
        <div
          role="button"
          tabIndex={0}
          onClick={onNavigateToFeasibility}
          className="bg-[var(--surface-lowest)] rounded-xl border border-teal-500/30 p-4 hover:border-teal-500 transition shadow-2xs cursor-pointer group card-hover-lift"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
              Technical Feasibility
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <FlaskConical className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-teal-700 dark:text-teal-400">
            {isLoading ? "—" : feasibilityRequests.length}
          </div>
          <div className="text-[10px] text-teal-700/80 dark:text-teal-400/70 font-mono mt-1 flex items-center gap-1">
            <span>{feasibilityUnclaimed} awaiting claim</span>
            <ArrowRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition" />
          </div>
        </div>

        {/* Card 4: Program Planning */}
        <div
          role="button"
          tabIndex={0}
          onClick={onNavigateToPrograms}
          className="bg-[var(--surface-lowest)] rounded-xl border border-purple-500/30 p-4 hover:border-purple-500 transition shadow-2xs cursor-pointer group card-hover-lift"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
              Annual Program Planning
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-purple-700 dark:text-purple-400">
            {isLoading ? "—" : programRequests.length}
          </div>
          <div className="text-[10px] text-purple-700/80 dark:text-purple-400/70 font-mono mt-1 flex items-center gap-1">
            <span>Annual customer programs</span>
            <ArrowRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition" />
          </div>
        </div>
      </section>

      {/* ── 3. Operational Split Workbench (2 Columns) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left Column: Urgent Deliverables Ready for Plant Release (3/5) */}
        <div className="lg:col-span-3 bg-[var(--surface-lowest)] rounded-xl border border-[var(--border-subtle)] shadow-2xs overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-low)]/50">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold font-display text-[var(--on-surface)]">
                Ready to Release to Manufacturing Plant
              </span>
              {readyForPlantRelease.length > 0 && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  {readyForPlantRelease.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onNavigateToSampling}
              className="text-xs font-mono font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Full Release Queue</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {isLoading ? (
            <div className="p-5 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-[var(--surface-low)] animate-pulse" />
              ))}
            </div>
          ) : readyForPlantRelease.length === 0 ? (
            <div className="p-8 flex flex-col items-center text-center my-auto">
              <ClipboardCheck className="w-8 h-8 text-emerald-500 mb-2" />
              <p className="text-xs font-semibold text-[var(--on-surface)]">All Approved Samples Dispatched!</p>
              <p className="text-xs text-[var(--on-surface-muted)] font-mono mt-1">
                No deliverables currently waiting for plant release. New items will arrive once Studio outputs are submitted.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)] overflow-auto max-h-[380px]">
              {readyForPlantRelease.slice(0, 6).map((req) => {
                const studioOutput = req.mockupWorkflowState?.mockupUrl;
                return (
                  <div
                    key={req.id}
                    onClick={() => onInspectRequest(req)}
                    className="flex items-center justify-between px-5 py-3 hover:bg-[var(--surface-low)] transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 text-emerald-600">
                        <PackageCheck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-teal-700 dark:text-teal-400">
                            {req.srNumber || `SR-${req.id}`}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--surface-low)] text-[var(--on-surface-muted)] truncate max-w-[140px]">
                            {req.targetPlant || "Khaniwade"}
                          </span>
                        </div>
                        <div className="text-xs font-medium text-[var(--on-surface)] truncate max-w-sm mt-0.5">
                          {req.productDescription}
                        </div>
                        <div className="text-[10px] text-[var(--on-surface-subtle)] font-mono">
                          Customer: {req.customer || "—"} · CAD:{" "}
                          <span className="text-indigo-600 dark:text-indigo-400 truncate font-semibold">
                            {studioOutput || "Attached"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2 pl-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToSampling();
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-mono font-bold shadow-2xs transition cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>Release</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Active Feasibility Evaluations & Plant Releases (2/5) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Active Feasibility Panel */}
          <div className="bg-[var(--surface-lowest)] rounded-xl border border-[var(--border-subtle)] shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-low)]/50">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-teal-600" />
                <span className="text-xs font-bold font-display text-[var(--on-surface)]">
                  Active Feasibility Checks
                </span>
              </div>
              <button
                type="button"
                onClick={onNavigateToFeasibility}
                className="text-xs font-mono font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Full Queue</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-10 rounded-lg bg-[var(--surface-low)] animate-pulse" />
                ))}
              </div>
            ) : feasibilityActive.length === 0 ? (
              <div className="p-5 text-center text-xs text-[var(--on-surface-muted)] font-mono">
                No active feasibility evaluations.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {feasibilityActive.map((req) => (
                  <div
                    key={req.id}
                    onClick={onNavigateToFeasibility}
                    className="flex items-center justify-between px-5 py-2.5 hover:bg-[var(--surface-low)] transition cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-xs text-teal-700 dark:text-teal-400">
                        {req.materialCode || req.srNumber}
                      </div>
                      <div className="text-[11px] text-[var(--on-surface-muted)] truncate">
                        {req.customer} · {req.feasibilityType || "Check"}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-900/40">
                      In Review
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Plant Dispatches Panel */}
          <div className="bg-[var(--surface-lowest)] rounded-xl border border-[var(--border-subtle)] shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-low)]/50">
              <div className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-sky-600" />
                <span className="text-xs font-bold font-display text-[var(--on-surface)]">
                  Recent Dispatches to Plant
                </span>
              </div>
              <span className="text-[10px] font-mono text-[var(--on-surface-subtle)]">
                {recentlyReleased.length} shown
              </span>
            </div>

            {recentlyReleased.length === 0 ? (
              <div className="p-5 text-center text-xs text-[var(--on-surface-muted)] font-mono">
                No samples dispatched yet this business year.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {recentlyReleased.map((req) => (
                  <div
                    key={req.id}
                    onClick={() => onInspectRequest(req)}
                    className="flex items-center justify-between px-5 py-2.5 hover:bg-[var(--surface-low)] transition cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-xs text-sky-700 dark:text-sky-400">
                        {req.srNumber || `SR-${req.id}`}
                      </div>
                      <div className="text-[11px] text-[var(--on-surface-muted)] truncate">
                        {req.customer} · {req.productDescription}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      {req.targetPlant || "In Plant"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. Workflow Lifecycle Guide Strip ── */}
      <section
        aria-label="Sampling lifecycle workflow"
        className="bg-[var(--surface-lowest)] rounded-xl border border-[var(--border-subtle)] shadow-2xs p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          <ClipboardCheck className="w-4 h-4 text-teal-600" />
          <span className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--on-surface)]">
            End-to-End Sampling Team Operating Lifecycle
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[
            {
              step: "01",
              title: "Marketing Raised Brief",
              desc: "Marketing raises sample or design request. Sampling team has view rights to review specifications.",
              tone: "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300",
            },
            {
              step: "02",
              title: "Creative & Studio Outputs",
              desc: "Creative produces accepted design artwork, and Studio generates 3D CAD deliverable link/path.",
              tone: "border-purple-500/30 bg-purple-500/5 text-purple-700 dark:text-purple-300",
            },
            {
              step: "03",
              title: "Sampling Review & Feedback",
              desc: "Sampling engineer inspects completed outputs, gives technical feedback & fabrication remarks.",
              tone: "border-teal-500/30 bg-teal-500/5 text-teal-700 dark:text-teal-300",
            },
            {
              step: "04",
              title: "Release to Manufacturing Plant",
              desc: "Sampling team releases the approved deliverable to the designated manufacturing plant for physical fabrication.",
              tone: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
            },
          ].map((item) => (
            <div key={item.step} className={`p-3.5 rounded-lg border transition ${item.tone}`}>
              <div className="text-[11px] font-mono font-bold mb-1">
                Step {item.step} · {item.title}
              </div>
              <p className="text-[11px] text-[var(--on-surface-muted)] leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default SamplingOverviewPage;
