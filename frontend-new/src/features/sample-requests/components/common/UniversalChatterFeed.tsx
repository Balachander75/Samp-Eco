import React, { useMemo, useRef, useEffect } from "react";
import { formatOdooLogDate } from "../../utils/dateUtils";
import { UserProfile } from "@/features/auth";
import { History } from "lucide-react";

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
}

function getInitials(name?: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const ChatAvatar: React.FC<{
  name: string;
  department?: string;
  isCurrentUser?: boolean;
}> = ({ name, department, isCurrentUser }) => {
  const initials = getInitials(name);
  const dept = (department || "").toLowerCase();

  let bgClass = "bg-sky-600 text-white ring-1 ring-sky-500/30";
  if (isCurrentUser) {
    bgClass = "bg-emerald-600 text-white ring-1 ring-emerald-500/30";
  } else if (dept.includes("samp")) {
    bgClass = "bg-teal-600 text-white ring-1 ring-teal-500/30";
  } else if (dept.includes("studio") || dept.includes("creative") || dept.includes("design")) {
    bgClass = "bg-violet-600 text-white ring-1 ring-violet-500/30";
  } else if (dept.includes("costing")) {
    bgClass = "bg-amber-600 text-white ring-1 ring-amber-500/30";
  } else if (dept.includes("plant")) {
    bgClass = "bg-indigo-600 text-white ring-1 ring-indigo-500/30";
  }

  return (
    <div
      className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center font-bold text-[10px] font-display shadow-2xs select-none mt-0.5 ${bgClass}`}
      title={`${name}${department ? ` (${department})` : ""}`}
    >
      {initials}
    </div>
  );
};

function getEventDateKey(timestamp?: string): string {
  if (!timestamp) return "Recent";
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return "Recent";
    const now = new Date();
    if (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    ) {
      return "Today";
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear()
    ) {
      return "Yesterday";
    }
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Recent";
  }
}

function formatBubbleTime(timestamp?: string): string {
  if (!timestamp) return "";
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

export const UniversalChatterFeed: React.FC<UniversalChatterFeedProps> = ({
  title = "Audit & Activity Log",
  events,
  currentUser,
  emptyMessage = "No activity events recorded yet.",
  className = "w-80 sm:w-84 lg:w-[360px]",
}) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Chronologically sort events (oldest first)
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;
      return timeA - timeB;
    });
  }, [events]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sortedEvents.length]);

  // Determine if an event was created by the current user or current user's team
  const isMyLog = (evt: UniversalChatterEvent): boolean => {
    if (!currentUser) return false;
    // 1. Direct ID match
    if (evt.actorId != null && currentUser.id != null && Number(evt.actorId) === Number(currentUser.id)) {
      return true;
    }
    // 2. Direct Name match
    const myName = (currentUser.name || "").trim().toLowerCase();
    const actName = (evt.actorName || "").trim().toLowerCase();
    if (myName && actName && (actName === myName || actName.includes(myName) || myName.includes(actName))) {
      return true;
    }
    // 3. Userid match
    const myUserId = (currentUser.userid || "").trim().toLowerCase();
    if (myUserId && actName && actName === myUserId) {
      return true;
    }
    // 4. Team / Department alignment
    const myTeam = (currentUser.team || "").trim().toLowerCase();
    const evtDept = (evt.actorDepartment || "").trim().toLowerCase();
    if (myTeam && evtDept) {
      if ((myTeam === "marketing" || myTeam.includes("marketing")) && evtDept.includes("marketing")) {
        return true;
      }
      if ((myTeam === "samp" || myTeam.includes("sampling")) && (evtDept.includes("samp") || evtDept.includes("sampling"))) {
        return true;
      }
      if ((myTeam === "studio" || myTeam.includes("creative") || myTeam.includes("design")) &&
          (evtDept.includes("studio") || evtDept.includes("creative") || evtDept.includes("design"))) {
        return true;
      }
      if (myTeam === "costing" && evtDept.includes("costing")) {
        return true;
      }
    }
    return false;
  };

  return (
    <aside className={`${className} shrink-0 border-l border-[var(--border-subtle)] bg-[var(--surface-lowest)] flex flex-col h-full min-h-0 text-xs select-text`}>
      {/* ── Top Header: Sleek single-line Audit Bar ── */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-base)] px-4 py-3 shrink-0 shadow-2xs">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[var(--accent-primary)]" />
          <h3 className="font-display font-bold text-xs text-[var(--on-surface)] leading-none">
            {title}
          </h3>
        </div>
        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[var(--accent-primary)] shadow-2xs">
          {sortedEvents.length} {sortedEvents.length === 1 ? "event" : "events"}
        </span>
      </div>

      {/* ── Scrollable Audit & Activity Window ── */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 min-h-0 bg-[var(--surface-lowest)] font-sans">
        {sortedEvents.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--on-surface-subtle)] border border-dashed border-[var(--border-subtle)] rounded-xl my-4 bg-[var(--surface-base)]">
            {emptyMessage}
          </div>
        ) : (
          sortedEvents.map((evt, idx) => {
            const isAutoUpdate = evt.kind === "system_announcement";
            const isMine = isMyLog(evt);
            const dateKey = getEventDateKey(evt.timestamp);
            const prevDateKey = idx > 0 ? getEventDateKey(sortedEvents[idx - 1].timestamp) : null;
            const showDateHeader = idx === 0 || dateKey !== prevDateKey;
            const timeDisplay = formatBubbleTime(evt.timestamp) || formatOdooLogDate(evt.timestamp);

            return (
              <React.Fragment key={evt.id}>
                {/* Centered Date Separator */}
                {showDateHeader && (
                  <div className="flex justify-center my-2 select-none">
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-[var(--surface-base)] dark:bg-[var(--surface-low)] text-[var(--on-surface-subtle)] shadow-2xs border border-[var(--border-subtle)] uppercase tracking-wider">
                      {dateKey}
                    </span>
                  </div>
                )}

                {/* ── Auto Update / System Event Pill (Centered group-event popup style) ── */}
                {isAutoUpdate ? (
                  <div className="flex justify-center my-1 w-full select-none px-2 animate-in fade-in duration-100">
                    <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] leading-snug font-sans text-[var(--on-surface-muted)] bg-[var(--surface-base)] dark:bg-[var(--surface-low)] border border-[var(--border-subtle)] shadow-2xs max-w-[95%] text-center">
                      <span>{evt.summary}</span>
                      {timeDisplay && (
                        <span className="text-[9px] font-mono text-[var(--on-surface-subtle)] opacity-75 shrink-0 ml-0.5">
                          · {timeDisplay}
                        </span>
                      )}
                    </div>
                  </div>
                ) : isMine ? (
                  /* ── OUTGOING BUBBLE (MERA LOG: RIGHT ALIGNED WITH PROFILE AVATAR) ── */
                  <div className="flex items-start justify-end gap-2 w-full my-1.5 animate-in fade-in duration-100">
                    <div className="w-fit max-w-[82%] min-w-[140px] rounded-2xl rounded-tr-xs px-3 py-2 shadow-2xs bg-[var(--accent-primary)]/10 dark:bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/25 dark:border-[var(--accent-primary)]/35 text-xs text-[var(--on-surface)] space-y-1">
                      {/* Sender Username & Dept */}
                      <div className="flex items-center justify-between gap-2 border-b border-[var(--accent-primary)]/15 dark:border-[var(--accent-primary)]/25 pb-1">
                        <span className="font-display font-bold text-[11px] text-[var(--accent-primary)] truncate">
                          {currentUser?.name ? `${currentUser.name} (You)` : "You"}
                        </span>
                        {evt.actorDepartment && (
                          <span className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-bold uppercase tracking-wider bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] shrink-0">
                            {evt.actorDepartment}
                          </span>
                        )}
                      </div>

                      {/* Verdict / Decision Tag */}
                      {evt.verdictTag && (
                        <div className="pt-0.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-display font-bold leading-none ${
                              evt.verdictTag === "Yes"
                                ? "bg-emerald-600 dark:bg-emerald-700 text-white"
                                : evt.verdictTag === "No"
                                ? "bg-rose-600 dark:bg-rose-700 text-white"
                                : "bg-amber-600 dark:bg-amber-700 text-white"
                            }`}
                          >
                            {evt.verdictTag === "Yes" ? "Feasible" : evt.verdictTag === "No" ? "Not Feasible" : "Conditional"}
                          </span>
                        </div>
                      )}

                      {evt.decisionTag && (
                        <div className="pt-0.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-display font-bold leading-none ${
                              evt.decisionTag === "Accepted"
                                ? "bg-emerald-600 dark:bg-emerald-700 text-white"
                                : "bg-rose-600 dark:bg-rose-700 text-white"
                            }`}
                          >
                            {evt.decisionTag === "Accepted" ? "Approved" : "Dropped"}
                          </span>
                        </div>
                      )}

                      {/* Generic Custom Badge (if provided) */}
                      {evt.badge && (
                        <div className="pt-0.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-display font-bold leading-none ${
                              evt.badge.variant === "success"
                                ? "bg-emerald-600 dark:bg-emerald-700 text-white"
                                : evt.badge.variant === "danger"
                                ? "bg-rose-600 dark:bg-rose-700 text-white"
                                : evt.badge.variant === "warning"
                                ? "bg-amber-600 dark:bg-amber-700 text-white"
                                : "bg-sky-600 dark:bg-sky-700 text-white"
                            }`}
                          >
                            {evt.badge.text}
                          </span>
                        </div>
                      )}

                      {/* Content Body (Rendered only if remark entered) */}
                      {evt.summary && (
                        <p className="text-xs leading-relaxed whitespace-pre-wrap font-sans text-[var(--on-surface)] pt-0.5">
                          {evt.summary}
                        </p>
                      )}

                      {/* Technical Conditions Callout (if any) */}
                      {evt.detail && (
                        <div className="p-1.5 rounded bg-[var(--surface-base)]/80 border-l-2 border-amber-500 text-[10.5px] space-y-0.5 shadow-2xs">
                          <div className="font-bold text-amber-700 dark:text-amber-400">Technical Conditions:</div>
                          <div className="text-[var(--on-surface-muted)]">{evt.detail}</div>
                        </div>
                      )}

                      {/* Lead Time Note (if any) */}
                      {evt.subdetail && (
                        <div className="text-[10px] font-mono text-[var(--on-surface-muted)]">
                          <span>Lead Time: <strong className="text-[var(--on-surface)]">{evt.subdetail}</strong></span>
                        </div>
                      )}

                      {/* Micro Timestamp */}
                      <div className="flex items-center justify-end text-[9px] font-mono text-[var(--on-surface-subtle)] opacity-80 pt-0.5">
                        <span>{timeDisplay}</span>
                      </div>
                    </div>

                    {/* Profile Avatar Circle */}
                    <ChatAvatar
                      name={currentUser?.name || evt.actorName || "You"}
                      department={evt.actorDepartment}
                      isCurrentUser={true}
                    />
                  </div>
                ) : (
                  /* ── INCOMING BUBBLE (DUSRE TEAM KA LOG: LEFT ALIGNED WITH PROFILE AVATAR) ── */
                  <div className="flex items-start justify-start gap-2 w-full my-1.5 animate-in fade-in duration-100">
                    {/* Profile Avatar Circle */}
                    <ChatAvatar
                      name={evt.actorName}
                      department={evt.actorDepartment}
                      isCurrentUser={false}
                    />

                    <div className="w-fit max-w-[82%] min-w-[140px] rounded-2xl rounded-tl-xs px-3 py-2 shadow-2xs bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs text-[var(--on-surface)] space-y-1">
                      {/* Sender Username & Dept */}
                      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-1">
                        <span
                          className={`font-display font-bold text-[11px] truncate ${
                            (evt.actorDepartment || "").toLowerCase().includes("samp")
                              ? "text-teal-700 dark:text-teal-400"
                              : (evt.actorDepartment || "").toLowerCase().includes("studio") || (evt.actorDepartment || "").toLowerCase().includes("creative")
                              ? "text-violet-700 dark:text-violet-400"
                              : (evt.actorDepartment || "").toLowerCase().includes("costing")
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-sky-700 dark:text-sky-400"
                          }`}
                        >
                          {evt.actorName}
                        </span>
                        {evt.actorDepartment && (
                          <span className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-bold uppercase tracking-wider bg-[var(--surface-low)] text-[var(--on-surface-muted)] shrink-0">
                            {evt.actorDepartment}
                          </span>
                        )}
                      </div>

                      {/* Verdict / Decision Tag */}
                      {evt.verdictTag && (
                        <div className="pt-0.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-display font-bold leading-none ${
                              evt.verdictTag === "Yes"
                                ? "bg-emerald-600 dark:bg-emerald-700 text-white"
                                : evt.verdictTag === "No"
                                ? "bg-rose-600 dark:bg-rose-700 text-white"
                                : "bg-amber-600 dark:bg-amber-700 text-white"
                            }`}
                          >
                            {evt.verdictTag === "Yes" ? "Feasible" : evt.verdictTag === "No" ? "Not Feasible" : "Conditional"}
                          </span>
                        </div>
                      )}

                      {evt.decisionTag && (
                        <div className="pt-0.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-display font-bold leading-none ${
                              evt.decisionTag === "Accepted"
                                ? "bg-emerald-600 dark:bg-emerald-700 text-white"
                                : "bg-rose-600 dark:bg-rose-700 text-white"
                            }`}
                          >
                            {evt.decisionTag === "Accepted" ? "Approved" : "Dropped"}
                          </span>
                        </div>
                      )}

                      {/* Generic Custom Badge (if provided) */}
                      {evt.badge && (
                        <div className="pt-0.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-display font-bold leading-none ${
                              evt.badge.variant === "success"
                                ? "bg-emerald-600 dark:bg-emerald-700 text-white"
                                : evt.badge.variant === "danger"
                                ? "bg-rose-600 dark:bg-rose-700 text-white"
                                : evt.badge.variant === "warning"
                                ? "bg-amber-600 dark:bg-amber-700 text-white"
                                : "bg-sky-600 dark:bg-sky-700 text-white"
                            }`}
                          >
                            {evt.badge.text}
                          </span>
                        </div>
                      )}

                      {/* Content Body (Rendered only if remark entered) */}
                      {evt.summary && (
                        <p className="text-xs leading-relaxed whitespace-pre-wrap font-sans text-[var(--on-surface)] pt-0.5">
                          {evt.summary}
                        </p>
                      )}

                      {/* Technical Conditions Callout (if any) */}
                      {evt.detail && (
                        <div className="p-1.5 rounded bg-[var(--surface-low)] border-l-2 border-amber-500 text-[10.5px] space-y-0.5">
                          <div className="font-bold text-amber-700 dark:text-amber-400">Technical Conditions:</div>
                          <div className="text-[var(--on-surface-muted)]">{evt.detail}</div>
                        </div>
                      )}

                      {/* Lead Time Note (if any) */}
                      {evt.subdetail && (
                        <div className="text-[10px] font-mono text-[var(--on-surface-muted)]">
                          <span>Lead Time: <strong className="text-[var(--on-surface)]">{evt.subdetail}</strong></span>
                        </div>
                      )}

                      {/* Micro Timestamp */}
                      <div className="flex items-center justify-end text-[9px] font-mono text-[var(--on-surface-subtle)] opacity-75 pt-0.5">
                        <span>{timeDisplay}</span>
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </aside>
  );
};

export default UniversalChatterFeed;
