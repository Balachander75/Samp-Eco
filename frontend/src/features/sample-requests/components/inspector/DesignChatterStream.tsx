import React from "react";
import { Clock, Send } from "lucide-react";

export interface ChatterMessage {
  id: string;
  actorName: string;
  actorDepartment: string;
  action: string;
  title: string;
  body: string;
  timestamp: string;
  badge?: {
    text: string;
    variant: "purple" | "teal" | "amber" | "emerald" | "rose" | "neutral";
  };
  isNote?: boolean;
}

function getInitials(name?: any): string {
  if (!name) return "US";
  const clean = String(name).trim();
  if (!clean) return "US";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0][0] || "") + (parts[1][0] || "")).toUpperCase() || "US";
  }
  return clean.slice(0, 2).toUpperCase() || "US";
}

function formatTimeOnly(dateInput?: string | Date | null): string {
  if (!dateInput) return "";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

function formatOdooLogDate(val?: any): string {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return val;
  }
}

export interface DesignChatterStreamProps {
  filteredChatter: ChatterMessage[];
  totalEventsCount: number;
  noteInput: string;
  onChangeNoteInput: (val: string) => void;
  isPostingNote: boolean;
  onPostNote: (e: React.FormEvent) => void;
  chatterFilter: "all" | "audit" | "notes";
  onChangeChatterFilter: (filter: "all" | "audit" | "notes") => void;
  chatterEndRef: React.Ref<HTMLDivElement>;
}

