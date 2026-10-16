import React from "react";
import { SampleRequestItem } from "../../types";
import { formatOdooDate } from "../../utils/dateUtils";
import {
  Building2,
  CalendarRange,
  Factory,
  CheckCircle2,
  Clock,
} from "lucide-react";

export interface ProgramPlanningSheetHeaderProps {
  activeRequest: SampleRequestItem;
}

export const ProgramPlanningSheetHeader: React.FC<ProgramPlanningSheetHeaderProps> = ({
  activeRequest,
}) => {
  const code = activeRequest.srNumber || activeRequest.materialCode || `PG-${activeRequest.id}`;
  const hasSampNote = Boolean(activeRequest.samplingRemark?.trim());
  const hasPlantNote = Boolean(activeRequest.plantRemark?.trim());

  return (
    <div className="bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)]">
      {/* ── Top Bar: Reference, Account & Status Badges ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 sm:px-8 py-3 bg-[var(--surface-low)] border-b border-[var(--border-subtle)]">
        {/* Left: Code & Account */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-[var(--surface-lowest)] text-[var(--accent-primary)] border border-[var(--border-subtle)] shadow-2xs">
            {code}
          </span>
          <span className="text-[var(--border-strong)]">/</span>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[var(--surface-lowest)] text-xs font-semibold text-[var(--on-surface)] border border-[var(--border-subtle)]">
            <Building2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>{activeRequest.customer || "General Enterprise Account"}</span>
          </div>
        </div>

        {/* Right: Operational Status Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Season Year Badge */}
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-mono font-semibold bg-[var(--surface-lowest)] text-[var(--on-surface)] border border-[var(--border-subtle)]">
            <CalendarRange className="w-3 h-3 text-[var(--accent-primary)]" />
            <span>{activeRequest.programYear || "2026-2027"}</span>
          </span>

          {/* Plant Hub Badge */}
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-mono font-semibold bg-[var(--surface-lowest)] text-[var(--on-surface)] border border-[var(--border-subtle)]">
            <Factory className="w-3 h-3 text-[var(--accent-primary)]" />
            <span>Plant {activeRequest.targetPlant || "1505"}</span>
          </span>

          {/* SAMP Review Status Badge */}
          {hasSampNote ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-display font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>SAMP Reviewed</span>
            </span>
          ) : activeRequest.samplingClaimedBy ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-display font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300">
              <Clock className="w-3 h-3" />
              <span>SAMP: {activeRequest.samplingClaimedBy}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-display font-semibold bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]">
              <span>SAMP Pending</span>
            </span>
          )}

          {/* Plant Feasibility Status Badge */}
          {hasPlantNote ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-display font-bold bg-teal-50 text-teal-700 border border-teal-200/60 dark:bg-teal-950/40 dark:text-teal-300">
              <CheckCircle2 className="w-3 h-3 text-teal-600" />
              <span>Plant Confirmed</span>
            </span>
          ) : activeRequest.plantClaimedBy ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-display font-semibold bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-300">
              <Clock className="w-3 h-3" />
              <span>Plant: {activeRequest.plantClaimedBy}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-display font-semibold bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]">
              <span>Plant Pending</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Document Hero Section: Title & Metadata ── */}
      <div className="px-6 sm:px-8 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] border border-[var(--border-subtle)]">
                Seasonal Program Plan
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-[var(--on-surface)] mt-1">
              {activeRequest.programName || activeRequest.programCampaignTitle || "Annual Program Plan"}
            </h1>
            <p className="text-xs text-[var(--on-surface-muted)] mt-1 flex items-center gap-1.5 font-mono">
              <span>Initiated by</span>
              <span className="font-semibold text-[var(--on-surface)]">
                {activeRequest.createdBy || "Marketing Desk"}
              </span>
              <span className="text-[var(--border-strong)]">·</span>
              <span>
                on{" "}
                {activeRequest.dateRequestCreated
                  ? formatOdooDate(activeRequest.dateRequestCreated)
                  : activeRequest.createdAt
                  ? formatOdooDate(activeRequest.createdAt)
                  : "—"}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgramPlanningSheetHeader;
