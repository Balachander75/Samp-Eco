import React, { useEffect, useState } from "react";
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

export interface DesignCounterDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalDate: string;
  isSlaEligible: boolean;
  slaLabel: string;
  onSubmitCounterDate: (proposedDate: string, reason: string) => Promise<void> | void;
}

export const DesignCounterDateModal: React.FC<DesignCounterDateModalProps> = ({
  isOpen,
  onClose,
  originalDate,
  isSlaEligible,
  slaLabel,
  onSubmitCounterDate,
}) => {
  const [proposedDate, setProposedDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const originalDateOnly = originalDate.split("T", 1)[0].slice(0, 10);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!isSlaEligible) {
      setError(
        slaLabel === "Awaiting Marketing decision"
          ? "A counter date is already awaiting Marketing. Wait for their decision before proposing another."
          : slaLabel === "Counter proposal already used"
          ? "This request has already used its one counter-date proposal. No further date changes can be submitted."
          : "The 48-hour window to propose a counter date has expired."
      );
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
      setError("Please explain why the requested date is not feasible.");
      return;
    }
    if (originalDateOnly && proposedDate <= originalDateOnly) {
      setError("Proposed target date must be later than the original required date.");
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
      className="fixed inset-0 z-[120] overflow-y-auto flex items-center justify-center p-3 sm:p-5 bg-[var(--overlay-backdrop)] select-text"
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

      <div className="relative z-10 w-full max-w-lg bg-white  border border-slate-200/90  rounded-2xl shadow-2xl animate-smooth-modal">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white  border-b border-slate-100 ">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600  flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="counter-date-dialog-title" className="text-sm font-bold text-slate-900  tracking-tight font-display">
                  Propose Counter Required Date
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50  text-amber-700  border border-amber-200 ">
                  48H SLA
                </span>
              </div>
              <p id="counter-date-dialog-description" className="text-[11px] text-slate-500  mt-0.5">
                Negotiate deliverable timeline with Marketing
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100   transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SLA Status Strip */}
        <div
          className={`px-6 py-2.5 flex items-center justify-between text-xs border-b ${
            isSlaEligible
              ? "bg-amber-50/70  text-amber-800  border-amber-100 "
              : "bg-rose-50/70  text-rose-800  border-rose-100 "
          }`}
        >
          <div className="flex items-center gap-2">
            {isSlaEligible ? (
              <Clock className="w-3.5 h-3.5 text-amber-600 " />
            ) : (
              <Lock className="w-3.5 h-3.5 text-rose-600" />
            )}
            <span className="font-semibold">{slaLabel}</span>
          </div>
          <span className="text-[10.5px] font-mono opacity-80">
            {isSlaEligible ? "Within 2-day policy" : "Extension locked"}
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50  border border-rose-200  text-rose-700  text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current vs Proposed Date Comparison */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50  border border-slate-200/80 ">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-500  block font-bold">
                Current committed deadline
              </span>
              <span className="text-xs font-bold text-slate-800  font-mono mt-1 block">
                {originalDateOnly || "Not specified"}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-[var(--accent-primary)]  block font-bold">
                Counter Proposed Date <span className="text-rose-500">*</span>
              </span>
              <div className="mt-1">
                <OperationalDatePicker
                  value={proposedDate}
                  onChange={setProposedDate}
                  placeholder="Select new target date"
                  disabled={!isSlaEligible || isSubmitting}
                  calendarAlign="right"
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Justification Reason */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700  mb-1.5 font-sans">
              Operational Justification / Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={!isSlaEligible || isSubmitting}
              placeholder="Explain why the required date is not feasible (e.g. Studio queue at capacity; 10 artwork concepts require 12 business days for proofing)..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 outline-none transition focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 placeholder:text-slate-400   "
            />
            <p className="text-[10.5px] text-slate-400  mt-1">
              This message will be shown directly to Marketing for acceptance or rejection.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 ">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="h-9 px-4 rounded-xl bg-slate-100 hover:bg-slate-200   text-slate-700  text-xs font-semibold cursor-pointer transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!isSlaEligible || isSubmitting || !proposedDate || !reason.trim()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-4 text-xs font-bold text-white transition hover:bg-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/30 focus-visible:ring-offset-2 active:scale-98 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Submitting..." : "Send Counter Date"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
