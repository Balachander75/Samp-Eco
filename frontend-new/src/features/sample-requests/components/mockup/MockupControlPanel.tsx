import React from "react";
import { SampleRequestItem } from "../../types";
import { RequestClosureControl, type RequestClosureTarget } from "../common/RequestClosureControl";
import { Copy, Check, X } from "lucide-react";

export interface MockupControlPanelProps {
  activeRequest: SampleRequestItem;
  copiedCode: boolean;
  onClose: () => void;
  onCopyCode: () => void;
  role?: "marketing" | "creative" | "studio" | "sampling" | "plant";
  activeTab?: string;
  onSelectTab?: (tab: any) => void;
  isCreativeDone?: boolean;
  isStudioDone?: boolean;
  isReleasedToPlant?: boolean;
  closureRequests?: RequestClosureTarget[];
  canCloseRequest?: boolean;
  onRequestClosed?: () => void | Promise<void>;
}

export const MockupControlPanel: React.FC<MockupControlPanelProps> = ({
  activeRequest,
  copiedCode,
  onClose,
  onCopyCode,
  role = "marketing",
  closureRequests = [],
  canCloseRequest = false,
  onRequestClosed,
}) => {
  const code =
    activeRequest.materialCode ||
    activeRequest.requestCode ||
    (activeRequest.requestCodes as any)?.mockup ||
    activeRequest.srNumber ||
    (activeRequest.id ? `MK-${String(activeRequest.id).padStart(4, "0")}` : "MK-0000");

  const getRoleDeskBadge = () => {
    switch (role) {
      case "creative":
        return {
          label: "Creative Studio",
          className: "bg-purple-500/10 text-purple-700 border-purple-500/20",
        };
      case "studio":
        return {
          label: "3D Studio",
          className: "bg-teal-500/10 text-teal-700 border-teal-500/20",
        };
      case "sampling":
        return {
          label: "Sampling PMT",
          className: "bg-sky-500/10 text-sky-700 border-sky-500/20",
        };
      case "plant":
        return {
          label: "Plant Execution",
          className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
        };
      case "marketing":
      default:
        return {
          label: "Marketing Desk",
          className: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
        };
    }
  };

  const deskBadge = getRoleDeskBadge();

  return (
    <header className="px-4 py-2 bg-[var(--surface-base)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 shrink-0 shadow-2xs select-text">
      {/* ── Left: Request Code & Modal Title ── */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onCopyCode}
          className="font-mono text-xs font-bold px-2 py-1 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20 hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/15 active:scale-95 transition flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
          title="Click to copy request code"
        >
          <span>{code}</span>
          {copiedCode ? (
            <Check className="w-3 h-3 text-emerald-500 stroke-[3]" />
          ) : (
            <Copy className="w-3 h-3 opacity-60" />
          )}
        </button>

        <span className="text-xs font-semibold text-[var(--on-surface-muted)] hidden sm:inline truncate">
          Sample Request Workspace
        </span>
      </div>

      {/* ── Right: Role Desk Badge + Closure Action + Close Action ── */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Role Desk Badge */}
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10.5px] font-semibold border ${deskBadge.className}`}
        >
          <span>{deskBadge.label}</span>
        </span>

        {role === "marketing" && (
          <RequestClosureControl
            requests={closureRequests}
            canClose={canCloseRequest}
            onClosed={onRequestClosed}
          />
        )}

        {/* Modal Close [X] */}
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 rounded-lg border border-[var(--border-subtle)] flex items-center justify-center text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)] transition cursor-pointer active:scale-95 shadow-2xs"
          title="Close Inspector (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

export default MockupControlPanel;
