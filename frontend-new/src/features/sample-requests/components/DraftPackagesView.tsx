import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Calendar, ChevronRight, Package } from "lucide-react";
import { DataTable } from "@/components/erp";
import type { ColumnDef } from "@/components/erp";
import type { SampleRequestItem } from "../types";
import { getRequestTrackType, getStageIdForRequest } from "../utils/trackTypes";

export interface DraftPackageContext {
  id: string;
  customer: string;
  programName: string;
  programYear: string;
  year: string;
  targetPlant: string;
  createdBy: string;
  dateRequestCreated: string;
  requestKind: string;
}

export interface DraftPackageGroup extends DraftPackageContext {
  items: SampleRequestItem[];
}

export interface DraftPackagesViewProps {
  requests: SampleRequestItem[];
  matchingRequestIds: ReadonlySet<string>;
  isLoading: boolean;
  selectedYear: string;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const packageKeyPart = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

export const DraftPackagesView: React.FC<DraftPackagesViewProps> = ({
  requests,
  matchingRequestIds,
  isLoading,
  selectedYear,
  currentPage,
  pageSize,
  onPageChange,
}) => {
  const navigate = useNavigate();

  const packageGroups = useMemo(() => {
    const groups = new Map<string, DraftPackageGroup>();

    for (const item of requests) {
      if (getRequestTrackType(item) !== "marketing_request" || getStageIdForRequest(item) !== "draft") {
        continue;
      }

      const customer = item.customer?.trim() || "Unassigned Customer";
      const programName = item.programName?.trim() || item.programCampaignTitle?.trim() || "Standard Program";
      const rawYear = item.programYear || item.year || "2026";
      const programYear = String(rawYear).replace(/BTS/gi, "").trim();
      const requestKind = item.requestKind === "design" || String(item.id).startsWith("design-")
        ? "design"
        : "sample";
      const key = JSON.stringify([customer, programName, programYear].map(packageKeyPart));

      const existing = groups.get(key);
      if (existing) {
        if (existing.requestKind !== requestKind) existing.requestKind = "mixed";
        existing.items.push(item);
        continue;
      }

      groups.set(key, {
        id: key,
        customer,
        programName,
        programYear,
        year: selectedYear,
        targetPlant: item.targetPlant || "1505- Khaniwade",
        createdBy: item.createdBy || "Marketing",
        dateRequestCreated: item.dateRequestCreated || item.createdAt || "",
        requestKind,
        items: [item],
      });
    }

    return Array.from(groups.values())
      .filter((group) => group.items.some((item) => matchingRequestIds.has(String(item.id))))
      .sort((a, b) => b.items.length - a.items.length || a.programName.localeCompare(b.programName));
  }, [matchingRequestIds, requests, selectedYear]);

  const handleOpenWorkspace = useCallback((group: DraftPackageGroup) => {
    const context: DraftPackageContext = {
      id: group.id,
      customer: group.customer,
      programName: group.programName,
      programYear: group.programYear,
      year: group.year,
      targetPlant: group.targetPlant,
      createdBy: group.createdBy,
      dateRequestCreated: group.dateRequestCreated,
      requestKind: group.requestKind,
    };
    try {
      sessionStorage.setItem("samp_active_draft_group", JSON.stringify(context));
    } catch {
      // The route state remains available for this navigation if session storage is full.
    }
    navigate("/sample-requests/draft-workspace", { state: { package: context } });
  }, [navigate]);

  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return packageGroups.slice(start, start + pageSize);
  }, [currentPage, pageSize, packageGroups]);

  const columns = useMemo<ColumnDef<DraftPackageGroup>[]>(() => [
    {
      id: "customer",
      header: "Customer",
      width: "25%",
      cell: (group) => (
        <span className="inline-flex min-w-0 items-center gap-2 font-medium text-[var(--text-primary)]">
          <Building2 className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          <span className="truncate" title={group.customer}>{group.customer}</span>
        </span>
      ),
    },
    {
      id: "programName",
      header: "Program Name",
      width: "35%",
      cell: (group) => (
        <span className="block truncate font-semibold text-[var(--text-primary)]" title={group.programName}>
          {group.programName}
        </span>
      ),
    },
    {
      id: "programYear",
      header: "Program Year",
      width: "18%",
      cell: (group) => (
        <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
          <Calendar className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden="true" />
          {group.programYear}
        </span>
      ),
    },
    {
      id: "draftCount",
      header: "Draft Items",
      align: "center",
      width: "12%",
      cell: (group) => (
        <span className="inline-flex items-center justify-center gap-1.5 font-medium tabular-nums text-[var(--text-secondary)]">
          <Package className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden="true" />
          {group.items.length}
        </span>
      ),
    },
    {
      id: "action",
      header: <span className="block text-right">Action</span>,
      align: "right",
      width: "180px",
      cell: (group) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            handleOpenWorkspace(group);
          }}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--accent-primary)] transition hover:bg-[var(--accent-primary-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
          aria-label={`Open staging for ${group.customer}, ${group.programName}, ${group.programYear}`}
        >
          Open staging <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ),
    },
  ], [handleOpenWorkspace]);

  const hasDrafts = requests.some((item) => getStageIdForRequest(item) === "draft");
  const emptyMessage = hasDrafts
    ? "No draft groups match these filters. Adjust the search or filters and try again."
    : "No drafts to release. Saved products will appear grouped by customer, program, and year.";

  return (
    <section className="space-y-3 p-4 sm:p-6" aria-labelledby="draft-groups-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="draft-groups-heading" className="text-sm font-semibold text-[var(--on-surface)]">
          Drafts grouped by program
        </h2>
        <p className="text-xs text-[var(--on-surface-subtle)]">
          Open a group to review its products and release them together.
        </p>
      </div>

      <DataTable
        data={paginatedGroups}
        columns={columns}
        keyExtractor={(group) => group.id}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        onRowClick={handleOpenWorkspace}
        currentPage={currentPage}
        pageSize={pageSize}
        totalCount={packageGroups.length}
        onPageChange={onPageChange}
        toolbarLeft={(
          <span className="text-xs text-[var(--text-secondary)]">
            <span className="font-semibold tabular-nums text-[var(--text-primary)]">
              {packageGroups.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              {packageGroups.length > 0 && <> - {Math.min(currentPage * pageSize, packageGroups.length)}</>}
            </span>{" "}
            of <span className="font-semibold tabular-nums text-[var(--text-primary)]">{packageGroups.length}</span> program groups
          </span>
        )}
      />
    </section>
  );
};

export default DraftPackagesView;
