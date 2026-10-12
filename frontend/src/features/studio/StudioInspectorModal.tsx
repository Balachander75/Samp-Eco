import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  FileCode2,
  Box,
  CheckCircle2,
  Download,
  Copy,
  Check,
  ExternalLink,
  Layers,
  Sparkles,
  Scissors,
} from "lucide-react";
import { DielineItem } from "@/features/sample-requests/types";
import { StatusPill } from "@/components/ui/StatusPill";

export interface StudioInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  dieline: DielineItem | null;
  onUpdateStatus: (id: string, newStatus: DielineItem["status"]) => Promise<void>;
}

export const StudioInspectorModal: React.FC<StudioInspectorModalProps> = ({
  isOpen,
  onClose,
  dieline,
  onUpdateStatus,
}) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"cad" | "simulation" | "export">("cad");
  const [isUpdating, setIsUpdating] = useState(false);

  if (!isOpen || !dieline) return null;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleApplyStatus = async (newStatus: DielineItem["status"]) => {
    setIsUpdating(true);
    try {
      await onUpdateStatus(dieline.id, newStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-smooth-backdrop"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-5xl max-h-[94vh] flex flex-col bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-smooth-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.08] bg-slate-50/70 dark:bg-zinc-900 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center flex-wrap gap-2.5">
            <span className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-200/80 dark:border-indigo-800/40 text-xs font-mono font-bold text-indigo-700 dark:text-indigo-400 shadow-xs">
              {dieline.dielineCode}
              <button
                type="button"
                onClick={() => handleCopyCode(dieline.dielineCode)}
                className="text-indigo-700 hover:text-indigo-900 dark:hover:text-indigo-300 cursor-pointer ml-1"
                title="Copy Dieline Code"
              >
                {copiedCode === dieline.dielineCode ? <Check className="w-3 h-3 text-indigo-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </span>
            <span className="text-xs font-mono text-slate-500 font-semibold">({dieline.client})</span>
            <span className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate max-w-md">{dieline.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Context Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-100 dark:border-white/[0.08] bg-white dark:bg-zinc-900 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-white/[0.08] shrink-0 text-xs p-4 gap-y-3 sm:gap-y-0">
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400">Box Format</span>
            <span className="font-semibold text-slate-900 dark:text-zinc-100 truncate block mt-0.5">{dieline.boxFormat}</span>
          </div>
          <div className="sm:pl-4">
            <span className="block text-[10px] uppercase font-bold text-slate-400">Dimensions (L×W×H)</span>
            <span className="font-mono font-bold text-slate-900 dark:text-zinc-100 truncate block mt-0.5">{dieline.dimensions}</span>
          </div>
          <div className="sm:pl-4">
            <span className="block text-[10px] uppercase font-bold text-slate-400">Substrate &amp; Caliper</span>
            <span className="font-mono font-bold text-slate-900 dark:text-zinc-100 truncate block mt-0.5">
              {dieline.substrate} ({dieline.caliperMicrons}µm)
            </span>
          </div>
          <div className="sm:pl-4">
            <span className="block text-[10px] uppercase font-bold text-slate-400">Plant / Die Tooling</span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 truncate block mt-0.5">{dieline.targetPlant}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-white/[0.08] bg-slate-50/50 dark:bg-zinc-900 px-6 shrink-0 gap-3">
          <button
            type="button"
            onClick={() => setInspectorTab("cad")}
            className={`h-10 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
              inspectorTab === "cad"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-zinc-200"
            }`}
          >
            Structural CAD Blueprint
          </button>
          <button
            type="button"
            onClick={() => setInspectorTab("simulation")}
            className={`h-10 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
              inspectorTab === "simulation"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-zinc-200"
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            3D Fold &amp; Plotter Verification
          </button>
          <button
            type="button"
            onClick={() => setInspectorTab("export")}
            className={`h-10 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
              inspectorTab === "export"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-zinc-200"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            CAD Export (.DXF, .CF2, .PDF)
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {inspectorTab === "cad" && (
            <div className="space-y-4">
              {/* CAD Vector Simulator Frame */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-inner min-h-[220px]">
                <div className="border border-emerald-500/40 border-dashed rounded-xl p-8 w-72 flex flex-col items-center justify-center relative bg-emerald-950/20">
                  <div className="w-40 h-28 border-2 border-emerald-400 border-dashed flex items-center justify-center text-emerald-400 font-mono text-[11px] font-bold">
                    <span>CUT LINE</span>
                  </div>
                  <div className="w-full border-t border-rose-400 border-dotted mt-3 pt-1 text-[10px] font-mono text-rose-300">
                    CREASE / SCORE LINE
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-4 font-mono text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-emerald-400 inline-block" /> Solid = Cut (100%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-rose-400 border-t border-dotted inline-block" /> Dotted = Crease / Perforation
                  </span>
                </div>
              </div>

              {/* Engineering Parameters */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50/80 dark:bg-zinc-800/60 rounded-xl border border-slate-200/80 dark:border-zinc-700">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Grain Direction</span>
                  <div className="font-mono font-bold text-xs text-slate-900 dark:text-zinc-100 mt-1">
                    {dieline.grainDirection}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50/80 dark:bg-zinc-800/60 rounded-xl border border-slate-200/80 dark:border-zinc-700">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Machine Compatibility</span>
                  <div className="font-mono font-bold text-xs text-slate-900 dark:text-zinc-100 mt-1">
                    {dieline.machineCompatibility}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50/80 dark:bg-zinc-800/60 rounded-xl border border-slate-200/80 dark:border-zinc-700">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Flute Grade</span>
                  <div className="font-mono font-bold text-xs text-slate-900 dark:text-zinc-100 mt-1">
                    {dieline.fluteGrade || "E-Flute (Single Wall)"}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50/80 dark:bg-zinc-800/60 rounded-xl border border-slate-200/80 dark:border-zinc-700">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Engineering Status</span>
                  <div className="font-bold text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                    {dieline.status}
                  </div>
                </div>
              </div>
            </div>
          )}

          {inspectorTab === "simulation" && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 space-y-3 shadow-xs">
                <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Box className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Kinematic 3D Fold Simulation &amp; Laser Die Clearance
                </h4>
                <p className="text-xs text-slate-500">
                  Verify folding mechanics, tuck flap retention, and substrate thickness compensation before releasing tooling files to plant die-makers.
                </p>

                <div className="flex flex-wrap items-center gap-2.5 pt-4 border-t border-slate-100 dark:border-zinc-800">
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleApplyStatus("Laser Die Cleared")}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Clear for Laser Die Tooling</span>
                  </button>

                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleApplyStatus("Plotter Sample Tested")}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Confirm Plotter Sample Tested
                  </button>

                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleApplyStatus("3D Simulation")}
                    className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Mark in 3D Simulation
                  </button>
                </div>
              </div>
            </div>
          )}

          {inspectorTab === "export" && (
            <div className="space-y-3">
              <div className="p-5 bg-slate-50/70 dark:bg-zinc-800/40 rounded-2xl border border-slate-200/80 dark:border-zinc-700 space-y-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Export Structural Production Files
                </h4>
                <p className="text-xs text-slate-500">
                  Download standard CAD formats for Kongsberg plotters, ArtiosCAD, and CNC laser die-cut tables.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => alert(`Downloading AutoCAD DXF package for ${dieline.dielineCode}...`)}
                    className="p-3.5 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200/80 text-left hover:border-indigo-500 transition cursor-pointer flex items-center justify-between shadow-xs"
                  >
                    <div>
                      <span className="block font-bold text-xs text-slate-900 dark:text-zinc-100">AutoCAD (.DXF)</span>
                      <span className="text-[10px] text-slate-400 font-mono">Die-maker standard</span>
                    </div>
                    <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => alert(`Downloading Common File Format (.CF2) for ${dieline.dielineCode}...`)}
                    className="p-3.5 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200/80 text-left hover:border-indigo-500 transition cursor-pointer flex items-center justify-between shadow-xs"
                  >
                    <div>
                      <span className="block font-bold text-xs text-slate-900 dark:text-zinc-100">ArtiosCAD (.CF2)</span>
                      <span className="text-[10px] text-slate-400 font-mono">Kongsberg Plotter</span>
                    </div>
                    <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => alert(`Downloading 1:1 Scale Print PDF for ${dieline.dielineCode}...`)}
                    className="p-3.5 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200/80 text-left hover:border-indigo-500 transition cursor-pointer flex items-center justify-between shadow-xs"
                  >
                    <div>
                      <span className="block font-bold text-xs text-slate-900 dark:text-zinc-100">1:1 Dieline PDF</span>
                      <span className="text-[10px] text-slate-400 font-mono">Client Verification</span>
                    </div>
                    <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-white/[0.08] bg-slate-50/70 dark:bg-zinc-900 flex items-center justify-between shrink-0">
          <span className="text-[11px] font-mono text-slate-500">
            Dieline Code: {dieline.dielineCode} · Machine: {dieline.machineCompatibility}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold cursor-pointer shadow-xs transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default StudioInspectorModal;
