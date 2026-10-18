import React from "react";
import { SampleRequestItem } from "../../types";
import { formatOdooDate } from "../../utils/dateUtils";
import { UserProfile } from "@/features/auth";
import {
  ShieldCheck,
  Factory,
  Clock,
  CheckCircle2,
  ChevronRight,
  UserCheck,
  Loader2,
  Lock,
} from "lucide-react";

export interface ProgramPlanningSheetHeaderProps {
  activeRequest: SampleRequestItem;
  mode?: "marketing" | "sampling" | "plant";
  onNavigateToTab?: (tab: "samp" | "plant" | "marketing" | "matrix") => void;
  onClaimTask?: (dept: "sampling" | "plant") => Promise<void>;
  isClaiming?: boolean;
  currentUser?: UserProfile | null;
  isAdmin?: boolean;
}

export const ProgramPlanningSheetHeader: React.FC<ProgramPlanningSheetHeaderProps> = ({
  activeRequest,
  mode = "marketing",
  onNavigateToTab,
  onClaimTask,
  isClaiming = false,
  currentUser,
  isAdmin = false,
}) => {
  const hasSampNote = Boolean(activeRequest.samplingRemark?.trim());
  const hasPlantNote = Boolean(activeRequest.plantRemark?.trim());

  const sampVerdict = activeRequest.samplingVerdict || (hasSampNote ? "Feasible" : null);
  const plantVerdict = activeRequest.plantVerdict || (hasPlantNote ? "Capacity Confirmed" : null);

  const isSampFeasible =
    sampVerdict?.toLowerCase().includes("feasible") &&
    !sampVerdict?.toLowerCase().includes("not");
  const isPlantConfirmed =
    plantVerdict?.toLowerCase().includes("confirmed") ||
    (plantVerdict?.toLowerCase().includes("feasible") &&
      !plantVerdict?.toLowerCase().includes("not"));

  const isSamplingDesk = mode === "sampling";
  const isPlantDesk = mode === "plant";

  const currentUserId = currentUser?.id != null ? String(currentUser.id) : null;
  const currentUserName = currentUser?.name?.toLowerCase().trim();

  const isSampClaimedByMe = Boolean(
    (activeRequest.samplingClaimedByUserId &&
      currentUserId &&
      String(activeRequest.samplingClaimedByUserId) === currentUserId) ||
      (activeRequest.samplingClaimedBy &&
        currentUserName &&
        activeRequest.samplingClaimedBy.toLowerCase().trim() === currentUserName) ||
      isAdmin
  );

  const isPlantClaimedByMe = Boolean(
    (activeRequest.plantClaimedByUserId &&
      currentUserId &&
      String(activeRequest.plantClaimedByUserId) === currentUserId) ||
      (activeRequest.plantClaimedBy &&
        currentUserName &&
        activeRequest.plantClaimedBy.toLowerCase().trim() === currentUserName) ||
      isAdmin
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 select-text">
      {/* ── CARD 1: SAMP TECHNICAL VIABILITY ── */}
      <div
        onClick={() => onNavigateToTab?.("samp")}
        className={`p-4 rounded-2xl border transition shadow-2xs space-y-2 cursor-pointer group ${
          isSamplingDesk
            ? "bg-emerald-500/5 border-emerald-500/40 ring-1 ring-emerald-500/20"
            : "bg-[var(--surface-base)] border-[var(--border-subtle)] hover:border-emerald-500/40"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              1. SAMP Technical Viability
            </span>
          </div>

          {hasSampNote ? (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10.5px] font-semibold border ${
                isSampFeasible
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>{sampVerdict || "Reviewed"}</span>
            </span>
          ) : activeRequest.samplingClaimedBy ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10.5px] font-mono font-medium bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
              <Clock className="w-3 h-3" />
              <span>In Review: {activeRequest.samplingClaimedBy}</span>
            </span>
          ) : isSamplingDesk && onClaimTask ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClaimTask("sampling");
              }}
              disabled={isClaiming}
              className="px-2.5 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-sans text-[11px] font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              {isClaiming ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <UserCheck className="w-3 h-3" />
              )}
              <span>Claim Task</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10.5px] font-mono text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20">
              <Clock className="w-3 h-3" />
              <span>Unclaimed (Awaiting SAMP)</span>
            </span>
          )}
        </div>

        <p className="text-xs text-[var(--on-surface)] leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">
          {activeRequest.samplingRemark ? (
            activeRequest.samplingRemark
          ) : (
            <span className="text-[var(--on-surface-muted)] italic">
              No technical sign-off recorded yet. Sampling team evaluates substrate grammage, caliper stability, and supplier quality.
            </span>
          )}
        </p>

        <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)] text-[10.5px] font-mono text-[var(--on-surface-subtle)]">
          <span>
            {activeRequest.samplingSignedBy ? (
              <>Signed by <strong className="text-[var(--on-surface)] font-sans">{activeRequest.samplingSignedBy}</strong></>
            ) : activeRequest.samplingClaimedBy ? (
              isSampClaimedByMe ? (
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold font-sans">
                  ✓ Claimed by You ({activeRequest.samplingClaimedBy})
                </span>
              ) : (
                <span className="flex items-center gap-1 font-sans">
                  <Lock className="w-3 h-3 text-sky-600 inline" />
                  <span>Owned by <strong className="text-[var(--on-surface)]">{activeRequest.samplingClaimedBy}</strong></span>
                </span>
              )
            ) : isSamplingDesk && onClaimTask ? (
              <span className="text-amber-700 dark:text-amber-400 font-bold font-sans">
                ⚠️ Click Claim Task to take review ownership
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-sans">
                Awaiting SAMP engineer claim
              </span>
            )}
            {activeRequest.samplingSignedAt && (
              <> · {formatOdooDate(activeRequest.samplingSignedAt)}</>
            )}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[var(--accent-primary)] font-sans font-semibold group-hover:translate-x-0.5 transition-transform">
            <span>Details</span>
            <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* ── CARD 2: PLANT FEASIBILITY & CAPACITY ── */}
      <div
        onClick={() => onNavigateToTab?.("plant")}
        className={`p-4 rounded-2xl border transition shadow-2xs space-y-2 cursor-pointer group ${
          isPlantDesk
            ? "bg-teal-500/5 border-teal-500/40 ring-1 ring-teal-500/20"
            : "bg-[var(--surface-base)] border-[var(--border-subtle)] hover:border-teal-500/40"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Factory className="w-3.5 h-3.5" />
            </div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
              2. Plant Feasibility (Plant {activeRequest.targetPlant || "1505"})
            </span>
          </div>

          {hasPlantNote ? (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10.5px] font-semibold border ${
                isPlantConfirmed
                  ? "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>{plantVerdict || "Confirmed"}</span>
            </span>
          ) : activeRequest.plantClaimedBy ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10.5px] font-mono font-medium bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20">
              <Clock className="w-3 h-3" />
              <span>In Review: {activeRequest.plantClaimedBy}</span>
            </span>
          ) : isPlantDesk && onClaimTask ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClaimTask("plant");
              }}
              disabled={isClaiming}
              className="px-2.5 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-sans text-[11px] font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              {isClaiming ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <UserCheck className="w-3 h-3" />
              )}
              <span>Claim Task</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10.5px] font-mono text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20">
              <Clock className="w-3 h-3" />
              <span>Unclaimed (Awaiting Plant)</span>
            </span>
          )}
        </div>

        <p className="text-xs text-[var(--on-surface)] leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">
          {activeRequest.plantRemark ? (
            activeRequest.plantRemark
          ) : (
            <span className="text-[var(--on-surface-muted)] italic">
              No plant capacity recorded yet. Plant team confirms machine run-time allocation, die tooling, and substrate conversion speed.
            </span>
          )}
        </p>

        <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)] text-[10.5px] font-mono text-[var(--on-surface-subtle)]">
          <span>
            {activeRequest.plantSignedBy ? (
              <>Confirmed by <strong className="text-[var(--on-surface)] font-sans">{activeRequest.plantSignedBy}</strong></>
            ) : activeRequest.plantClaimedBy ? (
              isPlantClaimedByMe ? (
                <span className="text-teal-700 dark:text-teal-400 font-semibold font-sans">
                  ✓ Claimed by You ({activeRequest.plantClaimedBy})
                </span>
              ) : (
                <span className="flex items-center gap-1 font-sans">
                  <Lock className="w-3 h-3 text-teal-600 inline" />
                  <span>Owned by <strong className="text-[var(--on-surface)]">{activeRequest.plantClaimedBy}</strong></span>
                </span>
              )
            ) : isPlantDesk && onClaimTask ? (
              <span className="text-amber-700 dark:text-amber-400 font-bold font-sans">
                ⚠️ Click Claim Task to take plant review ownership
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-sans">
                Awaiting Plant operations claim
              </span>
            )}
            {activeRequest.plantSignedAt && (
              <> · {formatOdooDate(activeRequest.plantSignedAt)}</>
            )}
          </span>
          <span className="inline-flex items-center gap-0.5 text-teal-600 dark:text-teal-400 font-sans font-semibold group-hover:translate-x-0.5 transition-transform">
            <span>Details</span>
            <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProgramPlanningSheetHeader;
