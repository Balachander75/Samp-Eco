import React from "react";
import { LucideIcon } from "lucide-react";

export interface WorkflowTabItem {
  id: string;
  label: string;
  count?: number;
  subtext?: string;
  icon?: LucideIcon;
  color?: string;
}

export interface WorkflowTabStripProps {
  tabs: WorkflowTabItem[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  className?: string;
  compact?: boolean;
}

export const WorkflowTabStrip: React.FC<WorkflowTabStripProps> = ({
  tabs,
  activeTab,
  onSelectTab,
  className = "",
  compact = false,
}) => {
  return (
    <div
      className={`flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 select-none ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        if (compact || !tab.subtext) {
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer border ${
                isActive
                  ? "bg-purple-600 dark:bg-purple-900/60 text-white border-purple-600 shadow-2xs font-bold"
                  : "bg-white dark:bg-zinc-900 text-neutral-600 dark:text-zinc-400 border-neutral-200/90 dark:border-white/[0.08] hover:border-neutral-300 dark:hover:border-zinc-700 hover:text-neutral-900 dark:hover:text-zinc-200"
              }`}
            >
              {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-neutral-400 dark:text-zinc-500"}`} />}
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-zinc-400"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelectTab(tab.id)}
            className={`flex flex-col text-left px-3.5 py-2 rounded-xl transition-all duration-150 cursor-pointer border shrink-0 min-w-[130px] ${
              isActive
                ? "bg-white dark:bg-purple-950/25 border-purple-500 dark:border-purple-500 shadow-xs ring-1 ring-purple-600/20"
                : "bg-white/70 dark:bg-zinc-900/70 hover:bg-white dark:hover:bg-zinc-900 text-neutral-600 dark:text-zinc-400 border-neutral-200/90 dark:border-white/[0.08] hover:border-neutral-300"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-xs font-bold truncate ${
                  isActive
                    ? "text-purple-700 dark:text-purple-300"
                    : "text-neutral-800 dark:text-zinc-200"
                }`}
              >
                {tab.label}
              </span>
              {typeof tab.count === "number" && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                    isActive
                      ? "bg-purple-100 dark:bg-purple-950/40 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300"
                      : "bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-zinc-400"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </div>
            {tab.subtext && (
              <span
                className={`text-[10px] truncate mt-0.5 ${
                  isActive
                    ? "text-purple-700/80 dark:text-purple-400/80 font-medium"
                    : "text-neutral-400 dark:text-zinc-500"
                }`}
              >
                {tab.subtext}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default WorkflowTabStrip;
