import React from "react";
import { Truck, CheckCircle2, PackageCheck, Clock, MapPin, Calendar, FileText } from "lucide-react";

export interface DispatchLogisticsViewProps {
  selectedPlant: string;
}

export const DispatchLogisticsView: React.FC<DispatchLogisticsViewProps> = ({ selectedPlant }) => {
  const shipments = [
    {
      manifestId: "DISP-2026-042",
      programRef: "PG-2026-001",
      customer: "ITC Limited (Stationery Div.)",
      destination: "Nagpur Central Distribution Hub",
      pallets: "16 Pallets (32,000 Pcs)",
      carrier: "VRL Logistics (MH-12-RN-8821)",
      eta: "Today, 18:00 IST",
      status: "Dispatched",
    },
    {
      manifestId: "DISP-2026-043",
      programRef: "PG-2026-002",
      customer: "Hindustan Unilever Limited",
      destination: "Bhiwandi Mother Warehouse",
      pallets: "8 Pallets (18,500 Pcs)",
      carrier: "Safexpress Express Freight",
      eta: "Tomorrow, 10:00 IST",
      status: "Staged in Bay 4",
    },
    {
      manifestId: "DISP-2026-044",
      programRef: "PG-2026-003",
      customer: "Pidilite Industries",
      destination: "Vapi Fulfillment Center",
      pallets: "12 Pallets (24,000 Pcs)",
      carrier: "Blue Dart Surface Cargo",
      eta: "Tomorrow, 14:00 IST",
      status: "Packing Lot",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-zinc-950">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500">
              Outbound Dispatches
            </span>
            <span className="p-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
              <Truck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-zinc-950 dark:text-zinc-50 mt-2">
            3 Shipments
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">36 Pallets scheduled for transit</div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500">
              On-Time Delivery SLA
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-zinc-950 dark:text-zinc-50 mt-2">
            98.7%
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">Consistent across all primary carriers</div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500">
              Staging Bay Capacity
            </span>
            <span className="p-1.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200">
              <PackageCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-zinc-950 dark:text-zinc-50 mt-2">
            42% Utilized
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">Bays 1-3 clear for afternoon intake</div>
        </div>
      </div>

      {/* Shipments List */}
      <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Dispatch &amp; Logistics Board — Plant {selectedPlant}
            </h3>
          </div>
          <span className="text-xs text-zinc-500 font-mono">Dock Doors 01 - 06 Active</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3 font-mono font-bold text-zinc-500 uppercase text-[10px]">
                  Manifest ID
                </th>
                <th className="px-4 py-3 font-mono font-bold text-zinc-500 uppercase text-[10px]">
                  Program Ref
                </th>
                <th className="px-4 py-3 font-mono font-bold text-zinc-500 uppercase text-[10px]">
                  Customer &amp; Destination
                </th>
                <th className="px-4 py-3 font-mono font-bold text-zinc-500 uppercase text-[10px]">
                  Pallet Load
                </th>
                <th className="px-4 py-3 font-mono font-bold text-zinc-500 uppercase text-[10px]">
                  Carrier
                </th>
                <th className="px-4 py-3 font-mono font-bold text-zinc-500 uppercase text-[10px]">
                  ETA / Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
              {shipments.map((ship) => (
                <tr key={ship.manifestId} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                    {ship.manifestId}
                  </td>
                  <td className="px-4 py-3 font-mono text-teal-700 dark:text-teal-400 font-semibold">
                    {ship.programRef}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {ship.customer}
                    </span>
                    <span className="block text-zinc-500 text-[11px] flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-zinc-400" />
                      {ship.destination}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-zinc-700 dark:text-zinc-300">
                    {ship.pallets}
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-400">
                    {ship.carrier}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                        ship.status === "Dispatched"
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                          : "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300"
                      }`}
                    >
                      {ship.status}
                    </span>
                    <span className="block text-[11px] text-zinc-500 font-mono mt-1">
                      {ship.eta}
                    </span>
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

export default DispatchLogisticsView;
