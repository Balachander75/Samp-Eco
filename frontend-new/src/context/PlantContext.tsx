import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { apiFetch } from "@/infrastructure/api/client";
import { readAuthToken } from "@/lib/session";

export interface PlantOption {
  code: string;
  name: string;
  displayName: string;
  location: string;
}

export interface PlantContextType {
  selectedPlant: string; // "ALL" or plant code / name from DB
  setSelectedPlant: (plantCode: string) => void;
  plantOptions: PlantOption[];
  activePlantOption: PlantOption | null;
  activePlantLabel: string;
  matchesPlant: (targetPlant?: string | null) => boolean;
  isLoading: boolean;
  reloadPlants: (signal?: AbortSignal) => Promise<void>;
}

const STORAGE_KEY = "samp_active_plant";

const DEFAULT_PLANTS: PlantOption[] = [
  { code: "1505", name: "1505 - Khaniwade", displayName: "1505 — Khaniwade", location: "Khaniwade" },
  { code: "1508", name: "1508 - Vasai", displayName: "1508 — Vasai", location: "Vasai" },
  { code: "1509", name: "1509 - Daman", displayName: "1509 — Daman", location: "Daman" },
];

const PlantContext = createContext<PlantContextType | undefined>(undefined);

export const PlantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedPlant, setSelectedPlantState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "ALL";
    } catch {
      return "ALL";
    }
  });

  const [plantOptions, setPlantOptions] = useState<PlantOption[]>(DEFAULT_PLANTS);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const setSelectedPlant = useCallback((plantCode: string) => {
    setSelectedPlantState(plantCode);
    try {
      localStorage.setItem(STORAGE_KEY, plantCode);
    } catch {}
  }, []);

  const reloadPlants = useCallback(async (signal?: AbortSignal) => {
    if (!readAuthToken()) return;
    try {
      setIsLoading(true);
      const data = await apiFetch<Array<{ code?: unknown; name?: unknown; location?: unknown }>>(
        "/api/v1/plants",
        { signal }
      );
      if (Array.isArray(data) && data.length > 0) {
        const mapped = data
          .filter((plant) => typeof plant.code === "string" && typeof plant.name === "string")
          .map((plant): PlantOption => {
            const code = plant.code as string;
            const name = plant.name as string;
            const cleanName = name.includes("-") ? name.split("-").slice(1).join("-").trim() : name;
            return {
              code,
              name,
              displayName: `${code} — ${cleanName}`,
              location: typeof plant.location === "string" && plant.location.trim()
                ? plant.location
                : "Manufacturing Unit",
            };
          });
        if (mapped.length) setPlantOptions(mapped);
      }
    } catch (err) {
      if (!signal?.aborted) console.warn("Failed to fetch plants from backend, using fallback:", err);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void reloadPlants(controller.signal);
    return () => controller.abort();
  }, [reloadPlants]);

  const activePlantOption = useMemo(() => {
    if (selectedPlant === "ALL") return null;
    return plantOptions.find((p) => p.code.toLowerCase() === selectedPlant.toLowerCase()) || null;
  }, [selectedPlant, plantOptions]);

  const activePlantLabel = useMemo(() => {
    if (selectedPlant === "ALL") return "Consolidated (All Plants)";
    if (activePlantOption) return activePlantOption.displayName;
    return selectedPlant;
  }, [selectedPlant, activePlantOption]);

  const matchesPlant = useCallback(
    (targetPlant?: string | null): boolean => {
      if (!targetPlant || selectedPlant === "ALL") return true;
      const cleanTarget = targetPlant.trim().toLowerCase();
      const cleanSelected = selectedPlant.trim().toLowerCase();
      return cleanTarget === cleanSelected || cleanTarget.includes(cleanSelected);
    },
    [selectedPlant]
  );

  return (
    <PlantContext.Provider
      value={{
        selectedPlant,
        setSelectedPlant,
        plantOptions,
        activePlantOption,
        activePlantLabel,
        matchesPlant,
        isLoading,
        reloadPlants,
      }}
    >
      {children}
    </PlantContext.Provider>
  );
};

export function usePlant(): PlantContextType {
  const ctx = useContext(PlantContext);
  if (!ctx) {
    throw new Error("usePlant must be used within a PlantProvider");
  }
  return ctx;
}
