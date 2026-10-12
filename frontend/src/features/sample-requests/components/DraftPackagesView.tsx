import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  Layers,
  ChevronRight,
  Send,
  Trash2,
  Calendar,
  Building2,
  User,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  X,
  ExternalLink,
} from "lucide-react";
import { SampleRequestItem } from "../types";
import { releaseDraftRequestsApi, deleteAnyRequestApi } from "@/infrastructure/api";
import { getDraftReleaseStatus, getRequestTrackType, getStageIdForRequest, isDesignRequest } from "../utils/trackTypes";

export interface DraftPackageGroup {
  id: string;
  customer: string;
  programName: string;
  programYear: string;
  year: string;
  targetPlant: string;
  createdBy: string;
  dateRequestCreated: string;
  requestKind: string;
  items: SampleRequestItem[];
}

export interface DraftPackagesViewProps {
  requests: SampleRequestItem[];
  isLoading: boolean;
  onRefresh: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

const isDesignPackageGroup = (group: DraftPackageGroup) =>
  group.requestKind === "design" || (group.items.length > 0 && group.items.every(isDesignRequest));

const getReleaseDestination = (group: DraftPackageGroup) =>
  Array.from(new Set(group.items.map(getDraftReleaseStatus))).join(" and ");

export const DraftPackagesView: React.FC<DraftPackagesViewProps> = ({
  requests,
  isLoading,
  onRefresh,
  showToast,
}) => {
  const navigate = useNavigate();

  // Quick Release modal state
  const [quickReleaseGroup, setQuickReleaseGroup] = useState<DraftPackageGroup | null>(null);
  const [isReleasing, setIsReleasing] = useState(false);

  // Delete Package modal state
  const [deleteGroup, setDeleteGroup] = useState<DraftPackageGroup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Group requests where status contains 'draft' or 'smt'
  const packageGroups: DraftPackageGroup[] = useMemo(() => {
    const draftItems = requests.filter((r) => {
      if (getRequestTrackType(r) !== "marketing_request") return false;
      return getStageIdForRequest(r) === "draft";
    });

    const groupsMap = new Map<string, DraftPackageGroup>();

    for (const item of draftItems) {
      const customer = item.customer?.trim() || "Unassigned Customer";
      const programName = item.programName?.trim() || item.programCampaignTitle?.trim() || "Standard Program";
      const rawYear = item.programYear || item.year || "2026";
      const programYear = String(rawYear).replace(/BTS/gi, "").trim();
      const requestKind = item.requestKind || "sample";

      const key = `${requestKind}::${customer}::${programName}::${programYear}`.toLowerCase();

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          id: key,
          customer,
          programName,
          programYear,
          year: item.year || "",
          targetPlant: item.targetPlant || "1505- Khaniwade",
          createdBy: item.createdBy || "Marketing",
          dateRequestCreated: item.dateRequestCreated || item.createdAt || "",
          requestKind,
          items: [],
        });
      }

      groupsMap.get(key)!.items.push(item);
    }

