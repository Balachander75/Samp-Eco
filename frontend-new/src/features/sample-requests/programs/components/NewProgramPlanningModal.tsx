import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useMasterData } from "../../hooks/useMasterData";
import { CustomerCombobox } from "@/components/erp";

export interface NewProgramPlanningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: (params: {
    customer: string;
    targetPlant: string;
    programName: string;
    programYear: string;
  }) => void;
}

export const getProgramYearOptions = (): string[] => {
  const currentYear = new Date().getFullYear();
  return [String(currentYear), String(currentYear + 1), String(currentYear + 2)];
};

export const NewProgramPlanningModal: React.FC<NewProgramPlanningModalProps> = ({
  isOpen,
  onClose,
  onProceed,
}) => {
  const { customers, plants } = useMasterData();
  const yearOptions = useMemo(() => getProgramYearOptions(), []);

  const [customer, setCustomer] = useState("");
  const [targetPlant, setTargetPlant] = useState("");
  const [programName, setProgramName] = useState("");
  const [programYear, setProgramYear] = useState(() => getProgramYearOptions()[0]);
  const [error, setError] = useState<string | null>(null);

  // Reset the campaign form whenever the modal opens; customer must be chosen explicitly.
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setCustomer("");
    setTargetPlant("");
    setProgramName("");
    setProgramYear(getProgramYearOptions()[0]);
  }, [isOpen]);

  // Resolve the hidden target-plant default when master data finishes loading.
  useEffect(() => {
    if (!isOpen || plants.length === 0) return;
    setTargetPlant((current) => current || plants[0].name);
  }, [isOpen, plants]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer.trim()) {
      setError("Please select a customer account.");
      return;
    }
    if (!programName.trim()) {
      setError("Please provide a program campaign title.");
      return;
    }
    if (!programYear.trim()) {
      setError("Please specify the program year.");
      return;
    }

    setError(null);
    onProceed({
      customer: customer.trim(),
      targetPlant: targetPlant.trim() || "Plant 1",
      programName: programName.trim(),
      programYear: programYear.trim(),
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true">
      {/* Soft diffused backdrop */}
      <div
        className="fixed inset-0 bg-[var(--overlay-backdrop)] transition-opacity"
        onClick={onClose}
      />

      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-[0_24px_60px_-12px_rgba(11,28,48,0.2)] border border-slate-200/80 overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-200 flex flex-col">
          {/* ── Editorial Header (Clean, icon-free) ── */}
          <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 bg-slate-50/60 shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight font-display">
                  New Seasonal Program Planning
                </h3>
                <span className="inline-flex items-center text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30">
                  Step 1 of 2
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Define campaign master parameters and launch the material allocation matrix
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Form Body ── */}
          <form onSubmit={handleSubmit} className="p-7 space-y-5 text-sm">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-xs animate-in fade-in">
                {error}
              </div>
            )}

            {/* 1. Customer Account */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700">
                Customer / Country <span className="text-rose-500">*</span>
              </label>
              <CustomerCombobox
                customers={customers}
                value={customer}
                onChange={setCustomer}
                placeholder="Select a customer and country..."
                className="w-full"
              />
              <p className="text-[11px] text-slate-400">
                Choose a customer from the list; its registered country will appear in the selection.
              </p>
            </div>

            {/* 2. Program Campaign Title */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700">
                Program Campaign Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                placeholder="e.g. Back to School 2026, Hardcover Notebooks Line, Corporate Diaries"
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 focus:bg-white text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-primary)]/20 transition-all shadow-2xs"
              />
            </div>

            {/* 3. Program Year (Horizon selection - clean text only, no check/calendar icons) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700">
                  Program Year <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">
                  Active cycle + 2 year horizon
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {yearOptions.map((yr) => {
                  const isSelected = programYear === yr;
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setProgramYear(yr)}
                      className={`h-11 px-4 rounded-xl text-sm font-mono font-bold transition-all flex items-center justify-center cursor-pointer select-none ${
                        isSelected
                          ? "bg-[var(--accent-primary)] text-white shadow-[0_4px_14px_rgba(0,109,50,0.25)] border-transparent"
                          : "bg-slate-50/80 hover:bg-slate-100 text-slate-700 border border-slate-200/80"
                      }`}
                    >
                      <span>{yr}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Footer Action Buttons ── */}
            <div className="flex items-center justify-between pt-5 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="h-10 px-6 rounded-xl text-white text-xs font-semibold transition-all shadow-[0_4px_14px_rgba(0,109,50,0.25)] hover:shadow-[0_6px_20px_rgba(0,109,50,0.35)] cursor-pointer active:scale-98 tracking-tight bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
              >
                Proceed to Material Matrix
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NewProgramPlanningModal;
