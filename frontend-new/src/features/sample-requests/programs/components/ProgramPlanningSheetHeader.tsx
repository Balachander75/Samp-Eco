import React from "react";
import { SampleRequestItem } from "../../types";
import { formatOdooDate } from "../../utils/dateUtils";
import {
  Factory,
  Boxes,
  UserCheck,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react";

export interface ProgramPlanningSheetHeaderProps {
  activeRequest: SampleRequestItem;
  mode?: "marketing" | "sampling" | "plant";
  onNavigateToTab?: (tab: "samp" | "plant" | "matrix") => void;
  onClaimTask?: (dept: "sampling" | "plant") => Promise<void>;
  isClaiming?: boolean;
  currentUser?: any;
  isAdmin?: boolean;
}

export const ProgramPlanningSheetHeader: React.FC<ProgramPlanningSheetHeaderProps> = ({
  activeRequest,
  mode = "marketing",
  onNavigateToTab,
  onClaimTask,
  isClaiming = false,
}) => {
  const customerName = activeRequest.customer?.trim() || "Unspecified Customer Account";
  const campaignTitle =
    activeRequest.programName?.trim() ||
    activeRequest.programCampaignTitle?.trim() ||
    "Seasonal Product Range";
  const programYear = activeRequest.programYear?.trim() || activeRequest.year || "—";
  const targetPlantRaw = activeRequest.targetPlant?.trim() || "1505";
  const targetPlant = targetPlantRaw.toLowerCase().startsWith("plant") ? targetPlantRaw : `Plant ${targetPlantRaw}`;
  const createdBy =
    activeRequest.createdBy?.trim() ||
    activeRequest.requestCreatedBy?.trim() ||
    "Marketing Desk";
  const createdAt = formatOdooDate(activeRequest.dateRequestCreated || activeRequest.createdAt);
  const skuCount = activeRequest.programMaterials?.length || 0;

  const hasSampNote = Boolean(activeRequest.samplingRemark?.trim());
  const hasPlantNote = Boolean(activeRequest.plantRemark?.trim());

  const isSampClaimed = Boolean(activeRequest.samplingClaimedByUserId || activeRequest.samplingClaimedBy);
  const isPlantClaimed = Boolean(activeRequest.plantClaimedByUserId || activeRequest.plantClaimedBy);

  return (
    <div className="bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)] px-6 sm:px-8 py-3.5 select-text">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* ── Left: Customer Account & Program Metadata ── */}
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1
              className="text-lg sm:text-xl font-display font-bold tracking-tight text-[var(--on-surface)] truncate"
              title={customerName}
            >
              {customerName}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-display font-bold bg-[var(--surface-low)] text-[var(--on-surface)] border border-[var(--border-subtle)] shadow-2xs">
              <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
              <span>{campaignTitle}</span>
              {programYear !== "—" && <span className="font-mono text-[var(--on-surface-subtle)]">({programYear})</span>}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[var(--on-surface-muted)] mt-1 font-mono">
            <span>
              Target: <strong className="text-[var(--on-surface)] font-semibold inline-flex items-center gap-1"><Factory className="w-3 h-3 text-teal-600 " /> {targetPlant}</strong>
            </span>
            <span className="text-[var(--border-strong)]">·</span>
            <span>
              Scope: <strong className="text-[var(--on-surface)] font-semibold inline-flex items-center gap-1"><Boxes className="w-3 h-3 text-[var(--accent-primary)]" /> {skuCount} {skuCount === 1 ? "SKU" : "SKUs"} Planned</strong>
            </span>
            <span className="text-[var(--border-strong)]">·</span>
            <span>
              Raised by <strong className="text-[var(--on-surface)] font-semibold">{createdBy}</strong> on {createdAt || "—"}
            </span>
          </div>
        </div>

        {/* ── Right: Dual Sign-Off Micro-Badges & Contextual Claim Actions ── */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* 1. Sampling Team Sign-Off Pill */}
          {hasSampNote ? (
            <button
              type="button"
              onClick={() => onNavigateToTab?.("samp")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10  border border-emerald-500/25 text-emerald-800  text-xs font-semibold shadow-2xs cursor-pointer hover:bg-emerald-500/15 transition-all"
              title="Sampling Technical Review Completed. Click to view."
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600  shrink-0" />
              <span className="font-bold">SAMP: Reviewed</span>
            </button>
          ) : isSampClaimed ? (
            <button
              type="button"
              onClick={() => onNavigateToTab?.("samp")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10  border border-sky-500/25 text-xs text-sky-800  shadow-2xs cursor-pointer hover:bg-sky-500/15 transition-all"
              title={`Claimed by ${activeRequest.samplingClaimedBy || "Sampling Reviewer"}`}
            >
              <UserCheck className="w-3.5 h-3.5 text-sky-600  shrink-0" />
              <span className="text-[11px] font-mono opacity-70">SAMP:</span>
              <span className="font-semibold text-xs truncate max-w-[120px]">{activeRequest.samplingClaimedBy || "Claimed"}</span>
            </button>
          ) : mode === "sampling" ? (
            <button
              type="button"
              onClick={() => onClaimTask?.("sampling")}
              disabled={isClaiming}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{isClaiming ? "Claiming..." : "Claim SAMP"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigateToTab?.("samp")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-700  font-mono shadow-2xs cursor-pointer hover:bg-amber-500/15 transition-all"
            >
              <Clock className="w-3 h-3 text-amber-500" />
              <span>SAMP: Pending</span>
            </button>
          )}

          {/* 2. Plant Production Sign-Off Pill */}
          {hasPlantNote ? (
            <button
              type="button"
              onClick={() => onNavigateToTab?.("plant")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/10  border border-teal-500/25 text-teal-800  text-xs font-semibold shadow-2xs cursor-pointer hover:bg-teal-500/15 transition-all"
              title={`${targetPlant} Production Feasibility Confirmed. Click to view.`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600  shrink-0" />
              <span className="font-bold">{targetPlant}: Confirmed</span>
            </button>
          ) : isPlantClaimed ? (
            <button
              type="button"
              onClick={() => onNavigateToTab?.("plant")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10  border border-sky-500/25 text-xs text-sky-800  shadow-2xs cursor-pointer hover:bg-sky-500/15 transition-all"
              title={`Claimed by ${activeRequest.plantClaimedBy || "Plant Reviewer"}`}
            >
              <UserCheck className="w-3.5 h-3.5 text-sky-600  shrink-0" />
              <span className="text-[11px] font-mono opacity-70">Plant:</span>
              <span className="font-semibold text-xs truncate max-w-[120px]">{activeRequest.plantClaimedBy || "Claimed"}</span>
            </button>
          ) : mode === "plant" ? (
            <button
              type="button"
              onClick={() => onClaimTask?.("plant")}
              disabled={isClaiming}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{isClaiming ? "Claiming..." : "Claim Plant"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigateToTab?.("plant")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-700  font-mono shadow-2xs cursor-pointer hover:bg-amber-500/15 transition-all"
            >
              <Clock className="w-3 h-3 text-amber-500" />
              <span>Plant: Pending</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgramPlanningSheetHeader;