export const DesignChatterStream: React.FC<DesignChatterStreamProps> = React.memo(({
  filteredChatter,
  totalEventsCount,
  noteInput,
  onChangeNoteInput,
  isPostingNote,
  onPostNote,
  chatterFilter,
  onChangeChatterFilter,
  chatterEndRef,
}) => {
  return (
    <div
      className="relative z-10 flex h-[34dvh] max-h-[300px] w-full shrink-0 flex-col overflow-hidden border-t select-text lg:h-full lg:max-h-none lg:w-[390px] lg:border-l lg:border-t-0 lg:shadow-[-12px_0_36px_rgba(11,28,48,0.03)]"
      style={{
        backgroundColor: "var(--surface-lowest)",
        borderColor: "var(--border-subtle)",
      }}
    >
      {/* Chatter Header with Indicator & Filter Tabs */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between sticky top-0 z-20 shadow-2xs"
        style={{
          backgroundColor: "var(--surface-base)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
          <div>
            <h2
              className="font-display font-bold text-xs tracking-tight leading-none"
              style={{ color: "var(--on-surface)" }}
            >
              Activity
            </h2>
            <span className="block text-[10px] text-[var(--on-surface-subtle)] mt-0.5">
              Marketing &amp; Studio Timeline
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Pills */}
          <div
            className="flex items-center gap-1 p-0.5 rounded-lg text-[10px] font-mono border"
            style={{
              backgroundColor: "var(--surface-low)",
              borderColor: "var(--border-subtle)",
            }}
          >
            {(["all", "audit", "notes"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => onChangeChatterFilter(filter)}
                className={`px-2 py-0.5 rounded-md transition cursor-pointer capitalize ${
                  chatterFilter === filter
                    ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] font-bold shadow-2xs"
                    : "text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)]"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <span
            className="text-[10.5px] font-mono px-2 py-0.5 rounded-full font-bold border tabular-nums"
            style={{
              backgroundColor: "var(--accent-primary-subtle)",
              color: "var(--accent-primary)",
              borderColor: "color-mix(in srgb, var(--accent-primary) 30%, transparent)",
            }}
          >
            {totalEventsCount}
          </span>
        </div>
      </div>

      {/* Note Composer */}
      <form
        onSubmit={onPostNote}
        className="p-3 border-b"
        style={{
          backgroundColor: "var(--surface-low)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="relative">
          <input
            type="text"
            value={noteInput}
            onChange={(e) => onChangeNoteInput(e.target.value)}
            placeholder="Add an operational note..."
            maxLength={2000}
            disabled={isPostingNote}
            className="w-full rounded-xl border py-2 pl-3 pr-9 text-xs placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 disabled:opacity-60 bg-[var(--surface-lowest)] text-[var(--on-surface)]"
            style={{ borderColor: "var(--border-subtle)" }}
          />
          <button
            type="submit"
            disabled={!noteInput.trim() || isPostingNote}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[var(--on-surface-subtle)] transition hover:text-[var(--accent-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/30 disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
            title="Post note"
            aria-label={isPostingNote ? "Saving note" : "Post note"}
          >
            {isPostingNote ? <Clock className="h-3.5 w-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="mt-1 px-1 text-[10px] text-[var(--on-surface-subtle)] flex items-center justify-between">
          <span>Visible to Marketing and Creative Studio</span>
          <span className="font-mono">{noteInput.length}/2000</span>
        </div>
      </form>

      {/* Chronological Stream */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 font-sans" style={{ backgroundColor: "var(--surface-lowest)" }}>
        {filteredChatter.length === 0 ? (
          <div
            className="py-12 text-center font-display text-xs"
            style={{ color: "var(--on-surface-subtle)" }}
          >
            No updates yet.
          </div>
        ) : (
          filteredChatter.map((evt) => {
            const actorDeptStr = typeof evt.actorDepartment === "string" ? evt.actorDepartment : String(evt.actorDepartment || "");
            const actionStr = typeof evt.action === "string" ? evt.action : String(evt.action || "");
            const isSystemEvent = ["REQUEST_RELEASED", "TASK_CLAIMED", "TASK_UNCLAIMED"].includes(actionStr);
            const isMarketing = actorDeptStr.toLowerCase().includes("marketing") || actionStr.includes("INTAKE");
            const safeActorName = typeof evt.actorName === "string" ? evt.actorName : String(evt.actorName || "");
            const initials = getInitials(safeActorName);

            // Case A: System Event Pill
            if (isSystemEvent) {
              const releaseEvent = actionStr === "REQUEST_RELEASED";
              return (
                <div key={evt.id} className="flex justify-center my-2.5 select-none">
                  <div
                    className={`inline-flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-full px-3 py-1 text-center text-[11px] font-medium shadow-2xs border ${
                      releaseEvent
                        ? "border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/60 dark:text-emerald-200"
                        : "border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-800/40 dark:bg-sky-950/60 dark:text-sky-200"
                    }`}
                  >
                    <span className="font-semibold">{evt.title ? `${evt.title} · ` : ""}</span>
                    <span>{safeActorName}</span>
                    <span className="text-[9.5px] opacity-75 font-mono ml-0.5">
                      · {formatTimeOnly(evt.timestamp) || formatOdooLogDate(evt.timestamp)}
                    </span>
                  </div>
                </div>
              );
            }

            // Case B: Note Message
            if (evt.isNote) {
              return (
                <div key={evt.id} className="flex flex-col select-text max-w-[94%] my-1.5">
                  <div
                    className="w-full rounded-2xl p-3.5 border shadow-2xs"
                    style={{
                      backgroundColor: "var(--surface-base)",
                      borderColor: "color-mix(in srgb, #f59e0b 35%, var(--border-subtle))",
                    }}
                  >
                    <div
                      className="flex items-center justify-between gap-2 pb-1.5 border-b"
                      style={{ borderColor: "var(--border-subtle)" }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-6 h-6 rounded-full text-white font-bold text-[10px] font-mono flex items-center justify-center shrink-0 shadow-2xs bg-amber-500"
                        >
                          {initials}
                        </div>
                        <div className="min-w-0 truncate">
                          <span
                            className="font-display font-bold text-xs truncate block"
                            style={{ color: "var(--on-surface)" }}
                          >
                            {safeActorName}
                          </span>
                        </div>
                        <span
                          className="px-1.5 py-0.5 rounded text-[9.5px] font-bold font-mono border bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50 shrink-0"
                        >
                          Note
                        </span>
                      </div>
                      <span
                        className="text-[9.5px] font-mono whitespace-nowrap"
                        style={{ color: "var(--on-surface-subtle)" }}
                      >
                        {formatOdooLogDate(evt.timestamp)}
                      </span>
                    </div>
                    {evt.body && (
                      <p
                        className="mt-2 text-xs leading-relaxed font-sans whitespace-pre-wrap"
                        style={{ color: "var(--on-surface)" }}
                      >
                        {evt.body}
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            // Case C: Marketing Message (Left-Aligned)
            if (isMarketing) {
              return (
                <div key={evt.id} className="flex flex-col items-start select-text max-w-[94%] my-1.5">
                  <div
                    className="w-full rounded-2xl rounded-tl-xs p-3.5 border shadow-2xs"
                    style={{
                      backgroundColor: "var(--surface-base)",
                      borderColor: "color-mix(in srgb, var(--accent-primary) 25%, var(--border-subtle))",
                    }}
                  >
                    <div
                      className="flex items-center justify-between gap-2 pb-1.5 border-b"
                      style={{ borderColor: "var(--border-subtle)" }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-6 h-6 rounded-full text-white font-bold text-[10px] font-mono flex items-center justify-center shrink-0 shadow-2xs"
                          style={{ backgroundColor: "var(--accent-primary)" }}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0 truncate">
                          <span
                            className="font-display font-bold text-xs truncate block"
                            style={{ color: "var(--on-surface)" }}
                          >
                            {safeActorName}
                          </span>
                        </div>
                        <span
                          className="px-1.5 py-0.5 rounded text-[9.5px] font-bold font-mono border shrink-0"
                          style={{
                            backgroundColor: "var(--accent-primary-subtle)",
                            color: "var(--accent-primary)",
                            borderColor: "color-mix(in srgb, var(--accent-primary) 30%, transparent)",
                          }}
                        >
                          Marketing
                        </span>
                      </div>
                      <span
                        className="text-[9.5px] font-mono whitespace-nowrap"
                        style={{ color: "var(--on-surface-subtle)" }}
                      >
                        {formatOdooLogDate(evt.timestamp)}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className="font-display font-semibold text-xs"
                        style={{ color: "var(--on-surface)" }}
                      >
                        {evt.title}
                      </span>
                      {evt.badge && (
                        <span className="rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-zinc-300">
                          {evt.badge.text}
                        </span>
                      )}
                    </div>

                    {evt.body && (
                      <p
                        className="mt-1.5 text-xs leading-relaxed font-sans whitespace-pre-wrap"
                        style={{ color: "var(--on-surface)" }}
                      >
                        {evt.body}
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            // Case D: Creative Studio Message (Right-Aligned)
            return (
              <div key={evt.id} className="flex flex-col items-end select-text ml-auto max-w-[94%] my-1.5">
                <div
                  className="w-full rounded-2xl rounded-tr-xs p-3.5 border shadow-2xs"
                  style={{
                    backgroundColor: "var(--surface-low)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  <div
                    className="flex items-center justify-between gap-2 pb-1.5 border-b"
                    style={{ borderColor: "var(--border-subtle)" }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-6 h-6 rounded-full text-white font-bold text-[10px] font-mono flex items-center justify-center shrink-0 shadow-2xs bg-purple-600"
                      >
                        {initials}
                      </div>
                      <div className="min-w-0 truncate">
                        <span
                          className="font-display font-bold text-xs truncate block"
                          style={{ color: "var(--on-surface)" }}
                        >
                          {safeActorName}
                        </span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold font-mono bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800/40 shrink-0">
                        Creative Studio
                      </span>
                    </div>
                    <span
                      className="text-[9.5px] font-mono whitespace-nowrap"
                      style={{ color: "var(--on-surface-subtle)" }}
                    >
                      {formatOdooLogDate(evt.timestamp)}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span
                      className="font-display font-semibold text-xs"
                      style={{ color: "var(--on-surface)" }}
                    >
                      {evt.title}
                    </span>
                    {evt.badge && (
                      <span className="rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-zinc-300">
                        {evt.badge.text}
                      </span>
                    )}
                  </div>

                  {evt.body && (
                    <p
                      className="mt-1.5 text-xs leading-relaxed font-sans whitespace-pre-wrap"
                      style={{ color: "var(--on-surface)" }}
                    >
                      {evt.body}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={chatterEndRef} />
      </div>
    </div>
  );
});

DesignChatterStream.displayName = "DesignChatterStream";
