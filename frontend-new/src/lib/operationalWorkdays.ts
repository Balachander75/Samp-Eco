/**
 * Operational workday and India timezone utilities for SLA calculations.
 * Encapsulates the Navneet manufacturing workday calendar (Mon-Fri, alternate Saturdays).
 */

export const indiaDateKey = (value?: string | Date | null): string | null => {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export const dayNumber = (dateKey: string): number => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
};

export const dayKey = (ordinal: number): string => new Date(ordinal * 86_400_000).toISOString().slice(0, 10);

export const isOperationalWorkday = (ordinal: number): boolean => {
  const date = new Date(ordinal * 86_400_000);
  const weekday = date.getUTCDay();
  if (weekday >= 1 && weekday <= 5) return true;
  if (weekday !== 6) return false;
  return Math.ceil(date.getUTCDate() / 7) % 2 === 1;
};

export const addOperationalWorkdays = (date: string, workdays: number): string => {
  let ordinal = dayNumber(date);
  while (workdays > 0) {
    ordinal += 1;
    if (isOperationalWorkday(ordinal)) workdays -= 1;
  }
  return dayKey(ordinal);
};

export const operationalWorkdaysBetween = (start: string, end: string): number => {
  let count = 0;
  for (let ordinal = dayNumber(start) + 1; ordinal <= dayNumber(end); ordinal += 1) {
    if (isOperationalWorkday(ordinal)) count += 1;
  }
  return count;
};