    return Array.from(groupsMap.values()).sort(
      (a, b) => b.items.length - a.items.length || a.programName.localeCompare(b.programName)
    );
  }, [requests]);

  // Navigate to draft workspace
  const handleOpenWorkspace = (group: DraftPackageGroup) => {
    try {
      sessionStorage.setItem("samp_active_draft_group", JSON.stringify(group));
    } catch {
      // ignore
    }
    navigate("/sample-requests/draft-workspace", { state: { package: group } });
  };

  // Quick release confirmation handler
  const handleConfirmQuickRelease = async () => {
    if (!quickReleaseGroup) return;
    setIsReleasing(true);
    try {
      const itemsByStatus = new Map<string, SampleRequestItem[]>();
      for (const item of quickReleaseGroup.items) {
        const status = getDraftReleaseStatus(item);
        itemsByStatus.set(status, [...(itemsByStatus.get(status) || []), item]);
      }
      for (const [status, items] of itemsByStatus) {
        await releaseDraftRequestsApi(items, status);
      }

      showToast(
        `✓ Released package "${quickReleaseGroup.programName}" (${quickReleaseGroup.items.length} items) to ${getReleaseDestination(quickReleaseGroup)}.`,
        "success"
      );
      setQuickReleaseGroup(null);
      await onRefresh();
    } catch (err) {
      console.error("Failed to quick release package:", err);
      await onRefresh();
      showToast("Error releasing draft package to its workflow.", "error");
    } finally {
      setIsReleasing(false);
    }
  };

  // Delete entire package handler
  const handleConfirmDeletePackage = async () => {
    if (!deleteGroup) return;
    setIsDeleting(true);
    try {
      for (const item of deleteGroup.items) {
        const deleted = await deleteAnyRequestApi(item);
        if (!deleted) throw new Error(`Could not delete request ${item.srNumber || item.id}.`);
      }
      showToast(`Deleted draft package "${deleteGroup.programName}".`, "success");
      setDeleteGroup(null);
      onRefresh();
    } catch (err) {
      console.error("Failed to delete draft package:", err);
      await onRefresh();
      setDeleteGroup(null);
      showToast("Error deleting package items.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-28 bg-zinc-100 dark:bg-zinc-800/40 rounded-xl animate-pulse border border-zinc-200 dark:border-zinc-800" />
        <div className="h-28 bg-zinc-100 dark:bg-zinc-800/40 rounded-xl animate-pulse border border-zinc-200 dark:border-zinc-800" />
      </div>
    );
  }

  if (packageGroups.length === 0) {
    return (
      <div className="p-12 text-center max-w-lg mx-auto">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-center text-zinc-400 mb-4">
          <Package className="w-7 h-7" />
        </div>
        <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
          No Draft Packages Found
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
          Save a sample request or design brief as a draft, then review it here before sending it to the next team.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-200 dark:border-white/[0.08]">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            Draft Packages Queue ({packageGroups.length})
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Sample products and design briefs grouped by customer and season. Review each draft, clone it, release it, or remove it.
          </p>
        </div>
      </div>

      {/* Package Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packageGroups.map((group) => {
          const productCount = group.items.length;
          const designPackage = isDesignPackageGroup(group);
          return (
            <div
              key={group.id}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/[0.08] shadow-xs hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700/50 transition-all flex flex-col justify-between overflow-hidden group"
            >
              {/* Card Top */}
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-600/10 text-purple-600 dark:text-purple-400 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 mb-1.5">
                      {group.customer}
                    </span>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-purple-600 dark:text-purple-400 dark:group-hover:text-purple-300 transition-colors">
                      {group.programName}
                    </h3>
                  </div>

                  <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                    {productCount} {designPackage ? (productCount === 1 ? "Brief" : "Briefs") : (productCount === 1 ? "Product" : "Products")}
                  </span>
                </div>

                {/* Metadata Pills */}
                <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/40 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800/80">
                  <div className="flex items-center gap-1.5 truncate">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span>Season: {group.programYear}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">{group.targetPlant.replace(/^\d+-\s*/, "")}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate col-span-2">
                    <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span>By {group.createdBy}</span>
                    {group.dateRequestCreated && (
                      <span className="text-zinc-400">• {group.dateRequestCreated}</span>
                    )}
                  </div>
                </div>

                {/* Preview badges */}
                <div className="flex flex-wrap gap-1 mt-3">
                  {group.items.slice(0, 3).map((item) => (
                    <span
                      key={item.id}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 truncate max-w-[150px]"
                    >
                      {item.materialCode || item.srNumber}
                    </span>
                  ))}
                  {group.items.length > 3 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400">
                      +{group.items.length - 3} more
                    </span>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="px-4 py-3 bg-zinc-50/70 dark:bg-zinc-900/30 border-t border-zinc-200 dark:border-white/[0.06] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteGroup(group)}
                  className="p-1.5 rounded text-rose-700 hover:text-rose-800 hover:bg-rose-50 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                  title="Delete Draft Package"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickReleaseGroup(group)}
                    className="px-2.5 py-1.5 rounded text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Quick Release all package items to Creative"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Quick Release
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenWorkspace(group)}
                    className="px-3 py-1.5 rounded text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>Open Workspace</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Release Confirmation Modal */}
      {quickReleaseGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/[0.08] max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {isDesignPackageGroup(quickReleaseGroup) ? "Release Design Briefs" : "Quick Release Draft Package"}
                  </h3>
                  <span className="text-xs text-zinc-500">Destination: {getReleaseDestination(quickReleaseGroup)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickReleaseGroup(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-900/60 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5 font-mono">
              <div>
                <span className="text-zinc-400">Customer: </span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                  {quickReleaseGroup.customer}
                </span>
              </div>
              <div>
                <span className="text-zinc-400">Program: </span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                  {quickReleaseGroup.programName} ({quickReleaseGroup.programYear})
                </span>
              </div>
              <div>
                <span className="text-zinc-400">{isDesignPackageGroup(quickReleaseGroup) ? "Briefs to Release: " : "Products to Release: "}</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {quickReleaseGroup.items.length} item(s)
                </span>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Releasing will move {quickReleaseGroup.items.length} {isDesignPackageGroup(quickReleaseGroup) ? "design brief(s)" : "sample request(s)"} from{" "}
              <strong className="text-zinc-900 dark:text-zinc-100">Draft</strong> to{" "}
              <strong className="text-emerald-600 dark:text-emerald-400">{getReleaseDestination(quickReleaseGroup)}</strong>.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuickReleaseGroup(null)}
                disabled={isReleasing}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmQuickRelease}
                disabled={isReleasing}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {isReleasing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Releasing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Confirm Release</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Package Modal */}
      {deleteGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/[0.08] max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Delete Draft Package?
                </h3>
                <span className="text-xs text-zinc-500">This action cannot be undone</span>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Are you sure you want to delete the package{" "}
              <strong>"{deleteGroup.programName}"</strong>? All {deleteGroup.items.length} {isDesignPackageGroup(deleteGroup) ? "draft design brief(s) and their workflow history" : "draft product(s) and their characteristic specifications"} will be removed from the database.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteGroup(null)}
                disabled={isDeleting}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePackage}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {isDeleting ? "Deleting..." : "Delete Package"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
