/**
 * Odoo Enterprise Standard Date & Time Formatter
 * Provides consistent, polished, human-readable date & time formatting across all desks, chatter logs, and audit trails.
 */

export function formatOdooLogDate(dateInput?: string | Date | null): string {
  if (!dateInput) return "Recent";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) {
      return String(dateInput);
    }

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    // Check if input was a date-only string like "YYYY-MM-DD"
    const isDateOnly = typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim());

    if (isDateOnly) {
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }

    const timeStr = d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    if (isToday) {
      return `Today at ${timeStr}`;
    }
    if (isYesterday) {
      return `Yesterday at ${timeStr}`;
    }

    const dateStr = d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    return `${dateStr}, ${timeStr}`;
  } catch {
    return String(dateInput || "Recent");
  }
}

export function formatOdooDate(dateInput?: string | Date | null): string {
  if (!dateInput) return "—";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(dateInput || "—");
  }
}

export function isMaterialAddedRecently(createdAt?: string | Date | null): boolean {
  if (!createdAt) return false;
  const date = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  if (Number.isNaN(date.getTime())) return false;
  const ageMs = Date.now() - date.getTime();
  return ageMs >= -60_000 && ageMs <= 36 * 60 * 60 * 1000;
}
