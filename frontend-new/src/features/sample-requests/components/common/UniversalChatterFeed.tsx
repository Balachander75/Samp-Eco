import React, { useMemo, useRef, useEffect, useState } from "react";
import { formatOdooLogDate } from "../../utils/dateUtils";
import { UserProfile } from "@/features/auth";
import {
  History,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";

export interface UniversalChatterEvent {
  id: string | number;
  kind: "system_announcement" | "bubble";
  actorName: string;
  actorDepartment?: string;
  actorId?: number | null;
  summary?: string;
  detail?: string;
  subdetail?: string;
  timestamp: string;
  verdictTag?: "Yes" | "No" | "Maybe" | string;
  decisionTag?: "Accepted" | "Rejected" | string;
  badge?: {
    text: string;
    variant?: "success" | "warning" | "danger" | "info" | "neutral";
  };
}

export interface UniversalChatterFeedProps {
  title?: string;
  events: UniversalChatterEvent[];
  currentUser?: UserProfile | null;
  emptyMessage?: string;
  className?: string;
  defaultExpanded?: boolean;
}

function formatRelativeTime(timestamp?: string): string {
  if (!timestamp) return "";
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const timeStr = d.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    if (isToday) return `Today, ${timeStr}`;

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return `Yesterday, ${timeStr}`;

    const dateStr = d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
    return `${dateStr}, ${timeStr}`;
  } catch {
    return "";
  }
}

