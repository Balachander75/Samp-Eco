import React, { useState, useMemo } from "react";
import { CostingItem } from "../types";
import {
  X,
  TrendingUp,
  Coins,
  FileSpreadsheet,
  Receipt,
  Zap,
  Download,
  Copy,
} from "lucide-react";

export interface CostingInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: CostingItem | null;
  simulatedMargin: number;
  setSimulatedMargin: (val: number) => void;
  onReleaseQuote: () => Promise<void> | void;
  showToast: (msg: string) => void;
}

export const CostingInspectorModal: React.FC<CostingInspectorModalProps> = ({
  isOpen,
  onClose,
  item,
  simulatedMargin,
  setSimulatedMargin,
  onReleaseQuote,
  showToast,
}) => {
  const [inspectorTab, setInspectorTab] = useState<"simulator" | "bom" | "quote">("simulator");

  const calculatedSellingPrice = useMemo(() => {
    if (!item) return 0;
    return item.netUnitCost / (1 - simulatedMargin / 100);
  }, [item, simulatedMargin]);

  const calculatedTotalValue = useMemo(() => {
    if (!item) return 0;
    return Math.round(calculatedSellingPrice * item.targetVolume);
  }, [item, calculatedSellingPrice]);

  const calculatedGrossProfit = useMemo(() => {
    if (!item) return 0;
    return Math.round(calculatedTotalValue - item.netUnitCost * item.targetVolume);
  }, [item, calculatedTotalValue]);

  if (!isOpen || !item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-smooth-backdrop"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-5xl max-h-[94vh] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden animate-smooth-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 bg-white dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100">
              {item.costingCode}
            </span>
            <span className="text-[11px] font-mono text-zinc-400">({item.customer})</span>
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{item.productTitle}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
              [Esc]
            </span>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Context Strip */}
        <div className="grid grid-cols-3 border-b border-zinc-200 dark:border-white/[0.08] bg-zinc-50/40 dark:bg-zinc-900 divide-x divide-zinc-200 dark:divide-white/[0.08] shrink-0 text-xs p-2.5">
          <div>
            <span className="block text-[10px] uppercase font-bold text-zinc-400">Order Run Volume</span>
            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100 truncate block tabular-nums">
              {item.targetVolume.toLocaleString()} pcs
            </span>
          </div>
          <div className="pl-3">
            <span className="block text-[10px] uppercase font-bold text-zinc-400">Net Cost / Pc</span>
            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100 truncate block tabular-nums">
              ₹ {item.netUnitCost.toFixed(2)}
            </span>
          </div>
          <div className="pl-3">
            <span className="block text-[10px] uppercase font-bold text-zinc-400">Current Quote</span>
            <span className="font-mono font-bold text-brand-600 dark:text-brand-400 truncate block tabular-nums">
              ₹ {item.quotedUnitPrice.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900 px-3 shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setInspectorTab("simulator")}
            className={`h-9 px-3.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
              inspectorTab === "simulator"
                ? "border-brand-600 text-brand-600 dark:text-brand-400"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            Live Margin Simulator
          </button>
          <button
            type="button"
            onClick={() => setInspectorTab("bom")}
            className={`h-9 px-3.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
              inspectorTab === "bom"
                ? "border-brand-600 text-brand-600 dark:text-brand-400"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Bill of Materials (BOM)
          </button>
          <button
            type="button"
            onClick={() => setInspectorTab("quote")}
            className={`h-9 px-3.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
              inspectorTab === "quote"
                ? "border-brand-600 text-brand-600 dark:text-brand-400"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            Formal Quote Summary
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* TAB 1: LIVE MARGIN SIMULATOR */}
          {inspectorTab === "simulator" && (
            <div className="space-y-4">
              {/* Interactive Slider Card */}
              <div className="rounded-lg border border-brand-200/80 dark:border-brand-900/60 bg-brand-50/40 dark:bg-brand-950/20 p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-brand-600" />
                    Interactive Target Margin Calculator:
                  </span>
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-sm bg-brand-600 text-white tabular-nums">
                    {simulatedMargin.toFixed(1)}% Margin
                  </span>
                </div>

                <div className="space-y-1.5">
                  <input
                    type="range"
                    min="12"
                    max="38"
                    step="0.5"
                    value={simulatedMargin}
                    onChange={(e) => setSimulatedMargin(parseFloat(e.target.value))}
                    className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-brand-600"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                    <span>12% (Min Breakeven)</span>
                    <span>25% (Standard Target)</span>
                    <span>38% (Premium Luxury)</span>
                  </div>
                </div>
              </div>

              {/* Real-time Dynamic Financial Metrics */}
              <div className="rounded-md border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900 p-4 space-y-3 shadow-xs">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  Calculated Project Financials ({item.targetVolume.toLocaleString()} pcs):
                </h4>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/60 dark:border-white/[0.08]">
                    <span className="block text-[10px] font-bold text-zinc-400 uppercase">Calculated Quoted Selling Price</span>
                    <span className="font-mono text-lg font-extrabold text-brand-600 dark:text-brand-400 mt-1 block tabular-nums">
                      ₹ {calculatedSellingPrice.toFixed(2)} <span className="text-xs font-normal text-zinc-400">/ pc</span>
                    </span>
                  </div>
                  <div className="p-3 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/60 dark:border-white/[0.08]">
                    <span className="block text-[10px] font-bold text-zinc-400 uppercase">Total Contract Value</span>
                    <span className="font-mono text-lg font-extrabold text-zinc-900 dark:text-zinc-100 mt-1 block tabular-nums">
                      ₹ {calculatedTotalValue.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/60 dark:border-white/[0.08]">
                    <span className="block text-[10px] font-bold text-zinc-400 uppercase">Total Net Production Cost</span>
                    <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block tabular-nums">
                      ₹ {(item.netUnitCost * item.targetVolume).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 rounded bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60">
                    <span className="block text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">Project Gross Profit</span>
                    <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-300 mt-1 block tabular-nums">
                      + ₹ {calculatedGrossProfit.toLocaleString()}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onReleaseQuote}
                  className="w-full h-10 px-4 rounded-md bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-[13px] flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors mt-2"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>Lock Margin & Release Official Quote to Marketing</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: BOM ITEMIZED BREAKDOWN */}
          {inspectorTab === "bom" && (
            <div className="space-y-4">
              <div className="rounded-md border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900 p-4 space-y-3">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-brand-600" />
                  Detailed Bill of Materials (BOM) Cost Breakdown / Pc:
                </h4>

                <div className="divide-y divide-zinc-100 dark:divide-white/5 font-mono text-xs">
                  <div className="py-2 flex justify-between">
                    <span className="text-zinc-500">1. Raw Board / Paper Substrate:</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">₹ {item.substrateUnitCost.toFixed(2)}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-zinc-500">2. Printing Inks & Overvarnish:</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">₹ {(item.conversionUnitCost * 0.35).toFixed(2)}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-zinc-500">3. Foiling, Lamination & Spot UV:</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">₹ {(item.conversionUnitCost * 0.25).toFixed(2)}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-zinc-500">4. Die-Cutting & Stripping Labor:</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">₹ {(item.conversionUnitCost * 0.22).toFixed(2)}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-zinc-500">5. Folder-Gluing / Box Assembly:</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">₹ {(item.conversionUnitCost * 0.12).toFixed(2)}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-zinc-500">6. Master Shipper & Palletizing:</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">₹ {(item.conversionUnitCost * 0.06).toFixed(2)}</span>
                  </div>
                  <div className="py-2.5 flex justify-between border-t-2 border-zinc-200 dark:border-white/[0.08] font-bold text-sm">
                    <span>Total Production Cost (BOM):</span>
                    <span className="text-brand-600 dark:text-brand-400 tabular-nums">₹ {item.netUnitCost.toFixed(2)} / pc</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FORMAL QUOTE SUMMARY */}
          {inspectorTab === "quote" && (
            <div className="space-y-4">
              <div className="rounded-md border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900 p-4 space-y-3.5 shadow-xs">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-brand-600" />
                    Commercial Quotation Document:
                  </h4>
                  <span className="font-mono text-[10px] text-zinc-400">{item.costingCode}</span>
                </div>

                <div className="p-3.5 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/[0.08] space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">To Customer:</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">{item.customer}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Product Title:</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{item.productTitle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Order Volume:</span>
                    <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200 tabular-nums">{item.targetVolume.toLocaleString()} pcs</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-200/60 dark:border-white/[0.08] pt-2">
                    <span className="text-zinc-500">Official Quoted Rate:</span>
                    <span className="font-mono font-extrabold text-sm text-brand-600 dark:text-brand-400 tabular-nums">
                      ₹ {item.quotedUnitPrice.toFixed(2)} / pc
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Total Purchase Order Value:</span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                      ₹ {item.totalProjectValue.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => showToast(`Downloaded quotation PDF for ${item.costingCode}`)}
                    className="h-10 px-4 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 font-bold text-[13px] flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download PDF Quote</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`Quotation ${item.costingCode}: ₹${item.quotedUnitPrice}/pc for ${item.targetVolume} pcs`);
                      showToast("Commercial summary copied to clipboard");
                    }}
                    className="h-10 px-4 rounded-md bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-[13px] flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy Quote Summary</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-white/[0.08] bg-zinc-50/50 dark:bg-zinc-900 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
            <span>Code: {item.costingCode}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-md bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-mono font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
