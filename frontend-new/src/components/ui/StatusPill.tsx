import React from "react";

export type SemanticTone = "success" | "warning" | "danger" | "info" | "neutral" | "purple" | "amber";

export interface StatusPillProps {
  status?: string | null;
  tone?: SemanticTone;
  size?: "xs" | "sm" | "md";
  className?: string;
  showDot?: boolean;
  pulseDot?: boolean;
  icon?: React.ReactNode;
  label?: React.ReactNode;
  children?: React.ReactNode;
}

export function resolveStatusTone(status?: string | null): {
  tone: SemanticTone;
  label: string;
} {
  const s = String(status || "").toLowerCase().trim();

  // Drafts
  if (s === "draft" || s.startsWith("draft")) {
    return { tone: "amber", label: status || "Draft" };
  }

  // Needs Decision / Marketing Action
  if (
    s.includes("decision") ||
    s.includes("action") ||
    s.includes("verdict") ||
    s.includes("needs client")
  ) {
    return { tone: "purple", label: status || "Needs Decision" };
  }

  // Success / Closed / Approved / On-Time
  if (
    s.includes("deal") ||
    s.includes("actual") ||
    s.includes("approved") ||
    s.includes("dispatched") ||
    s.includes("qc passed") ||
    s.includes("on-time") ||
    s.includes("on time") ||
    s === "yes"
  ) {
    return { tone: "success", label: status || "Dispatched / Closed" };
  }

  // Critical / Rejected / Blocked / Delayed
  if (
    s.includes("rejected") ||
    s.includes("blocked") ||
    s.includes("overdue") ||
    s.includes("delayed") ||
    s.includes("late") ||
    s.includes("cancelled") ||
    s === "no"
  ) {
    return { tone: "danger", label: status || "Rejected" };
  }

  // Warning / Feasibility Check / Pending Review
  if (
    s.includes("feasibility") ||
    s.includes("review") ||
    s.includes("pending") ||
    s.includes("due soon") ||
    s === "maybe"
  ) {
    return { tone: "warning", label: status || "Pending Review" };
  }

  // Info / In-Flight Operational Work (SAMP, In Plant, Creative, Studio)
  if (
    s.includes("plant") ||
    s.includes("execution") ||
    s.includes("samp") ||
    s.includes("studio") ||
    s.includes("creative") ||
    s.includes("released") ||
    s.includes("in production")
  ) {
    return { tone: "info", label: status || "In Progress" };
  }

  // Neutral fallback
  return { tone: "neutral", label: status || "Draft (Pre-SMT)" };
}

const TONE_CLASSES: Record<
  SemanticTone,
  { container: string; dot: string }
> = {
  success: {
    container: "bg-status-success-soft text-status-success border-status-success-border",
    dot: "bg-status-success-strong",
  },
  warning: {
    container: "bg-status-warning-soft text-status-warning border-status-warning-border",
    dot: "bg-status-warning-strong",
  },
  amber: {
    container: "bg-status-warning-soft text-status-warning border-status-warning-border",
    dot: "bg-status-warning-strong",
  },
  danger: {
    container: "bg-status-danger-soft text-status-danger border-status-danger-border",
    dot: "bg-status-danger-strong",
  },
  purple: {
    container: "bg-status-purple-soft text-status-purple border-status-purple-border",
    dot: "bg-status-purple-strong",
  },
  info: {
    container: "bg-status-info-soft text-status-info border-status-info-border",
    dot: "bg-status-info-strong",
  },
  neutral: {
    container: "bg-status-neutral-soft text-status-neutral border-status-neutral-border",
    dot: "bg-status-neutral-strong",
  },
};

const SIZE_CLASSES = {
  xs: "px-1.5 py-0.5 text-[10px] gap-1",
  sm: "px-2 py-0.5 text-[11px] gap-1.5 font-medium",
  md: "px-2.5 py-1 text-xs gap-1.5 font-medium",
};

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  tone: overrideTone,
  size = "sm",
  className = "",
  showDot = true,
  pulseDot = false,
  icon,
  label,
  children,
}) => {
  const resolved = resolveStatusTone(status);
  const finalTone = overrideTone || resolved.tone;
  const toneStyle = TONE_CLASSES[finalTone] || TONE_CLASSES.neutral;
  const displayText = children || label || resolved.label;

  return (
    <span
      data-status-tone={finalTone}
      title={typeof displayText === "string" ? displayText : undefined}
      className={`status-pill inline-flex items-center max-w-full min-w-0 rounded-full border font-mono select-none ${toneStyle.container} ${SIZE_CLASSES[size]} ${className}`}
    >
      {icon ? (
        <span className="shrink-0">{icon}</span>
      ) : showDot ? (
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${toneStyle.dot} ${
            pulseDot ? "animate-pulse" : ""
          }`}
          aria-hidden="true"
        />
      ) : null}
      <span className="truncate min-w-0 max-w-[120px]">{displayText}</span>
    </span>
  );
};

export default StatusPill;