export const UniversalChatterFeed: React.FC<UniversalChatterFeedProps> = ({
  title = "Activity History",
  events,
  currentUser,
  emptyMessage = "No activity recorded yet.",
  className = "w-80 sm:w-84 lg:w-[360px]",
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [activeFilter, setActiveFilter] = useState<"all" | "actions" | "notes">("all");
  const listEndRef = useRef<HTMLDivElement | null>(null);

  // Chronologically sort events (oldest first for natural reading)
  const sortedEvents = useMemo(() => {
    return [...events]
      .filter((e) => Boolean(e.timestamp || e.summary || e.verdictTag || e.decisionTag))
      .sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime() || 0;
        const timeB = new Date(b.timestamp).getTime() || 0;
        return timeA - timeB;
      });
  }, [events]);

  // Filtered list
  const filteredEvents = useMemo(() => {
    if (activeFilter === "actions") {
      return sortedEvents.filter((e) => e.verdictTag || e.decisionTag || e.badge || e.kind === "system_announcement");
    }
    if (activeFilter === "notes") {
      return sortedEvents.filter((e) => Boolean(e.summary && e.kind !== "system_announcement"));
    }
    return sortedEvents;
  }, [sortedEvents, activeFilter]);

  const counts = useMemo(() => {
    const actions = sortedEvents.filter((e) => e.verdictTag || e.decisionTag || e.badge || e.kind === "system_announcement").length;
    const notes = sortedEvents.filter((e) => Boolean(e.summary && e.kind !== "system_announcement")).length;
    return { all: sortedEvents.length, actions, notes };
  }, [sortedEvents]);

  useEffect(() => {
    if (isExpanded) {
      listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [filteredEvents.length, isExpanded]);

  // ── COLLAPSED SLEEK RAIL (DEFAULT) ──
  if (!isExpanded) {
    return (
      <aside
        onClick={() => setIsExpanded(true)}
        className="shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--border-subtle)] bg-[var(--surface-lowest)] hover:bg-[var(--surface-low)] transition-all duration-200 cursor-pointer group flex lg:flex-col items-center justify-between p-2.5 lg:py-4 select-none w-full lg:w-11 h-11 lg:h-full z-10"
        title="Expand Activity Log"
        aria-label="Expand Activity Log"
      >
        {/* Mobile Strip */}
        <div className="flex lg:hidden items-center justify-between w-full px-1">
          <div className="flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] group-hover:text-[var(--accent-primary)] transition-colors" />
            <span className="text-xs font-semibold text-[var(--on-surface)]">
              {title}
            </span>
            <span className="rounded-full bg-[var(--surface-base)] px-2 py-0.5 font-mono text-[10px] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]">
              {sortedEvents.length}
            </span>
          </div>
          <span className="text-[11px] font-medium text-[var(--accent-primary)] flex items-center gap-0.5">
            Expand <ChevronUp className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* Desktop Vertical Strip */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(true);
          }}
          className="hidden lg:flex p-1 rounded-md text-[var(--on-surface-subtle)] group-hover:text-[var(--accent-primary)] transition-colors"
          title="Expand"
        >
          <PanelRightOpen className="w-4 h-4" />
        </button>

        <div className="hidden lg:flex flex-col items-center gap-3 my-auto py-2">
          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-base)] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[var(--on-surface-muted)] group-hover:text-[var(--accent-primary)] transition-colors">
            {sortedEvents.length}
          </span>
          <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-medium tracking-wide text-[var(--on-surface-subtle)] group-hover:text-[var(--on-surface)] transition-colors uppercase whitespace-nowrap">
            {title}
          </span>
        </div>

        <div className="hidden lg:flex text-[var(--on-surface-subtle)] group-hover:text-[var(--accent-primary)] transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
        </div>
      </aside>
    );
  }

  // ── EXPANDED CLEAN ENTERPRISE TIMELINE ──
  return (
    <aside
      className={`${className} shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--border-subtle)] bg-[var(--surface-lowest)] flex flex-col h-[42vh] lg:h-full min-h-0 text-xs select-text transition-all duration-200`}
    >
      {/* ── Header ── */}
      <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-xs text-[var(--on-surface)]">
              {title}
            </h3>
            <span className="rounded-full bg-[var(--surface-low)] border border-[var(--border-subtle)] px-2 py-0.5 font-mono text-[10px] text-[var(--on-surface-muted)]">
              {sortedEvents.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)] transition-colors cursor-pointer"
            title="Collapse"
          >
            <span>Hide</span>
            <PanelRightClose className="w-3.5 h-3.5 hidden lg:block" />
            <ChevronDown className="w-3.5 h-3.5 lg:hidden" />
          </button>
        </div>

        {/* ── Subtitle filter tabs (only when there are multiple entries) ── */}
        {sortedEvents.length > 2 && (
          <div className="flex items-center gap-1.5 pt-2.5">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`px-2.5 py-0.5 rounded-md text-[10.5px] font-medium transition-all cursor-pointer ${
                activeFilter === "all"
                  ? "bg-[var(--surface-base)] text-[var(--on-surface)] shadow-2xs border border-[var(--border-subtle)] font-semibold"
                  : "text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)]"
              }`}
            >
              All ({counts.all})
            </button>
            {counts.actions > 0 && (
              <button
                type="button"
                onClick={() => setActiveFilter("actions")}
                className={`px-2.5 py-0.5 rounded-md text-[10.5px] font-medium transition-all cursor-pointer ${
                  activeFilter === "actions"
                    ? "bg-[var(--surface-base)] text-[var(--on-surface)] shadow-2xs border border-[var(--border-subtle)] font-semibold"
                    : "text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)]"
                }`}
              >
                Decisions ({counts.actions})
              </button>
            )}
            {counts.notes > 0 && (
              <button
                type="button"
                onClick={() => setActiveFilter("notes")}
                className={`px-2.5 py-0.5 rounded-md text-[10.5px] font-medium transition-all cursor-pointer ${
                  activeFilter === "notes"
                    ? "bg-[var(--surface-base)] text-[var(--on-surface)] shadow-2xs border border-[var(--border-subtle)] font-semibold"
                    : "text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)]"
                }`}
              >
                Notes ({counts.notes})
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Timeline Track ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        {filteredEvents.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--on-surface-subtle)]">
            {emptyMessage}
          </div>
        ) : (
          <div className="relative pl-4 space-y-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-[1.5px] before:bg-[var(--border-subtle)]">
            {filteredEvents.map((evt) => {
              const timeDisplay = formatRelativeTime(evt.timestamp) || formatOdooLogDate(evt.timestamp);
              const isAuto = evt.kind === "system_announcement";

              return (
                <div key={evt.id} className="relative group">
                  {/* Subtle Node Pin on timeline line */}
                  <div
                    className={`absolute -left-[19px] top-1 w-2 h-2 rounded-full border border-[var(--surface-lowest)] transition-transform group-hover:scale-125 ${
                      evt.verdictTag === "Yes" || evt.decisionTag === "Accepted"
                        ? "bg-emerald-500"
                        : evt.verdictTag === "No" || evt.decisionTag === "Rejected"
                        ? "bg-rose-500"
                        : evt.verdictTag === "Maybe"
                        ? "bg-amber-500"
                        : isAuto
                        ? "bg-[var(--on-surface-subtle)]"
                        : "bg-[var(--accent-primary)]"
                    }`}
                  />

                  {/* Clean Content Item */}
                  <div className="space-y-1">
                    {/* Meta line: Actor • Dept • Timestamp */}
                    <div className="flex items-center justify-between gap-2 text-[11px] leading-tight">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-[var(--on-surface)] truncate">
                          {evt.actorName || "System"}
                          {currentUser && (evt.actorName === currentUser.name || evt.actorName?.includes(currentUser.name || "")) && (
                            <span className="text-[10px] font-normal text-[var(--accent-primary)] ml-1">
                              (You)
                            </span>
                          )}
                        </span>
                        {evt.actorDepartment && (
                          <>
                            <span className="text-[var(--on-surface-subtle)] opacity-50">•</span>
                            <span className="text-[10px] text-[var(--on-surface-muted)] uppercase tracking-wider font-medium truncate">
                              {evt.actorDepartment}
                            </span>
                          </>
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--on-surface-subtle)] shrink-0 font-mono">
                        {timeDisplay}
                      </span>
                    </div>

                    {/* Verdict / Decision Pill (clean, minimal) */}
                    {(evt.verdictTag || evt.decisionTag || evt.badge) && (
                      <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                        {evt.verdictTag && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold leading-none ${
                              evt.verdictTag === "Yes"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                                : evt.verdictTag === "No"
                                ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                            }`}
                          >
                            {evt.verdictTag === "Yes"
                              ? "Feasible"
                              : evt.verdictTag === "No"
                              ? "Not Feasible"
                              : "Conditional"}
                          </span>
                        )}

                        {evt.decisionTag && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold leading-none ${
                              evt.decisionTag === "Accepted"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
                            }`}
                          >
                            {evt.decisionTag === "Accepted" ? "Approved" : "Rejected"}
                          </span>
                        )}

                        {evt.badge && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--surface-low)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]">
                            {evt.badge.text}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Clean Note / Remark Body */}
                    {evt.summary && (
                      <p
                        className={`text-[11.5px] leading-relaxed pt-0.5 ${
                          isAuto
                            ? "text-[var(--on-surface-subtle)] italic"
                            : "text-[var(--on-surface)]"
                        }`}
                      >
                        {evt.summary}
                      </p>
                    )}

                    {/* Condition details callout (clean inline border) */}
                    {evt.detail && (
                      <div className="pl-2 border-l-2 border-amber-400 dark:border-amber-600 text-[10.5px] text-[var(--on-surface-muted)] py-0.5">
                        <span className="font-medium text-[var(--on-surface)]">Conditions: </span>
                        {evt.detail}
                      </div>
                    )}

                    {/* Lead Time indicator */}
                    {evt.subdetail && (
                      <div className="text-[10px] text-[var(--on-surface-subtle)]">
                        Lead time: <span className="font-semibold text-[var(--on-surface)]">{evt.subdetail}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={listEndRef} />
          </div>
        )}
      </div>
    </aside>
  );
};

export default UniversalChatterFeed;
