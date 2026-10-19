import React from "react";
import { SampleRequestItem } from "../../types";
import { formatOdooDate } from "../../utils/dateUtils";
import {
  Building2,
  Calendar,
  Layers,
  Factory,
  Boxes,
  User,
  Clock,
} from "lucide-react";

export interface ProgramPlanningSheetHeaderProps {
  activeRequest: SampleRequestItem;
  mode?: "marketing" | "sampling" | "plant";
  onNavigateToTab?: (tab: "samp" | "plant" | "marketing" | "matrix") => void;
  onClaimTask?: (dept: "sampling" | "plant") => Promise<void>;
  isClaiming?: boolean;
  currentUser?: any;
  isAdmin?: boolean;
}

export const ProgramPlanningSheetHeader: React.FC<ProgramPlanningSheetHeaderProps> = ({
  activeRequest,
}) => {
  const customerName = activeRequest.customer?.trim() || "Unspecified Customer";
  const campaignTitle =
    activeRequest.programName?.trim() ||
    activeRequest.programCampaignTitle?.trim() ||
    "Seasonal Product Range";
  const programYear = activeRequest.programYear?.trim() || "—";
  const targetPlant = activeRequest.targetPlant?.trim() || "1505";
  const createdBy =
    activeRequest.createdBy?.trim() ||
    activeRequest.requestCreatedBy?.trim() ||
    "Marketing Desk";
  const createdAt = formatOdooDate(activeRequest.dateRequestCreated);
  const skuCount = activeRequest.programMaterials?.length || 0;

  return (
    <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-2xs space-y-2 select-text">
      {/* ── Top Row: Customer, Program, Program Year ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-stretch">
        {/* 1. Customer */}
        <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--surface-low)] border border-[var(--border-subtle)]/70 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] block">
              Customer / Brand
            </span>
            <div
              className="text-xs font-bold text-[var(--on-surface)] truncate leading-tight font-display"
              title={customerName}
            >
              {customerName}
            </div>
          </div>
        </div>

        {/* 2. Campaign Name */}
        <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--surface-low)] border border-[var(--border-subtle)]/70 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] block">
              Campaign / Program
            </span>
            <div
              className="text-xs font-bold text-[var(--on-surface)] truncate leading-tight font-display"
              title={campaignTitle}
            >
              {campaignTitle}
            </div>
          </div>
        </div>

        {/* 3. Program Year */}
        <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--surface-low)] border border-[var(--border-subtle)]/70 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] block">
              Program Year
            </span>
            <div className="text-xs font-mono font-bold text-[var(--on-surface)] truncate leading-tight">
              {programYear}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Meta chips (Target Plant, SKU Scope, Created By, Date) ── */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-[var(--border-subtle)] text-[11px] text-[var(--on-surface-muted)]">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Target Plant */}
          <span className="inline-flex items-center gap-1 font-medium">
            <Factory className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
            <span>Target: <strong className="text-[var(--on-surface)]">Plant {targetPlant}</strong></span>
          </span>

          <span className="opacity-30">·</span>

          {/* Matrix SKUs */}
          <span className="inline-flex items-center gap-1 font-medium">
            <Boxes className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
            <span>Scope: <strong className="text-[var(--on-surface)]">{skuCount} {skuCount === 1 ? "SKU" : "SKUs"} Planned</strong></span>
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10.5px] font-mono text-[var(--on-surface-subtle)]">
          <span className="inline-flex items-center gap-1">
            <User className="w-3 h-3 opacity-70" />
            <span>{createdBy}</span>
          </span>
          {createdAt && (
            <>
              <span className="opacity-40">·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3 opacity-70" />
                <span>{createdAt}</span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgramPlanningSheetHeader;
