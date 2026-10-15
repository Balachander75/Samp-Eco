import React, { useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Plus,
  Trash2,
  UploadCloud,
  Link2,
  Check,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";
import { CustomerCombobox, OperationalDatePicker } from "@/components/erp";
import { isDateRestricted } from "@/lib/holidayUtils";
import { FEASIBILITY_TYPES } from "../utils/feasibilityParsers";
import { FeasibilityRequestPayload } from "../types";
import { useMasterData } from "../hooks/useMasterData";
import { CustomerItem } from "@/types/master";

export interface NewFeasibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: FeasibilityRequestPayload) => Promise<boolean | void>;
  customers?: CustomerItem[];
  existingCustomers?: string[];
  requestCreatedBy?: string;
  defaultPlant?: string;
}

const formatYMD = (d: Date) => d.toISOString().split("T")[0];

export const NewFeasibilityModal: React.FC<NewFeasibilityModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  customers: propCustomers,
  existingCustomers = [],
  defaultPlant = "Navneet - Khaniwade",
}) => {
  const { customers: dbCustomers } = useMasterData(isOpen);

  const customerItems: CustomerItem[] = useMemo(() => {
    if (propCustomers && propCustomers.length > 0) return propCustomers;
    if (dbCustomers && dbCustomers.length > 0) return dbCustomers;
    return (existingCustomers || []).map((name, idx) => ({
      id: idx + 1,
      name,
      country: undefined,
    }));
  }, [propCustomers, dbCustomers, existingCustomers]);

  const [customer, setCustomer] = useState("");
  const [selectedFeasibilityType, setSelectedFeasibilityType] = useState<string>("new_category");
  const [customTypeOther, setCustomTypeOther] = useState("");
  const [feasibilityDescription, setFeasibilityDescription] = useState("");
  const [releaseRemarks, setReleaseRemarks] = useState("");
  const [feasibilityTargetDate, setFeasibilityTargetDate] = useState("");

  // Attachments
  const [uploadedImages, setUploadedImages] = useState<Array<{ id: string; url: string; name: string; size?: string }>>([]);
  const [webLinks, setWebLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState<string>("");
  const [mediaTab, setMediaTab] = useState<"files" | "links">("files");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalAttachments = uploadedImages.length + webLinks.length;

  const handleMultipleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const availableSlots = 2 - uploadedImages.length;
    if (availableSlots <= 0) {
      setError("Maximum 2 images allowed for feasibility check.");
      return;
    }

    const filesToUpload = Array.from(files).slice(0, availableSlots);
    for (const file of filesToUpload) {
      if (!file.type.startsWith("image/")) {
        setError("Only image files (PNG, JPG, WEBP) are supported.");
        continue;
      }
      const sizeKb = Math.round(file.size / 1024);
      const url = URL.createObjectURL(file);
      setUploadedImages((prev) => [
        ...prev,
        {
          id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          url,
          name: file.name,
          size: `${sizeKb} KB`,
        },
      ]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    setError(null);
  };

  const handleRemoveImage = (id: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleAddWebLink = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = linkInput.trim();
    if (!trimmed) return;
    if (webLinks.length >= 1) {
      setError("Maximum 1 reference link allowed for feasibility check.");
      return;
    }
    const formatted = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    setWebLinks((prev) => [...prev, formatted]);
    setLinkInput("");
    setError(null);
  };

  const handleRemoveWebLink = (index: number) => {
    setWebLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!customer.trim()) {
      setError("Please select a customer account.");
      return;
    }
    if (selectedFeasibilityType === "other" && !customTypeOther.trim()) {
      setError("Please specify the custom requirement.");
      return;
    }
    if (!feasibilityDescription.trim()) {
      setError("Please provide description and technical notes.");
      return;
    }
    if (!feasibilityTargetDate.trim()) {
      setError("Please select a required target date.");
      return;
    }
    if (isDateRestricted(feasibilityTargetDate)) {
      setError(
        "The selected required date falls on a factory holiday (Sundays and even Saturdays are plant off days). Please select an active working day."
      );
      return;
    }

    const payload: FeasibilityRequestPayload = {
      customer: customer.trim(),
      feasibilityType: selectedFeasibilityType,
      customFeasibilityType: selectedFeasibilityType === "other" ? customTypeOther.trim().slice(0, 25) : null,
      descriptionNotes: feasibilityDescription.trim().slice(0, 75),
      requiredDate: feasibilityTargetDate,
      marketingRemarks: releaseRemarks.trim() ? releaseRemarks.trim().slice(0, 100) : null,
      referenceImages: uploadedImages.map((img) => img.url),
      referenceImageNames: uploadedImages.map((img) => img.name),
      referenceLinks: webLinks,
      targetPlant: defaultPlant || "Navneet - Khaniwade",
    };

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await onSubmit(payload);
      if (result !== false) {
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || "Failed to create feasibility request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs select-text animate-smooth-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-3 sm:p-5">
        <div
          className="relative w-full max-w-4xl bg-[var(--surface-low)] dark:bg-zinc-950 border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xl select-text overflow-hidden transition-all duration-200 animate-smooth-modal"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Luminous Engine Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-900 shrink-0 border-b border-slate-200/70 dark:border-white/[0.06] shadow-[0_1px_4px_rgba(11,28,48,0.02)]">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight font-display">
                    Technical Feasibility Check
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] dark:text-emerald-400 border border-[var(--accent-primary)]/20 tracking-wider uppercase">
                    FC-0001
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
                  Sampling feasibility assessment, paper GSM &amp; prototype specification evaluation
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body: Single Page Document Sheet */}
          <div className="p-5 sm:p-6 max-h-[78vh] overflow-y-auto">
            {error && (
              <div className="mb-4 px-3.5 py-2.5 rounded border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-medium">
                {error}
              </div>
            )}

            {/* TAB 1: FEASIBILITY CHECK FORM */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 shadow-[0_2px_12px_rgba(11,28,48,0.03)] space-y-4">
                {/* Two-Column Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  {/* Left Column (7 cols) */}
                  <div className="lg:col-span-7 space-y-3.5">
                    {/* Customer Account */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5 font-sans">
                        Customer Account <span className="text-rose-500">*</span>
                      </label>
                      <CustomerCombobox
                        customers={customerItems}
                        value={customer}
                        onChange={(val) => {
                          setCustomer(val);
                          if (error) setError(null);
                        }}
                        className="w-full"
                      />
                    </div>

                    {/* Feasibility Classification Selection Cards */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5 font-sans">
                        Feasibility Classification <span className="text-rose-500">*</span>
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {FEASIBILITY_TYPES.map((type) => {
                          const isSelected = selectedFeasibilityType === type.id;
                          const isOther = type.id === "other";
                          if (isOther && isSelected) {
                            return (
                              <div
                                key={type.id}
                                className="sm:col-span-2 flex min-h-12 items-center justify-between rounded-xl border border-[var(--accent-primary)] bg-[var(--accent-primary)]/[0.035] px-3 ring-2 ring-[var(--accent-primary)]/20 shadow-2xs"
                              >
                                <input
                                  type="text"
                                  required
                                  autoFocus
                                  maxLength={25}
                                  aria-label="Describe the other custom feasibility requirement"
                                  placeholder="Custom requirement (max 25 chars)..."
                                  value={customTypeOther}
                                  onChange={(e) => setCustomTypeOther(e.target.value.slice(0, 25))}
                                  className="w-full bg-transparent text-xs font-medium text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
                                />
                                <span
                                  className={`text-[10px] font-mono shrink-0 ml-2 ${
                                    customTypeOther.length >= 25 ? "text-amber-500 font-bold" : "text-zinc-400"
                                  }`}
                                >
                                  {customTypeOther.length}/25
                                </span>
                              </div>
                            );
                          }
                          return (
                            <button
                              key={type.id}
                              type="button"
                              onClick={() => setSelectedFeasibilityType(type.id)}
                              className={`text-left min-h-12 px-3 py-2 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-3 relative group ${
                                isOther ? "sm:col-span-2" : ""
                              } ${
                                isSelected
                                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/[0.035] ring-2 ring-[var(--accent-primary)]/20 shadow-2xs"
                                  : "border-slate-200/90 dark:border-white/[0.08] hover:border-slate-300 bg-slate-50/60 dark:bg-zinc-900/40 hover:bg-white dark:hover:bg-zinc-850 text-slate-700 dark:text-zinc-300"
                              }`}
                            >
                              <div className="flex min-w-0 items-center justify-between w-full gap-3">
                                <span
                                  className={`text-xs tracking-tight ${
                                    isSelected
                                      ? "text-[var(--accent-primary)] dark:text-emerald-400 font-bold"
                                      : "font-semibold text-slate-900 dark:text-zinc-100"
                                  }`}
                                >
                                  {type.label}
                                </span>
                                <span
                                  className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                    isSelected
                                      ? "bg-[var(--accent-primary)] text-white"
                                      : "border border-slate-300 dark:border-zinc-600"
                                  }`}
                                >
                                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Technical Description & Notes */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 font-sans">
                          Technical Description &amp; Specifications <span className="text-rose-500">*</span>
                        </label>
                        <span
                          className={`text-[10px] font-mono ${
                            feasibilityDescription.length >= 75 ? "text-amber-500 font-bold" : "text-zinc-400"
                          }`}
                        >
                          {feasibilityDescription.length}/75
                        </span>
                      </div>
                      <textarea
                        required
                        rows={3}
                        maxLength={75}
                        placeholder="Brief technical context, material GSM, binding specs... (max 75 characters)"
                        value={feasibilityDescription}
                        onChange={(e) => setFeasibilityDescription(e.target.value.slice(0, 75))}
                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-900/80 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 outline-none transition-all resize-none leading-relaxed shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Right Column (5 cols) */}
                  <div className="lg:col-span-5 space-y-3.5">
                    {/* Required Target Date */}
                    <div>
                      <OperationalDatePicker
                        label="Required Target Date"
                        required
                        value={feasibilityTargetDate}
                        onChange={(val) => {
                          setFeasibilityTargetDate(val);
                          if (error) setError(null);
                        }}
                        minDate={formatYMD(new Date())}
                        placeholder="Select required target date..."
                      />
                    </div>

                    {/* Marketing Remarks / Notes */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 font-sans">
                          Marketing Remarks / Notes
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-zinc-400 font-medium">Optional</span>
                          <span className="text-zinc-300 dark:text-zinc-600">·</span>
                          <span
                            className={`text-[10px] font-mono ${
                              releaseRemarks.length >= 100 ? "text-amber-500 font-bold" : "text-zinc-400"
                            }`}
                          >
                            {releaseRemarks.length}/100
                          </span>
                        </div>
                      </div>
                      <textarea
                        rows={2}
                        maxLength={100}
                        placeholder="Marketing remarks, client constraints... (max 100 characters)"
                        value={releaseRemarks}
                        onChange={(e) => setReleaseRemarks(e.target.value.slice(0, 100))}
                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-900/80 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 outline-none transition-all resize-none leading-relaxed shadow-2xs"
                      />
                    </div>

                    {/* Attachments Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 font-sans">
                          Reference Attachments
                        </label>
                        <span
                          className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full transition-colors font-mono ${
                            uploadedImages.length >= 2 && webLinks.length >= 1
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40"
                              : totalAttachments > 0
                              ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] dark:bg-[var(--accent-primary)]/20 dark:text-emerald-300 border border-[var(--accent-primary)]/20"
                              : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {uploadedImages.length}/2 images · {webLinks.length}/1 link
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        <div className="inline-flex w-full rounded-xl bg-slate-100/90 dark:bg-zinc-800/80 p-1 text-[11px] border border-slate-200/70 dark:border-zinc-700/60">
                          <button
                            type="button"
                            onClick={() => setMediaTab("files")}
                            className={`flex-1 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              mediaTab === "files"
                                ? "bg-white dark:bg-zinc-700 text-[var(--accent-primary)] dark:text-emerald-400 shadow-xs font-bold"
                                : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 font-medium"
                            }`}
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Image Upload</span>
                            {uploadedImages.length > 0 && (
                              <span className="ml-1 text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] dark:bg-[var(--accent-primary)]/30 dark:text-emerald-300">
                                {uploadedImages.length}
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setMediaTab("links")}
                            className={`flex-1 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              mediaTab === "links"
                                ? "bg-white dark:bg-zinc-700 text-[var(--accent-primary)] dark:text-emerald-400 shadow-xs font-bold"
                                : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 font-medium"
                            }`}
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            <span>Web URL Link</span>
                            {webLinks.length > 0 && (
                              <span className="ml-1 text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] dark:bg-[var(--accent-primary)]/30 dark:text-emerald-300">
                                {webLinks.length}
                              </span>
                            )}
                          </button>
                        </div>

                        {mediaTab === "files" && (
                          <div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={handleMultipleImageUpload}
                              className="hidden"
                            />
                            {uploadedImages.length < 2 ? (
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-3 px-3.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-700 hover:border-[var(--accent-primary)] bg-slate-50/60 dark:bg-zinc-900/40 hover:bg-[var(--accent-primary)]/[0.03] text-slate-600 dark:text-zinc-400 hover:text-[var(--accent-primary)] flex items-center justify-between text-xs font-medium transition-all cursor-pointer group shadow-2xs"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 group-hover:bg-[var(--accent-primary)]/10 text-slate-400 group-hover:text-[var(--accent-primary)] flex items-center justify-center transition-colors border border-slate-200 dark:border-zinc-700 group-hover:border-[var(--accent-primary)]/30">
                                    <UploadCloud className="w-4 h-4" />
                                  </div>
                                  <div className="text-left">
                                    <span className="block font-semibold text-slate-800 dark:text-zinc-200 group-hover:text-[var(--accent-primary)] transition-colors">
                                      Choose photos to upload
                                    </span>
                                    <span className="block text-[10px] text-slate-500">
                                      Supports PNG, JPG, WEBP
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 text-slate-600 border border-slate-200 dark:border-zinc-700 group-hover:bg-[var(--accent-primary)]/10 group-hover:text-[var(--accent-primary)] transition-colors font-mono">
                                  {2 - uploadedImages.length} slot{2 - uploadedImages.length === 1 ? "" : "s"} left
                                </span>
                              </button>
                            ) : (
                              <div className="w-full h-9 px-3 rounded-xl bg-slate-100 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 text-xs font-medium flex items-center justify-center border border-slate-200 dark:border-zinc-700">
                                Maximum 2 images reached
                              </div>
                            )}
                          </div>
                        )}

                        {mediaTab === "links" && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="url"
                              placeholder={
                                webLinks.length >= 1
                                  ? "Maximum 1 reference link reached"
                                  : "Paste URL (e.g. drive.google.com, figma...)"
                              }
                              disabled={webLinks.length >= 1}
                              value={linkInput}
                              onChange={(e) => setLinkInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddWebLink(e);
                                }
                              }}
                              className="flex-1 h-9 px-3.5 rounded-xl border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 outline-none disabled:opacity-50 transition-all shadow-2xs"
                            />
                            <button
                              type="button"
                              onClick={handleAddWebLink}
                              disabled={webLinks.length >= 1 || !linkInput.trim()}
                              className="h-9 px-4 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add</span>
                            </button>
                          </div>
                        )}

                        {totalAttachments > 0 ? (
                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                            {uploadedImages.map((img) => (
                              <div
                                key={img.id}
                                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900 text-xs shadow-2xs group"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <img
                                    src={img.url}
                                    alt={img.name}
                                    className="w-7 h-7 rounded-lg object-cover border border-slate-200 dark:border-zinc-800 shrink-0"
                                  />
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] dark:bg-[var(--accent-primary)]/25 dark:text-emerald-300 border border-[var(--accent-primary)]/20 shrink-0 font-mono">
                                    IMG
                                  </span>
                                  <span className="truncate font-medium text-slate-800 dark:text-zinc-200 text-xs" title={img.name}>
                                    {img.name}
                                  </span>
                                  {img.size && (
                                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                      ({img.size})
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImage(img.id)}
                                  title="Remove image"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}

                            {webLinks.map((url, idx) => (
                              <div
                                key={`link-${idx}`}
                                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900 text-xs shadow-2xs group"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[var(--accent-primary)] dark:text-emerald-400 border border-[var(--accent-primary)]/25 shrink-0 font-mono">
                                    URL
                                  </span>
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="truncate text-[var(--accent-primary)] hover:underline flex items-center gap-1 text-xs font-medium"
                                    title={url}
                                  >
                                    <span className="truncate">{url}</span>
                                    <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                                  </a>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveWebLink(idx)}
                                  title="Remove link"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="px-3 py-3 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 text-center">
                            <span className="text-xs text-slate-500">
                              No attachments yet (optional · up to 2 images and 1 link)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Action Bar */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200/60 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-4 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
                >
                  Discard
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                    Ready to submit to Sampling Desk
                  </span>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-9 px-5 rounded-xl text-white text-xs font-bold cursor-pointer transition-all shadow-2xs hover:shadow-md flex items-center gap-2 disabled:opacity-60 disabled:cursor-wait active:scale-98 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>{isSubmitting ? "Submitting..." : "Submit Feasibility Check"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
