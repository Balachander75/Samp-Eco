import React, { useState, useMemo } from "react";
import { UserProfile } from "@/features/auth";
import { PlantItem } from "@/features/sample-requests/types";
import { UserItem } from "@/infrastructure/api/masterApi";
import {
  Building2,
  MapPin,
  Crown,
  Plus,
  Search,
  X,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Layers,
  Factory,
  Cpu,
  PackageCheck,
  Shield,
} from "lucide-react";

interface MembersPlantsPageProps {
  currentUser: UserProfile;
  plants: PlantItem[];
  users: UserItem[];
  isLoading: boolean;
  onOpenPlantModal: (plant?: PlantItem) => void;
  onDeletePlant: (plantId: number, code: string) => void;
}

export const MembersPlantsPage: React.FC<MembersPlantsPageProps> = ({
  currentUser,
  plants,
  users,
  isLoading,
  onOpenPlantModal,
  onDeletePlant,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Summary stats
  const stats = useMemo(() => {
    const total = plants.length;
    const active = plants.filter((p) => p.isActive).length;
    const assignedHeads = users.filter((u) => u.plantCode && u.isTeamHead).length;
    return { total, active, assignedHeads };
  }, [plants, users]);

  // Filtered plants
  const filteredPlants = useMemo(() => {
    return plants.filter((p) => {
      if (statusFilter === "active" && !p.isActive) return false;
      if (statusFilter === "inactive" && p.isActive) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = p.code.toLowerCase().includes(q);
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesLoc = (p.location || "").toLowerCase().includes(q);
        if (!matchesCode && !matchesName && !matchesLoc) return false;
      }
      return true;
    });
  }, [plants, statusFilter, searchQuery]);

  // Plant capabilities helper (domain context for Navneet paper facilities)
  const getPlantCapabilities = (code: string) => {
    if (code === "1505") {
      return ["Central Notebook Hub", "Automated Softcover Line", "Wire-O & Spiral", "High-Speed Ruling"];
    }
    if (code === "1003") {
      return ["Casebound / Hardcover Line", "Luxury Box & Rigid Packaging", "Foil Stamping & Emboss"];
    }
    if (code === "1503") {
      return ["Export Converting Unit", "High-Volume Saddle Stitch", "Palletized Container Dispatch"];
    }
    return ["Commercial Finishing", "Die-Cutting & Creasing", "Manual Assembly"];
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-zinc-950 overflow-y-auto">
      {/* SaaS Highlights Banner */}
      <div className="p-6 pb-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="rounded-xl border border-zinc-200/80 dark:border-white/[0.07] bg-white dark:bg-zinc-900 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium">
              <span>Manufacturing Hubs</span>
              <Factory className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 font-mono tabular-nums">
                {stats.total}
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                {stats.active} Operational
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/80 dark:border-white/[0.07] bg-white dark:bg-zinc-900 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium">
              <span>Plant Managers</span>
              <Crown className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 font-mono tabular-nums">
                {stats.assignedHeads}
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Assigned In-charge
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/80 dark:border-white/[0.07] bg-white dark:bg-zinc-900 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium">
              <span>Coverage Territory</span>
              <MapPin className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 font-mono tabular-nums">
                3
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                States & Union Terr.
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/80 dark:border-white/[0.07] bg-white dark:bg-zinc-900 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium">
              <span>ERP Sync Status</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
                Live
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                SAP Master Matched
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 dark:border-white/[0.06] bg-zinc-50/50 dark:bg-zinc-900/20">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === "all"
                ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-2xs"
                : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-white/[0.08]"
            }`}
          >
            All Facilities ({plants.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === "active"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-white/[0.08]"
            }`}
          >
            Operational ({stats.active})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("inactive")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === "inactive"
                ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-2xs"
                : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-white/[0.08]"
            }`}
          >
            Maintenance / Inactive ({plants.length - stats.active})
          </button>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search code, plant name, state..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenPlantModal()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Facility</span>
          </button>
        </div>
      </div>

      {/* Facilities Grid */}
      <div className="p-6">
        {filteredPlants.length === 0 ? (
          <div className="py-20 text-center text-zinc-400 text-xs border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white/40 dark:bg-zinc-900/20">
            <Building2 className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
            <h3 className="font-semibold text-sm text-zinc-700 dark:text-zinc-300">No facilities found</h3>
            <p className="mt-1 text-zinc-500">No manufacturing plant records matched your search query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPlants.map((plant) => {
              const plantHead = users.find(
                (u) => (u.plantCodes?.length ? u.plantCodes : [u.plantCode]).includes(plant.code) && u.isTeamHead
              );
              const capabilities = getPlantCapabilities(plant.code);

              return (
                <div
                  key={plant.id}
                  className="rounded-2xl border border-zinc-200/90 dark:border-white/[0.08] bg-white dark:bg-zinc-900 p-5.5 flex flex-col justify-between shadow-2xs hover:border-emerald-500/40 hover:shadow-xs transition-all"
                >
                  <div>
                    {/* Facility Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-zinc-950 dark:bg-zinc-800 text-white flex items-center justify-center font-bold font-mono text-sm shadow-xs">
                          {plant.code}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-zinc-950 dark:text-zinc-50">
                            {plant.name}
                          </h3>
                          <span className="text-[11px] font-mono text-zinc-400">
                            SAP Code: {plant.code}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          plant.isActive
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            plant.isActive ? "bg-emerald-500" : "bg-zinc-400"
                          }`}
                        />
                        {plant.isActive ? "Operational" : "Standby"}
                      </span>
                    </div>

                    {/* Facility Details */}
                    <div className="mt-5 space-y-2.5 text-xs">
                      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                        <MapPin className="w-4 h-4 text-zinc-400 shrink-0" />
                        <span>{plant.location || "Location not configured"}</span>
                      </div>

                      {/* Plant In-Charge Section */}
                      <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-white/[0.04] flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center">
                            <Crown className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                              Plant In-charge
                            </span>
                            <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                              {plantHead ? plantHead.name : "Unassigned Head"}
                            </span>
                          </div>
                        </div>
                        {plantHead && (
                          <span className="text-[10px] font-mono text-zinc-400">
                            @{plantHead.userid}
                          </span>
                        )}
                      </div>

                      {/* Core Production Capabilities */}
                      <div className="pt-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block mb-1.5">
                          Key Production Capabilities
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {capabilities.map((cap, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-100 dark:bg-zinc-850 text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-white/[0.04]"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="mt-6 pt-3.5 border-t border-zinc-100 dark:border-white/[0.04] flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenPlantModal(plant)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Edit Facility</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeletePlant(plant.id, plant.code)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200/60 dark:border-red-900/40 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
