import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Calendar,
  Clock,
  AlertTriangle,
  Send,
  Lock,
} from "lucide-react";
import { OperationalDatePicker } from "@/components/erp";
import { getNextWorkingDate } from "@/lib/holidayUtils";
import { operationalWorkdaysBetween } from "@/lib/operationalWorkdays";

export interface FeasibilityCounterDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalDate: string;
  isEligible: boolean;
  statusLabel?: string;
  onSubmitCounterDate: (proposedDate: string, reason: string) => Promise<void> | void;
}

export const FeasibilityCounterDateModal: React.FC<FeasibilityCounterDateModalProps> = ({
  isOpen,
  onClose,
  originalDate,
  isEligible,
  statusLabel = "Within operational policy",
  onSubmitCounterDate,
}) => {
  const [proposedDate, setProposedDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const originalDateOnly = (originalDate || "").split("T", 1)[0].slice(0, 10);

  const extensionWorkdays = useMemo(() => {
    if (!proposedDate || !originalDateOnly) return 0;
    if (proposedDate <= originalDateOnly) return 0;
    return operationalWorkdaysBetween(originalDateOnly, proposedDate);
  }, [proposedDate, originalDateOnly]);

  useEffect(() => {
    if (isOpen) return;
    setProposedDate("");
    setReason("");
    setError(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isSubmitting) return;
      setProposedDate("");
      setReason("");
      setError(null);
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setProposedDate("");
    setReason("");
    setError(null);
    onClose();
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetAndClose();
  };

  const minSelectableDate = originalDateOnly
    ? getNextWorkingDate(originalDateOnly, 1)
    : new Date().toISOString().slice(0, 10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!isEligible) {
      setError("This feasibility request is not eligible for a revised counter-date proposal.");
      return;
    }
    if (!proposedDate.trim()) {
      setError("Please select a proposed target date.");
      return;
    }
    if (proposedDate <= new Date().toISOString().slice(0, 10)) {
      setError("Choose a revised date after today.");
      return;
    }
    if (!reason.trim()) {
      setError("Please provide a remark / reason for the date adjustment.");
      return;
    }
    if (originalDateOnly && proposedDate <= originalDateOnly) {
      setError("Proposed target date must be later than the current required date.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmitCounterDate(proposedDate.trim(), reason.trim());
      resetAndClose();
    } catch (err: any) {
      setError(err?.message || "Could not submit counter date proposal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] overflow-y-auto flex items-center justify-center p-3 sm:p-5 bg-[var(--overlay-backdrop)] select-text animate-smooth-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="counter-date-dialog-title"
      aria-describedby="counter-date-dialog-description"
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className="fixed inset-0 bg-transparent"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md bg-[var(--surface-lowest)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl animate-smooth-modal overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600  flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="counter-date-dialog-title" className="text-sm font-bold text-[var(--on-surface)] tracking-tight font-display">
                  Propose Counter Required Date
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50  text-amber-700  border border-amber-200 ">
                  SAMP SLA
                </span>
              </div>
              <p id="counter-date-dialog-description" className="text-[11px] text-[var(--on-surface-muted)] mt-0.5">
                Propose a feasible operational date to Marketing
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SLA Status Strip */}
        <div
          className={`px-6 py-2.5 flex items-center justify-between text-xs border-b ${
            isEligible
              ? "bg-amber-50/70  text-amber-800  border-amber-100 "
              : "bg-rose-50/70  text-rose-800  border-rose-100 "
          }`}
        >
          <div className="flex items-center gap-2">
            {isEligible ? (
              <Clock className="w-3.5 h-3.5 text-amber-600 " />
            ) : (
              <Lock className="w-3.5 h-3.5 text-rose-600 " />
            )}
            <span className="font-semibold">{statusLabel}</span>
          </div>
          <span className="text-[10.5px] font-mono opacity-80">
            {isEligible ? "Negotiation window active" : "Proposal locked"}
          </span>
        </div>

        {/* Form Body - Two Clean Fields Only: Date and Remark */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50  border border-rose-200  text-rose-700  text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Field 1: Target Date */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-mono text-[10px] uppercase font-bold text-[var(--on-surface-subtle)]">
                Current Required Date: <span className="text-[var(--on-surface)] font-mono">{originalDateOnly || "Flexible"}</span>
              </span>
            </div>

            <label className="block text-xs font-bold text-[var(--on-surface)]">
              Proposed Counter Date <span className="text-rose-500">*</span>
            </label>
            <OperationalDatePicker
              value={proposedDate}
              onChange={(d) => {
                setProposedDate(d);
                setError(null);
              }}
              minDate={minSelectableDate}
              placeholder="Select target date"
              disabled={!isEligible || isSubmitting}
              className="w-full"
            />
            {extensionWorkdays > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50/80  border border-amber-200  text-xs text-amber-900  animate-in fade-in duration-200">
                <Clock className="w-3.5 h-3.5 text-amber-600  shrink-0" />
                <span>
                  Timeline adjustment: <strong className="font-mono text-amber-950  font-bold">+{extensionWorkdays} operational workday{extensionWorkdays === 1 ? "" : "s"}</strong> extension requested
                </span>
              </div>
            )}
          </div>

          {/* Field 2: Remark / Operational Reason */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--on-surface)]">
              Remark / Operational Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
              disabled={!isEligible || isSubmitting}
              placeholder="Enter remark or explanation for date change..."
              className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-3 text-xs text-[var(--on-surface)] outline-none transition focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 placeholder:text-[var(--on-surface-subtle)]"
            />
            <p className="text-[10.5px] text-[var(--on-surface-muted)]">
              This remark will be sent to the Marketing team with the proposed date.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="h-9 px-4 rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--surface-low)] text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] text-xs font-semibold cursor-pointer transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!isEligible || isSubmitting || !proposedDate || !reason.trim()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] px-5 text-xs font-bold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/30 active:scale-98 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Submitting..." : "Send Counter Date to Marketing"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default FeasibilityCounterDateModal;
