import React from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Beaker,
  FileCheck,
  Search,
  Scale,
} from "lucide-react";

export interface QualityControlViewProps {
  selectedPlant: string;
}

export const QualityControlView: React.FC<QualityControlViewProps> = ({ selectedPlant }) => {
  const qcLogs = [
    {
      id: "QC-2026-081",
      programRef: "PG-2026-001",
      testType: "GSM & Caliper Verification",
      substrate: "Maplitho 80 GSM",
      spec: "80 ± 2 GSM / 105 µm",
      actual: "80.4 GSM / 106 µm",
      deltaE: "—",
      status: "Passed",
      inspector: "K. Joshi",
      time: "10:30 AM",
    },
    {
      id: "QC-2026-082",
      programRef: "PG-2026-001",
      testType: "Delta-E Spectrophotometer Color",
      substrate: "Grey Back 300 GSM",
      spec: "ΔE < 2.0 (Brand Cyan)",
      actual: "ΔE = 1.12",
      deltaE: "1.12",
      status: "Passed",
      inspector: "K. Joshi",
      time: "11:15 AM",
    },
    {
      id: "QC-2026-083",
      programRef: "PG-2026-002",
      testType: "Burst Factor (Mullen)",
      substrate: "Kraft Fluting 140 GSM",
      spec: "BF ≥ 18.0",
      actual: "BF = 19.4",
      deltaE: "—",
      status: "Passed",
      inspector: "A. Patil",
      time: "11:45 AM",
    },
    {
      id: "QC-2026-084",
      programRef: "PG-2026-003",
      testType: "Rub Resistance & Scuff Test",
      substrate: "SBS Board 350 GSM",
      spec: "100 rubs @ 4 lbs",
      actual: "Minor coating pick @ 85 rubs",
      deltaE: "—",
      status: "Conditional Hold",
      inspector: "A. Patil",
      time: "12:10 PM",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-zinc-950">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500">
              QC Acceptance Rate
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-zinc-950 dark:text-zinc-50 mt-2">
            99.2%
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">38 of 39 lots passed inspection</div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500">
              Substrate Tolerances
            </span>
            <span className="p-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
              <Scale className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-zinc-950 dark:text-zinc-50 mt-2">
            ±1.8%
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">Strictly within ISO 12647-2 limits</div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500">
              Active Lots on Hold
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-zinc-950 dark:text-zinc-50 mt-2">
            1 Lot
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">Scuff test revision under review</div>
        </div>
      </div>

      {/* QC Logs Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Beaker className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Lab &amp; Floor Quality Inspection Records — Plant {selectedPlant}
            </h3>
          </div>
          <span className="text-xs text-zinc-500 font-mono">ISO 9001 / BRCGS Packaging</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3 font-mono font-bold text-zinc-500 uppercase text-[10px]">
                  QC Log ID
                </th>
                <th className="px-4 py-3 font-mono font-bold text-zinc-500 uppercase text-[10px]">
                  Program Ref
                </th>
                <th className="px-4 py-3 font-mono font-bold text-zinc-500 uppercase text-[10px]">
                  Test Inspection
                </th>
                <th className="px-4 py-3 font-mono font-bold text-zinc-500 uppercase text-[10px]">
                  Substrate
                </th>
                <th className="px-4 py-3 font-mono font-bold text-zinc-500 uppercase text-[10px]">
                  Target Spec vs Actual
                </th>
                <th className="px-4 py-3 font-mono font-bold text-zinc-500 uppercase text-[10px]">
                  Status
                </th>
                <th className="px-4 py-3 font-mono font-bold text-zinc-500 uppercase text-[10px]">
                  Inspector &amp; Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
              {qcLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                    {log.id}
                  </td>
                  <td className="px-4 py-3 font-mono text-teal-700 dark:text-teal-400 font-semibold">
                    {log.programRef}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {log.testType}
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-400">
                    {log.substrate}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-zinc-500">Spec: {log.spec}</span>
                    <span className="block font-mono font-bold text-zinc-900 dark:text-zinc-100">
                      Actual: {log.actual}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                        log.status === "Passed"
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                          : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-500">
                    {log.inspector} · {log.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default QualityControlView;
