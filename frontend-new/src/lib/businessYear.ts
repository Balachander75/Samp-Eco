/**
 * Navneet SAMP ERP Business Year & Season Year System.
 */

export interface BusinessYearInfo {
  startYear: number;
  endYear: number;
  businessYearStr: string; // e.g. "2026-2027"
  label: string; // e.g. "FY 2026-2027"
  seasonYearOptions: string[]; // e.g. ["2026", "2027", "2028"]
  businessYearOptions: string[]; // e.g. ["2026-2027", "2025-2026", "2027-2028", "2028-2029"]
}

export function getBusinessYearInfo(dateInput?: Date | string | null): BusinessYearInfo {
  const d = dateInput
    ? (typeof dateInput === "string" ? new Date(dateInput) : dateInput)
    : new Date();

  const validDate = isNaN(d.getTime()) ? new Date() : d;
  const month = validDate.getMonth(); // 0-indexed: Jan=0...Sep=8, Oct=9, Nov=10, Dec=11
  const calYear = validDate.getFullYear();

  // If October or later (month >= 9), business year starts this calendar year.
  // Otherwise, it started last calendar year (calYear - 1).
  const startYear = month >= 9 ? calYear : calYear - 1;
  const endYear = startYear + 1;
  const businessYearStr = `${startYear}-${endYear}`;

  // Season year options: current business year start + 2 future years (e.g. 2026, 2027, 2028)
  const seasonYearOptions = [
    String(startYear),
    String(startYear + 1),
    String(startYear + 2),
  ];

  // Business year select options for programs (current, previous, next 2)
  const businessYearOptions = [
    `${startYear}-${endYear}`,
    `${startYear - 1}-${startYear}`,
    `${startYear + 1}-${startYear + 2}`,
    `${startYear + 2}-${startYear + 3}`,
  ];

  return {
    startYear,
    endYear,
    businessYearStr,
    label: `FY ${businessYearStr}`,
    seasonYearOptions,
    businessYearOptions,
  };
}

export function getCurrentBusinessYear(): string {
  return getBusinessYearInfo().businessYearStr;
}

export function getSeasonYearOptions(): string[] {
  return getBusinessYearInfo().seasonYearOptions;
}

export function getBusinessYearForDate(dateStr?: string | null): string {
  if (!dateStr) return getCurrentBusinessYear();
  return getBusinessYearInfo(dateStr).businessYearStr;
}

export function normalizeToBusinessYear(rawYear?: string | null): string {
  if (!rawYear) return "";
  const clean = String(rawYear).trim();
  if (/^\d{4}-\d{4}$/.test(clean)) return clean;
  if (/^\d{4}$/.test(clean)) {
    const endYear = parseInt(clean, 10);
    return `${endYear - 1}-${endYear}`;
  }
  return clean;
}

export interface BusinessYearMonth {
  key: string;
  label: string;
  full: string;
}

// 12-Month Business Year sequence (October to September)
export const BY_MONTHS: readonly BusinessYearMonth[] = [
  { key: "10", label: "Oct", full: "October" },
  { key: "11", label: "Nov", full: "November" },
  { key: "12", label: "Dec", full: "December" },
  { key: "01", label: "Jan", full: "January" },
  { key: "02", label: "Feb", full: "February" },
  { key: "03", label: "Mar", full: "March" },
  { key: "04", label: "Apr", full: "April" },
  { key: "05", label: "May", full: "May" },
  { key: "06", label: "Jun", full: "June" },
  { key: "07", label: "Jul", full: "July" },
  { key: "08", label: "Aug", full: "August" },
  { key: "09", label: "Sep", full: "September" },
];

