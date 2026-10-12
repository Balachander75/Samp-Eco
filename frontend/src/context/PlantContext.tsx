import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { fetchPlantsApi } from "@/infrastructure/api/masterApi";
import { PlantItem } from "@/features/sample-requests/types";

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
  reloadPlants: () => Promise<void>;
}

const STORAGE_KEY = "samp_active_plant";

const PlantContext = createContext<PlantContextType | undefined>(undefined);

export const PlantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedPlant, setSelectedPlantState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "ALL";
    } catch {
      return "ALL";
    }
  });

  const [plantOptions, setPlantOptions] = useState<PlantOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load plants dynamically from backend API (/api/v1/plants)
  const reloadPlants = useCallback(async () => {
    try {
      setIsLoading(true);
      const items: PlantItem[] = await fetchPlantsApi();
      if (Array.isArray(items)) {
        const active = items.filter((p) => p.isActive !== false);
        const mapped: PlantOption[] = active.map((p) => {
          const code = p.code || p.name.split("-")[0].trim();
          const cleanName = p.name.includes("-") ? p.name.split("-")[1].trim() : p.name;
          return {
            code,
            name: p.name,
            displayName: `${code} — ${cleanName}`,
            location: p.location || "Manufacturing Unit",
          };
        });
        setPlantOptions(mapped);
      } else {
        setPlantOptions([]);
      }
    } catch (err) {
      console.error("Failed to load plants from database:", err);
      setPlantOptions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadPlants();
  }, [reloadPlants]);

  const setSelectedPlant = useCallback((plantCode: string) => {
    setSelectedPlantState(plantCode);
    try {
      localStorage.setItem(STORAGE_KEY, plantCode);
    } catch {
      // Ignore storage errors
    }
    window.dispatchEvent(new CustomEvent("app:plant-changed", { detail: { plant: plantCode } }));
  }, []);

  useEffect(() => {
    if (isLoading || selectedPlant === "ALL") return;
    const selectionIsVisible = plantOptions.some(
      (plant) => plant.code === selectedPlant || plant.name === selectedPlant
    );
    if (!selectionIsVisible) setSelectedPlant("ALL");
  }, [isLoading, plantOptions, selectedPlant, setSelectedPlant]);

  const activePlantOption = useMemo(() => {
    if (selectedPlant === "ALL") return null;
    return plantOptions.find((p) => p.code === selectedPlant || p.name === selectedPlant) || null;
  }, [selectedPlant, plantOptions]);

  const activePlantLabel = useMemo(() => {
    if (selectedPlant === "ALL") return "All Plants";
    if (activePlantOption) return activePlantOption.displayName;
    return selectedPlant;
  }, [selectedPlant, activePlantOption]);

  const matchesPlant = useCallback(
    (targetPlant?: string | null): boolean => {
      if (selectedPlant === "ALL") return true;
      if (!targetPlant) return false;
      const target = String(targetPlant).toLowerCase().trim();
      const code = selectedPlant.toLowerCase().trim();
      if (target.includes(code)) return true;
      if (activePlantOption) {
        const namePart = activePlantOption.name.toLowerCase();
        if (target.includes(namePart)) return true;
        const dispPart = activePlantOption.displayName.toLowerCase();
        if (target.includes(dispPart)) return true;
      }
      return false;
    },
    [selectedPlant, activePlantOption]
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

export const usePlant = (): PlantContextType => {
  const context = useContext(PlantContext);
  if (!context) {
    throw new Error("usePlant must be used within a PlantProvider");
  }
  return context;
};
