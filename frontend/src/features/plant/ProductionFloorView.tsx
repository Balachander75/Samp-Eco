import React from "react";
import {
  Activity,
  Cpu,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Gauge,
  Play,
  RotateCcw,
  Wrench,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { SampleRequestItem } from "@/features/sample-requests/types";

export interface ProductionFloorViewProps {
  requests: SampleRequestItem[];
  selectedPlant: string;
  onInspectProgram?: (req: SampleRequestItem) => void;
}

export const ProductionFloorView: React.FC<ProductionFloorViewProps> = ({
  requests,
  selectedPlant,
  onInspectProgram,
}) => {
  // Machine Lines on the plant floor
  const machineLines = [
    {
      id: "line-01",
      name: "Heidelberg Speedmaster XL 106",
      type: "6-Color Offset Printing + UV Coater",
      status: "Running",
      speed: "14,800 sph",
      job: "Scholastic Notebook Covers (ITC Classmate)",
      operator: "R. Sharma (Shift A)",
      targetUnits: "50,000",
      completedUnits: "36,200",
      progress: 72,
    },
    {
      id: "line-02",
      name: "Bobst Novacut 106 ER",
      type: "Automatic Die-Cutter with Blanking",
      status: "Make-Ready",
      speed: "7,500 sph",
      job: "Seasonal Gift Box Blanks",
      operator: "M. Patel (Shift A)",
      targetUnits: "25,000",
      completedUnits: "8,500",
      progress: 34,
    },
    {
      id: "line-03",
      name: "Vega Automatic Folder-Gluer",
      type: "High-Speed Crash-Lock & Straight Line",
      status: "Running",
      speed: "28,000 uph",
      job: "FMCG Corrugated Inner Cartons",
      operator: "D. Verma (Shift A)",
      targetUnits: "40,000",
      completedUnits: "32,400",
      progress: 81,
    },
    {
      id: "line-04",
      name: "Emmeci Automatic Rigid Box Line",
      type: "Premium Rigid Box Forming & Wrapping",
      status: "Tooling Setup",
      speed: "1,200 bph",
      job: "Luxury Confectionery Hard Boxes",
      operator: "S. Kulkarni (Shift A)",
      targetUnits: "12,000",
      completedUnits: "1,200",
      progress: 10,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-zinc-950">
      {/* Top Banner Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Active Press Lines",
            value: "4 Lines Online",
            sub: "Overall Plant OEE: 84.6%",
            icon: Gauge,
            color: "text-emerald-700 dark:text-emerald-400",
            bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60",
          },
          {
            label: "Shift Throughput",
            value: "78,300 Units",
            sub: "+12% above daily target",
            icon: TrendingUp,
            color: "text-teal-700 dark:text-teal-400",
            bg: "bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800/60",
          },
          {
            label: "Tooling & Die Readiness",
            value: "96% Verified",
            sub: "All cutter dies staged in Bay 3",
            icon: Wrench,
            color: "text-sky-700 dark:text-sky-400",
            bg: "bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/60",
          },
          {
            label: "Scheduled Program Batches",
            value: `${requests.length} Programs`,
            sub: `Assigned to Plant ${selectedPlant}`,
            icon: Layers,
            color: "text-purple-700 dark:text-purple-400",
            bg: "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/60",
          },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className={`p-4 rounded-xl border bg-white dark:bg-zinc-900 shadow-2xs flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {card.label}
                </span>
                <div className={`p-1.5 rounded-lg border ${card.bg} ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xl font-bold font-mono text-zinc-950 dark:text-zinc-50">
                  {card.value}
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {card.sub}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Machine Line Status Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-teal-600" />
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Live Production Floor Lines — Plant {selectedPlant}
            </h2>
          </div>
          <span className="text-xs text-zinc-500 font-mono">Shift A · 06:00 - 14:00</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {machineLines.map((line) => (
            <div
              key={line.id}
              className="p-5 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900 shadow-2xs space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {line.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        line.status === "Running"
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                          : line.status === "Make-Ready"
                          ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                          : "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300"
                      }`}
                    >
                      {line.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{line.type}</p>
                </div>
                <span className="text-xs font-mono font-bold text-teal-700 dark:text-teal-400">
                  {line.speed}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-white/[0.04] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Active Job:</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{line.job}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Operator:</span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">{line.operator}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-zinc-500">
                    Run Progress: {line.completedUnits} / {line.targetUnits}
                  </span>
                  <span className="font-bold text-teal-700 dark:text-teal-400">{line.progress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-500 rounded-full transition-all duration-500"
                    style={{ width: `${line.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductionFloorView;
