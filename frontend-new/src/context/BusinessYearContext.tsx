import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getCurrentBusinessYear } from "@/lib/businessYear";
import { fetchBusinessYearsApi } from "@/infrastructure/api/masterApi";

export interface BusinessYearOption {
  year: string;
  label: string;
  is_current: boolean;
  count: number;
}

export interface BusinessYearContextType {
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  currentBusinessYear: string;
  yearsList: BusinessYearOption[];
  totalRecords: number;
  isLoading: boolean;
  isViewingPastYear: boolean;
  isViewingAllYears: boolean;
  refreshYears: () => Promise<void>;
}

const STORAGE_KEY = "samp_business_year";

const BusinessYearContext = createContext<BusinessYearContextType | undefined>(undefined);

export const BusinessYearProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentBusinessYear, setCurrentBusinessYear] = useState(getCurrentBusinessYear);

  const [selectedYear, setSelectedYearState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return saved;
    } catch {
      // Fallback
    }
    return getCurrentBusinessYear();
  });

  const [yearsList, setYearsList] = useState<BusinessYearOption[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const setSelectedYear = useCallback((year: string) => {
    setSelectedYearState(year);
    try {
      localStorage.setItem(STORAGE_KEY, year);
    } catch {}
    window.dispatchEvent(new CustomEvent("samp:year-changed", { detail: { year } }));
  }, []);

  const refreshYears = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchBusinessYearsApi();
      const years = Array.isArray(data.years)
        ? data.years.filter((item) => {
            const match = /^(\d{4})-(\d{4})$/.exec(item.year);
            return Boolean(match && Number(match[2]) === Number(match[1]) + 1);
          })
        : [];
      const currentYear = data.current_business_year || getCurrentBusinessYear();

      setCurrentBusinessYear(currentYear);
      setYearsList(years);
      setTotalRecords(Number.isFinite(data.total_records) ? data.total_records : 0);
      setSelectedYearState((selected) => {
        const availableYears = new Set(years.map((year) => year.year));
        const next = selected === "ALL" || availableYears.has(selected)
          ? selected
          : availableYears.has(currentYear)
            ? currentYear
            : years[0]?.year || "ALL";
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {}
        return next;
      });
    } catch (err) {
      setYearsList([]);
      setTotalRecords(0);
      console.warn("Failed to load business years from database:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshYears();
  }, [refreshYears]);

  const isViewingPastYear = selectedYear !== currentBusinessYear && selectedYear !== "ALL";
  const isViewingAllYears = selectedYear === "ALL";

  return (
    <BusinessYearContext.Provider
      value={{
        selectedYear,
        setSelectedYear,
        currentBusinessYear,
        yearsList,
        totalRecords,
        isLoading,
        isViewingPastYear,
        isViewingAllYears,
        refreshYears,
      }}
    >
      {children}
    </BusinessYearContext.Provider>
  );
};

export function useBusinessYear(): BusinessYearContextType {
  const ctx = useContext(BusinessYearContext);
  if (!ctx) {
    throw new Error("useBusinessYear must be used within a BusinessYearProvider");
  }
  return ctx;
}
