import { useEffect, useState } from "react";
import { fetchCustomersApi, fetchPlantsApi } from "@/infrastructure/api";
import { CustomerItem, PlantItem } from "@/types/master";

interface MasterDataState {
  customers: CustomerItem[];
  plants: PlantItem[];
  isLoading: boolean;
  error: string | null;
}

/** Load customer and plant masters from the backend-new database with reactive updates. */
export function useMasterData(enabled = true): MasterDataState {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [plants, setPlants] = useState<PlantItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setIsLoading(true);

    Promise.all([fetchCustomersApi(), fetchPlantsApi()])
      .then(([customerRows, plantRows]) => {
        if (cancelled) return;
        if (customerRows && customerRows.length > 0) {
          setCustomers(customerRows);
        }
        if (plantRows && plantRows.length > 0) {
          setPlants(plantRows.filter((plant) => plant.isActive !== false));
        }
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
