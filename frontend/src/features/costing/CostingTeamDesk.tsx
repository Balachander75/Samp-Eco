import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { UserProfile } from "@/features/auth";
import { fetchCostingEstimationsApi, updateCostingEstimationApi } from "@/infrastructure/api/downstreamApi";
import { DataTable, ColumnDef } from "@/components/erp/DataTable";
import { DeskWorkspaceLayout } from "@/components/erp";
import { StatusPill } from "@/components/ui/StatusPill";
import { Select } from "@/components/ui/Select";
import { useBusinessYear } from "@/context/BusinessYearContext";
import {
  Search,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Clock,
  Download,
  Copy,
  Check,
  Eye,
  CheckSquare,
  Square,
  Sliders,
  Calculator,
  Coins,
  Receipt,
  FileSpreadsheet,
  TrendingUp,
} from "lucide-react";
import { CostingItem } from "./types";
import { CostingInspectorModal } from "./components/CostingInspectorModal";
import { CostingRequestInspectorModal } from "./components/CostingRequestInspectorModal";
import { SampleRequestItem } from "@/features/sample-requests/types";
import { fetchSampleRequestsApi, updateSampleRequestApi } from "@/infrastructure/api/sampleRequestsApi";

export interface CostingTeamDeskProps {
  user?: UserProfile | null;
}

// Re-exported from ./types
interface LegacyCostingItem {
  id: string;
  costingCode: string;
  srNumber: string;
  customer: string;
  productTitle: string;
  targetVolume: number; // in pcs
  substrateUnitCost: number; // INR
  conversionUnitCost: number; // INR
  netUnitCost: number; // substrate + conversion
  marginPct: number; // e.g. 24.5%
  quotedUnitPrice: number; // calculated from margin
  totalProjectValue: number; // targetVolume * quotedUnitPrice
  status: "Spec Review" | "Substrate Pricing" | "Margin Review" | "Quote Released" | "Won Deal";
  dueDate: string;
  targetPlant: string;
  substrateSpec: string;
}

interface StageStep {
  id: string;
  stepNumber: string;
  label: string;
  count: number;
}

const INITIAL_COSTINGS: CostingItem[] = [];

const COSTING_STAGES: { id: string; stepNumber: string; label: string }[] = [
  { id: "all", stepNumber: "ALL", label: "All Costing Requests" },
  { id: "specs", stepNumber: "01", label: "Spec Review" },
  { id: "substrate", stepNumber: "02", label: "Substrate Pricing" },
  { id: "margin", stepNumber: "03", label: "Margin Review" },
  { id: "quote", stepNumber: "04", label: "Quote Released" },
  { id: "won", stepNumber: "05", label: "Won Deals" },
];

