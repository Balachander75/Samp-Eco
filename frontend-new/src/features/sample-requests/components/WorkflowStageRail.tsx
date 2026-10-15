import React from "react";
import { Check } from "lucide-react";

export interface WorkflowStage {
  key: string;
  label: string;
}

interface WorkflowStageRailProps {
  stages: WorkflowStage[];
  current: string;
}

export const WorkflowStageRail: React.FC<WorkflowStageRailProps> = ({ stages, current }) => {
  const currentIndex = current === "done" ? stages.length : stages.findIndex((stage) => stage.key === current);
  const activeIndex = currentIndex;

  return (
    <nav className="overflow-x-auto" aria-label="Workflow progress" tabIndex={0}>
      <ol className="flex min-w-[600px] items-start px-1 py-1 sm:min-w-0">
        {stages.map((stage, index) => {
          const complete = index < activeIndex || current === "done";
          const active = index === activeIndex && current !== "done";
          return (
            <li key={stage.key} aria-current={active ? "step" : undefined} className="flex min-w-0 flex-1 items-start">
              <div className="flex min-w-0 flex-col items-center text-center">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold ${complete ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white" : active ? "border-[var(--accent-primary)] bg-[var(--surface-lowest)] text-[var(--accent-primary)] ring-4 ring-[var(--accent-primary)]/10" : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface-subtle)]"}`}>
                  {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className={`mt-1.5 max-w-24 text-[10px] leading-tight ${active ? "font-bold text-[var(--on-surface)]" : complete ? "font-medium text-[var(--on-surface-muted)]" : "text-[var(--on-surface-subtle)]"}`}>{stage.label}</span>
              </div>
              {index < stages.length - 1 && <span aria-hidden="true" className={`mx-2 mt-3.5 h-px flex-1 ${index < activeIndex || current === "done" ? "bg-[var(--accent-primary)]" : "bg-[var(--border-subtle)]"}`} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default WorkflowStageRail;
