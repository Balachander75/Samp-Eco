import { useEffect, useState } from "react";
import { fetchCustomersApi, fetchPlantsApi } from "@/infrastructure/api";
import { CustomerItem, PlantItem } from "@/types/master";

interface MasterDataState {
  customers: CustomerItem[];
  plants: PlantItem[];
  isLoading: boolean;
  error: string | null;
}

let masterDataCache: { customers: CustomerItem[]; plants: PlantItem[] } | null = null;
let masterDataInFlight: Promise<{ customers: CustomerItem[]; plants: PlantItem[] }> | null = null;

export function clearMasterDataCache(): void {
  masterDataCache = null;
  masterDataInFlight = null;
}

/** Load customer and plant masters from the backend-new database with reactive updates and memory caching. */
export function useMasterData(enabled = true): MasterDataState {
  const [customers, setCustomers] = useState<CustomerItem[]>(() => masterDataCache?.customers || []);
  const [plants, setPlants] = useState<PlantItem[]>(() => masterDataCache?.plants || []);
  const [isLoading, setIsLoading] = useState(!masterDataCache && enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    if (masterDataCache) {
      setCustomers(masterDataCache.customers);
      setPlants(masterDataCache.plants);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    if (!masterDataInFlight) {
      masterDataInFlight = Promise.all([fetchCustomersApi(), fetchPlantsApi()]).then(([customerRows, plantRows]) => {
        const cleanCustomers = customerRows && customerRows.length > 0 ? customerRows : [];
        const cleanPlants = plantRows && plantRows.length > 0 ? plantRows.filter((p) => p.isActive !== false) : [];
        masterDataCache = { customers: cleanCustomers, plants: cleanPlants };
        return masterDataCache;
      });
    }

    masterDataInFlight
      .then((data) => {
        if (cancelled) return;
        setCustomers(data.customers);
        setPlants(data.plants);
      })
      .catch((err) => {
        console.warn("Could not load backend master data:", err);
        if (!cancelled) {
          setError(err?.message || "Failed to load master data");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { customers, plants, isLoading, error };
}