export const CostingWorkbench: React.FC<CostingTeamDeskProps> = ({ user }) => {
  const { selectedYear } = useBusinessYear();
  const [costings, setCostings] = useState<CostingItem[]>(INITIAL_COSTINGS);
  const [selectedStageId, setSelectedStageId] = useState<string>("all");
  const [quickFilter, setQuickFilter] = useState<"none" | "intake" | "margin_review" | "released" | "won">("none");
  const [selectedVolumeTier, setSelectedVolumeTier] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [costingRequests, setCostingRequests] = useState<SampleRequestItem[]>([]);
  const [selectedCostingRequest, setSelectedCostingRequest] = useState<SampleRequestItem | null>(null);
  const [isSubmittingCostingOutput, setIsSubmittingCostingOutput] = useState(false);
  const [isOfferingCostingCounterDate, setIsOfferingCostingCounterDate] = useState(false);

  // Sync from cross-desk API on mount
  const loadCostings = useCallback(async () => {
    try {
      const [live, requests] = await Promise.all([
        fetchCostingEstimationsApi().catch(() => []),
        fetchSampleRequestsApi(undefined, false, "costing").catch(() => []),
      ]);
      if (Array.isArray(live)) {
        setCostings(live);
      }
      if (Array.isArray(requests)) {
        setCostingRequests(requests.filter((request) => {
          const status = String(request.status || "").toLowerCase();
          return request.requestTypes?.includes("costing") &&
            !status.includes("complete") && !status.includes("marketing") &&
            !status.includes("closed") && !status.includes("cancel") && !status.includes("reject");
        }));
      }
    } catch {
      // Keep existing state
    }
  }, []);

  const handleSubmitCostingOutput = async (counterDate: string, outputPath: string) => {
    if (!selectedCostingRequest) return;
    setIsSubmittingCostingOutput(true);
    try {
      const updated = await updateSampleRequestApi(selectedCostingRequest.id, {
        costingCounterDate: counterDate || null,
        costingOutputPath: outputPath.trim(),
        status: "Marketing Review",
      });
      if (!updated) throw new Error("The costing handoff could not be saved.");
      setSelectedCostingRequest(null);
      await loadCostings();
      showToast(`Costing output sent to Marketing for ${updated.srNumber || selectedCostingRequest.srNumber}.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not submit costing output.");
    } finally {
      setIsSubmittingCostingOutput(false);
    }
  };

  const handleOfferCostingCounterDate = async (counterDate: string) => {
    if (!selectedCostingRequest || !counterDate) return;
    setIsOfferingCostingCounterDate(true);
    try {
      const updated = await updateSampleRequestApi(selectedCostingRequest.id, {
        costingCounterDate: counterDate,
        status: "Costing Counter Date Offered",
      });
      if (!updated) throw new Error("The counter date could not be saved.");
      setSelectedCostingRequest(updated);
      setCostingRequests((previous) => previous.map((request) => request.id === updated.id ? updated : request));
      showToast(`Counter date offered for ${updated.srNumber}.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not offer the counter date.");
    } finally {
      setIsOfferingCostingCounterDate(false);
    }
  };

  useEffect(() => {
    loadCostings();
  }, [loadCostings]);

  useEffect(() => {
    const handleRefresh = (event: Event) => {
      event.preventDefault();
      void loadCostings().finally(() => window.dispatchEvent(new Event("app:refresh-complete")));
    };
    window.addEventListener("app:refresh-requested", handleRefresh);
    return () => window.removeEventListener("app:refresh-requested", handleRefresh);
  }, [loadCostings]);

  // Inspector & Simulation State
  const [selectedItem, setSelectedItem] = useState<CostingItem | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"bom" | "simulator" | "quote">("simulator");
  const [simulatedMargin, setSimulatedMargin] = useState<number>(24.0);

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Copy code feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1200);
  };

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Stage steps
  const stageSteps: StageStep[] = useMemo(() => {
    return COSTING_STAGES.map((st) => {
      let count = 0;
      if (st.id === "all") count = costings.length;
      else if (st.id === "specs") count = costings.filter((c) => c.status === "Spec Review").length;
      else if (st.id === "substrate") count = costings.filter((c) => c.status === "Substrate Pricing").length;
      else if (st.id === "margin") count = costings.filter((c) => c.status === "Margin Review").length;
      else if (st.id === "quote") count = costings.filter((c) => c.status === "Quote Released").length;
      else if (st.id === "won") count = costings.filter((c) => c.status === "Won Deal").length;

      return {
        id: st.id,
        stepNumber: st.stepNumber,
        label: st.label,
        count,
      };
    });
  }, [costings]);

  // Canonical KPI items matching DeskWorkspaceLayout
  const kpiItems = useMemo(() => {
    const total = costings.length;
    const marginReview = costings.filter((c) => c.status === "Margin Review").length;
    const released = costings.filter((c) => c.status === "Quote Released").length;
    const wonCount = costings.filter((c) => c.status === "Won Deal").length;
    const wonValue = costings
      .filter((c) => c.status === "Won Deal" || c.status === "Quote Released")
      .reduce((acc, c) => acc + c.totalProjectValue, 0);

    const formattedPipelineValue = `₹ ${(wonValue / 100000).toFixed(1)}L`;

    return [
      {
        label: "All Costings",
        value: total,
        detail: "BOM & Commercial Pipeline",
        color: "bg-indigo-500",
        isActive: selectedStageId === "all" && quickFilter === "none" && selectedVolumeTier === "all",
        onClick: () => {
          setSelectedStageId("all");
          setQuickFilter("none");
          setSelectedVolumeTier("all");
        },
      },
      {
        label: "Request Intake",
        value: costingRequests.length,
        detail: costingRequests.length > 0 ? `${costingRequests.length} pending review` : "Queue clear",
        color: "bg-amber-500",
        isActive: quickFilter === "intake",
        onClick: () => {
          setQuickFilter((prev) => (prev === "intake" ? "none" : "intake"));
        },
      },
      {
        label: "Margin Review",
        value: marginReview,
        detail: marginReview > 0 ? "Committee queue" : "All approved",
        color: "bg-rose-500",
        isActive: quickFilter === "margin_review",
        onClick: () => {
          setQuickFilter((prev) => (prev === "margin_review" ? "none" : "margin_review"));
          setSelectedStageId("all");
        },
      },
      {
        label: "Quotations Released",
        value: released,
        detail: "Active with Marketing Desk",
        color: "bg-emerald-500",
        isActive: quickFilter === "released",
        onClick: () => {
          setQuickFilter((prev) => (prev === "released" ? "none" : "released"));
          setSelectedStageId("all");
        },
      },
      {
        label: "Won Deals",
        value: wonCount,
        detail: `${formattedPipelineValue} Gross revenue`,
        color: "bg-teal-500",
        isActive: quickFilter === "won",
        onClick: () => {
          setQuickFilter((prev) => (prev === "won" ? "none" : "won"));
          setSelectedStageId("all");
        },
      },
    ];
  }, [costings, costingRequests.length, selectedStageId, quickFilter, selectedVolumeTier]);

  // Filtering
  const filteredCostings = useMemo(() => {
    return costings.filter((c) => {
      // Quick filter
      if (quickFilter === "margin_review" && c.status !== "Margin Review") return false;
      if (quickFilter === "released" && c.status !== "Quote Released") return false;
      if (quickFilter === "won" && c.status !== "Won Deal") return false;

      // Stage filter
      if (selectedStageId !== "all") {
        if (selectedStageId === "specs" && c.status !== "Spec Review") return false;
        if (selectedStageId === "substrate" && c.status !== "Substrate Pricing") return false;
        if (selectedStageId === "margin" && c.status !== "Margin Review") return false;
        if (selectedStageId === "quote" && c.status !== "Quote Released") return false;
        if (selectedStageId === "won" && c.status !== "Won Deal") return false;
      }

      // Volume tier filter
      if (selectedVolumeTier !== "all") {
        if (selectedVolumeTier === "small" && c.targetVolume >= 30000) return false;
        if (selectedVolumeTier === "medium" && (c.targetVolume < 30000 || c.targetVolume > 75000)) return false;
        if (selectedVolumeTier === "large" && c.targetVolume <= 75000) return false;
      }

      // Search Query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const match =
          c.costingCode.toLowerCase().includes(q) ||
          c.srNumber.toLowerCase().includes(q) ||
          c.customer.toLowerCase().includes(q) ||
          c.productTitle.toLowerCase().includes(q) ||
          c.targetPlant.toLowerCase().includes(q) ||
          c.substrateSpec.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [costings, quickFilter, selectedStageId, selectedVolumeTier, searchTerm]);

  // Handle open inspector
  const handleSelectRow = (item: CostingItem) => {
    setSelectedItem(item);
    setSimulatedMargin(item.marginPct);
    setInspectorTab("simulator");
    setIsInspectorOpen(true);
  };

  // Toggle selection
  const handleToggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredCostings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCostings.map((c) => c.id)));
    }
  };

  // Live Simulation Calculations
  const calculatedSellingPrice = useMemo(() => {
    if (!selectedItem) return 0;
    // Selling price = Cost / (1 - margin/100)
    const factor = 1 - simulatedMargin / 100;
    return factor > 0 ? Number((selectedItem.netUnitCost / factor).toFixed(2)) : 0;
  }, [selectedItem, simulatedMargin]);

  const calculatedTotalValue = useMemo(() => {
    if (!selectedItem) return 0;
    return Math.round(calculatedSellingPrice * selectedItem.targetVolume);
  }, [selectedItem, calculatedSellingPrice]);

  const calculatedGrossProfit = useMemo(() => {
    if (!selectedItem) return 0;
    const totalCost = selectedItem.netUnitCost * selectedItem.targetVolume;
    return calculatedTotalValue - totalCost;
  }, [selectedItem, calculatedTotalValue]);

  // Action: Save & Release Quote
  const handleReleaseQuote = () => {
    if (!selectedItem) return;
    setCostings((prev) =>
      prev.map((c) =>
        c.id === selectedItem.id
          ? {
              ...c,
              marginPct: simulatedMargin,
              quotedUnitPrice: calculatedSellingPrice,
              totalProjectValue: calculatedTotalValue,
              status: "Quote Released",
            }
          : c
      )
    );
    setSelectedItem((prev) =>
      prev
        ? {
            ...prev,
            marginPct: simulatedMargin,
            quotedUnitPrice: calculatedSellingPrice,
            totalProjectValue: calculatedTotalValue,
            status: "Quote Released",
          }
        : null
    );
    updateCostingEstimationApi(selectedItem.id, {
      marginPct: simulatedMargin,
      quotedUnitPrice: calculatedSellingPrice,
      totalProjectValue: calculatedTotalValue,
      status: "Quote Released",
    });
    showToast(`✓ Commercial Quote released for ${selectedItem.customer} at ₹${calculatedSellingPrice}/pc`);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "Costing Code",
      "SR Number",
      "Customer",
      "Product",
      "Volume (Pcs)",
      "Substrate (₹)",
      "Conversion (₹)",
      "Net Unit Cost (₹)",
      "Margin (%)",
      "Quoted Unit Price (₹)",
      "Total Project Value (₹)",
      "Status",
    ];
    const rows = filteredCostings.map((c) => [
      `"${c.costingCode}"`,
      `"${c.srNumber}"`,
      `"${c.customer}"`,
      `"${c.productTitle}"`,
      c.targetVolume,
      c.substrateUnitCost.toFixed(2),
      c.conversionUnitCost.toFixed(2),
      c.netUnitCost.toFixed(2),
      c.marginPct.toFixed(1),
      c.quotedUnitPrice.toFixed(2),
      c.totalProjectValue,
      `"${c.status}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `navneet_costing_commercial_quotes_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast(`Exported ${filteredCostings.length} commercial costings to CSV`);
  };

  // Table Columns
  const columns: ColumnDef<CostingItem>[] = useMemo(
    () => [
      {
        id: "select",
        header: (
          <div className="flex items-center justify-center pl-1">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              {selectedIds.size > 0 && selectedIds.size === filteredCostings.length ? (
                <CheckSquare className="w-3.5 h-3.5 text-brand-600" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        ),
        width: "w-[36px]",
        align: "center",
        cell: (row) => (
          <div className="flex items-center justify-center pl-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => handleToggleSelectRow(row.id)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              {selectedIds.has(row.id) ? (
                <CheckSquare className="w-3.5 h-3.5 text-brand-600" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        ),
      },
      {
        id: "costingCode",
        header: "Costing ID",
        sortable: true,
        width: "w-[135px]",
        cell: (row) => (
          <div>
            <div className="flex items-center gap-1.5 font-mono text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
              <span>{row.costingCode}</span>
              <button
                type="button"
                onClick={(e) => handleCopyCode(row.costingCode, e)}
                className="p-0.5 rounded text-zinc-400 hover:text-brand-600 cursor-pointer"
              >
                {copiedCode === row.costingCode ? (
                  <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
            <div className="text-[10px] text-zinc-400 font-mono tracking-tight">
              Linked: {row.srNumber}
            </div>
          </div>
        ),
      },
      {
        id: "customer",
        header: "Customer Account",
        width: "w-[160px]",
        cell: (row) => (
          <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs truncate">
            {row.customer}
          </div>
        ),
      },
      {
        id: "productTitle",
        header: "Product Specification",
        width: "min-w-[220px]",
        cell: (row) => (
          <div>
            <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[280px]">
              {row.productTitle}
            </div>
            <div className="text-[10px] text-zinc-400 font-mono truncate max-w-[260px] mt-0.5">
              {row.substrateSpec}
            </div>
          </div>
        ),
      },
      {
        id: "targetVolume",
        header: "Target Run Qty",
        sortable: true,
        width: "w-[125px]",
        cell: (row) => (
          <span className="font-mono tabular-nums text-[12px] font-semibold text-zinc-800 dark:text-zinc-200">
            {row.targetVolume.toLocaleString()} pcs
          </span>
        ),
      },
      {
        id: "netUnitCost",
        header: "Unit Cost (BOM)",
        sortable: true,
        width: "w-[120px]",
        cell: (row) => (
          <div className="flex flex-col font-mono tabular-nums text-[11px]">
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              ₹ {row.netUnitCost.toFixed(2)}
            </span>
            <span className="text-[10px] text-zinc-400">
              Sub: ₹{row.substrateUnitCost.toFixed(1)} · Conv: ₹{row.conversionUnitCost.toFixed(1)}
            </span>
          </div>
        ),
      },
      {
        id: "marginPct",
        header: "Margin %",
        sortable: true,
        width: "w-[95px]",
        cell: (row) => (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono tabular-nums font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/90 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
            <TrendingUp className="w-3 h-3 text-emerald-600" />
            {row.marginPct.toFixed(1)}%
          </span>
        ),
      },
      {
        id: "quotedUnitPrice",
        header: "Selling Price / Pc",
        sortable: true,
        width: "w-[130px]",
        cell: (row) => (
          <div className="flex flex-col font-mono tabular-nums">
            <span className="font-bold text-xs text-brand-600 dark:text-brand-400">
              ₹ {row.quotedUnitPrice.toFixed(2)}
            </span>
            <span className="text-[10px] text-zinc-400">
              Total: ₹ {(row.totalProjectValue / 100000).toFixed(1)}L
            </span>
          </div>
        ),
      },
      {
        id: "status",
        header: "Costing Status",
        sortable: true,
        width: "w-[145px]",
        cell: (row) => <StatusPill status={row.status} size="xs" />,
      },
      {
        id: "actions",
        header: "",
        width: "w-[90px]",
        align: "right",
        cell: (row) => (
          <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => handleSelectRow(row)}
              className="h-8.5 px-3.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            >
              <Calculator className="w-3.5 h-3.5 text-zinc-400" />
              <span>Quote</span>
            </button>
          </div>
        ),
      },
    ],
    [copiedCode, selectedIds, filteredCostings]
  );

  const hasActiveFilters = Boolean(
    searchTerm || selectedVolumeTier !== "all" || selectedStageId !== "all" || quickFilter !== "none"
  );

  return (
    <DeskWorkspaceLayout
      title="Costing & Margin Desk"
      businessYear={selectedYear}
      onRefresh={loadCostings}
      onExportCSV={handleExportCSV}
      exportDisabled={filteredCostings.length === 0}
      kpiItems={kpiItems}
      filterControls={
        <>
          <Select
            aria-label="Filter by costing stage"
            value={selectedStageId}
            onChange={(e) => {
              setSelectedStageId(e.target.value);
              setQuickFilter("none");
            }}
            className="min-w-[150px] max-w-[190px]"
            options={[
              { value: "all", label: "All Stages" },
              { value: "specs", label: "01 · Spec Review" },
              { value: "substrate", label: "02 · Substrate Pricing" },
              { value: "margin", label: "03 · Margin Review" },
              { value: "quote", label: "04 · Quote Released" },
              { value: "won", label: "05 · Won Deals" },
            ]}
          />

          <Select
            aria-label="Filter by volume tier"
            value={selectedVolumeTier}
            onChange={(e) => setSelectedVolumeTier(e.target.value)}
            className="min-w-[130px] max-w-[170px]"
            options={[
              { value: "all", label: "All Volumes" },
              { value: "small", label: "< 30k pcs" },
              { value: "medium", label: "30k - 75k pcs" },
              { value: "large", label: "> 75k pcs" },
            ]}
          />
        </>
      }
      search={{
        value: searchTerm,
        onChange: setSearchTerm,
        placeholder: "Search Costing ID, Customer, Substrate…",
      }}
      hasActiveFilters={hasActiveFilters}
      onResetFilters={() => {
        setSearchTerm("");
        setSelectedVolumeTier("all");
        setSelectedStageId("all");
        setQuickFilter("none");
      }}
      resetFiltersLabel="Clear Filters"
    >
      {/* If intake filter is selected, render the intake queue cards above table */}
      {quickFilter === "intake" && costingRequests.length > 0 && (
        <section className="shrink-0 space-y-3 border-b border-amber-500/20 bg-amber-50/40 px-5 py-3.5 dark:border-amber-500/10 dark:bg-amber-950/20 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--on-surface)] font-display">Costing Request Intake Queue</h2>
              <p className="mt-0.5 text-xs text-[var(--on-surface-muted)]">Review specifications, offer a counter date, and submit the costing output path to Marketing.</p>
            </div>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-mono text-xs font-bold text-amber-700 dark:text-amber-300">{costingRequests.length} open</span>
          </div>
          <div className="grid max-h-[30vh] grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
            {costingRequests.map((request) => (
              <button key={request.id} type="button" onClick={() => setSelectedCostingRequest(request)} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] p-3 text-left transition hover:bg-amber-50 dark:hover:bg-amber-950/25 cursor-pointer shadow-2xs">
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-[var(--on-surface)]">{request.productDescription}</span>
                  <span className="mt-1 block truncate text-[11px] text-[var(--on-surface-muted)]">{request.customer} · {request.srNumber} · Qty {Number(request.qtyDesignCosting || 0).toLocaleString()} {request.unitPcPack || "PC"}</span>
                  <span className="mt-1 block text-[10px] font-medium text-amber-700 dark:text-amber-300">Required {request.costingRequiredDate || "date missing"}</span>
                </span>
                <span className="shrink-0 rounded-lg bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-bold text-white shadow-2xs">Inspect</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-16 right-5 z-[60] flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-2xl text-[12px] font-semibold border border-zinc-800 dark:border-zinc-200/80 max-w-sm animate-smooth-toast">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 4. Dense Data Table */}
      <DataTable
        data={filteredCostings}
        columns={columns}
        keyExtractor={(row) => row.id}
        onRowClick={handleSelectRow}
        selectedRowId={selectedItem?.id}
        totalCount={filteredCostings.length}
        toolbarLeft={
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              Showing <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono">{filteredCostings.length}</span> of{" "}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono">{costings.length}</span> commercial costings
            </span>
          </div>
        }
      />

      {/* 5. Master-Detail Inspector Modal */}
      <CostingInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        item={selectedItem}
        simulatedMargin={simulatedMargin}
        setSimulatedMargin={setSimulatedMargin}
        onReleaseQuote={handleReleaseQuote}
        showToast={showToast}
      />
      <CostingRequestInspectorModal
        request={selectedCostingRequest}
        isSubmitting={isSubmittingCostingOutput}
        isOfferingCounterDate={isOfferingCostingCounterDate}
        onClose={() => setSelectedCostingRequest(null)}
        onSubmit={handleSubmitCostingOutput}
        onOfferCounterDate={handleOfferCostingCounterDate}
      />
    </DeskWorkspaceLayout>
  );
};

export const CostingTeamDesk: React.FC<CostingTeamDeskProps> = ({ user }) => {
  const location = useLocation();
  const activeView: "overview" | "costing" = useMemo(() => {
    const path = location.pathname.toLowerCase();
    if (path.includes("/costing") && path !== "/costing-team") return "costing";
    return "overview";
  }, [location.pathname]);

  // Both Overview and Costing sections kept blank for now as requested:
  // "and in the costing section remove all that section just and add the overview and costing even dont design them we will deisgn it later"
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--surface-base)] text-[var(--on-surface)] overflow-hidden" />
  );
};

export default CostingTeamDesk;

