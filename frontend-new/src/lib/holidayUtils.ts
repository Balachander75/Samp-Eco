/**
 * Navneet SAMP Operations - Holiday & Operational Working Day Engine
 *
 * Rules:
 * 1. All Sundays are weekly plant holidays (OFF).
 * 2. All Even Saturdays of every month (2nd & 4th Saturday) are plant off days (OFF).
 * 3. Odd Saturdays (1st, 3rd, and 5th Saturday if present) are active working days.
 * 4. Mondays through Fridays are active working days.
 */

export interface HolidayCheckResult {
  isHoliday: boolean;
  type?: "sunday" | "even_saturday";
  label?: string;
  badge?: "OFF";
  saturdayOccurrence?: number;
}

/**
 * Checks if a given Date falls on Sunday
 */
export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

/**
 * Calculates which occurrence of Saturday in the month a date is (1st, 2nd, 3rd, 4th, 5th).
 * Returns 0 if the date is not a Saturday.
 */
export function getSaturdayOccurrence(date: Date): number {
  if (date.getDay() !== 6) return 0;
  return Math.ceil(date.getDate() / 7);
}

/**
 * Checks if a given Date is an even Saturday (i.e. 2nd or 4th Saturday of the month).
 */
export function isEvenSaturday(date: Date): boolean {
  if (date.getDay() !== 6) return false;
  const occ = Math.ceil(date.getDate() / 7);
  return occ % 2 === 0; // 2nd or 4th Saturday
}

/**
 * Returns complete holiday status and descriptor for any date.
 */
export function getHolidayInfo(date: Date): HolidayCheckResult {
  if (isSunday(date)) {
    return {
      isHoliday: true,
      type: "sunday",
      label: "Sunday (Weekly Off)",
      badge: "OFF",
    };
  }

  if (date.getDay() === 6) {
    const occ = Math.ceil(date.getDate() / 7);
    if (occ % 2 === 0) {
      const suffix = occ === 2 ? "2nd" : occ === 4 ? "4th" : `${occ}th`;
      return {
        isHoliday: true,
        type: "even_saturday",
        label: `${suffix} Saturday (Weekly Off)`,
        badge: "OFF",
        saturdayOccurrence: occ,
      };
    }
  }

  return {
    isHoliday: false,
  };
}

/**
 * Parse YYYY-MM-DD string into local midnight Date avoiding timezone drift.
 */
export function parseYMD(ymdStr: string | null | undefined): Date | null {
  if (!ymdStr || typeof ymdStr !== "string") return null;
  const parts = ymdStr.trim().split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

/**
 * Formats a Date object to YYYY-MM-DD
 */
export function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Formats a Date object or YYYY-MM-DD string into a clean readable string: e.g. "24 Oct 2026, Sat"
 */
export function formatDisplayDate(dateOrStr: Date | string | null | undefined): string {
  if (!dateOrStr) return "";
  const d = typeof dateOrStr === "string" ? parseYMD(dateOrStr) : dateOrStr;
  if (!d || isNaN(d.getTime())) return typeof dateOrStr === "string" ? dateOrStr : "";

  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    weekday: "short",
  });
}

/**
 * Quick check if a date string or Date is restricted (Sunday or Even Saturday).
 */
export function isDateRestricted(dateOrStr: Date | string | null | undefined): boolean {
  if (!dateOrStr) return false;
  const d = typeof dateOrStr === "string" ? parseYMD(dateOrStr) : dateOrStr;
  if (!d || isNaN(d.getTime())) return false;
  return getHolidayInfo(d).isHoliday;
}

/**
 * Returns the next available valid operational working day starting from a given date.
 * If the given date is already valid, returns it; otherwise advances to Monday or next valid day.
 */
export function getNextWorkingDate(from?: Date | string, minDaysAhead: number = 0): string {
  let d = from ? (typeof from === "string" ? parseYMD(from) || new Date() : new Date(from.getTime())) : new Date();

  // Advance by minDaysAhead if requested
  if (minDaysAhead > 0) {
    d.setDate(d.getDate() + minDaysAhead);
  }

  // If falls on a holiday (Sunday or 2nd/4th Saturday), step forward until valid
  while (isDateRestricted(d)) {
    d.setDate(d.getDate() + 1);
  }

  return formatYMD(d);
}
