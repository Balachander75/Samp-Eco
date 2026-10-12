import React from "react";

export interface ChatterMessageItem {
  id: string;
  author: string;
  initials: string;
  time: string;
  type: "message" | "system" | "audit";
  title?: string;
  content: string;
}

export interface InspectorChatterProps {
  chatterFeed: ChatterMessageItem[];
}

export const InspectorChatter: React.FC<InspectorChatterProps> = ({ chatterFeed }) => {
  return (
    <aside className="hidden lg:flex w-80 xl:w-96 border-l border-[var(--border-subtle)] bg-[var(--surface-lowest)] flex-col h-full shrink-0 select-none">
      {/* SLA Target Banner */}
      <div className="px-4 py-3 bg-[var(--surface-base)] border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)]"></span>
          <span className="font-bold text-xs text-slate-800 dark:text-zinc-200 font-display">
            SLA: On Target
          </span>
        </div>
        <span className="text-[10px] font-mono font-bold bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] px-2 py-0.5 rounded-md border border-[var(--accent-primary)]/25">
          Optimal Turnaround
        </span>
      </div>

      {/* Header Bar - Live Activity Log */}
      <div className="px-4 py-2.5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)]"></span>
          <span className="font-bold text-xs text-slate-800 dark:text-zinc-200 font-display">
            Audit Trail &amp; History
          </span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 font-bold">
          Live Log
        </span>
      </div>

      {/* Chronological Chatter Feed Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
        {chatterFeed.map((item) => (
          <div key={item.id} className="flex space-x-2.5">
            <div className="w-6 h-6 rounded-full bg-[var(--accent-primary)] text-white flex items-center justify-center font-bold text-[9px] shrink-0 shadow-2xs font-display">
              {item.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-900 dark:text-zinc-100 truncate font-display">
                  {item.author}
                </span>
                <span className="text-slate-400 font-mono text-[10px] shrink-0 ml-1">
                  {item.time}
                </span>
              </div>
              {item.title && (
                <div className="text-[10.5px] font-mono font-bold text-slate-500 mt-0.5">
                  {item.title}
                </div>
              )}
              <div className="mt-1 text-slate-700 dark:text-zinc-300 bg-slate-50/70 dark:bg-zinc-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-white/5 text-[11px] leading-relaxed font-sans">
                {item.content}
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default InspectorChatter;
