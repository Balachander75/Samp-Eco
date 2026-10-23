import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  X,
  ArrowRight,
  Palette,
  Box,
  Sparkles,
  Calculator,
  Check,
  CheckCircle2,
  Calendar,
  Package,
  ClipboardCheck,
  Image as ImageIcon,
  Link2,
  ExternalLink,
  Plus,
  Trash2,
  FileText,
  Loader2,
  UploadCloud,
  Layers,
  BookOpen,
  Search,
  ChevronDown,
} from "lucide-react";
import { CustomerCombobox, OperationalDatePicker } from "@/components/erp";
import { Select } from "@/components/ui";
import { formatYMD, isDateRestricted } from "@/lib/holidayUtils";
import { getBusinessYearInfo } from "@/lib/businessYear";
import { compressReferenceImage } from "@/lib/referenceImage";
import { SampleRequestItem } from "../types";
import { useMasterData } from "../hooks/useMasterData";
import { fetchProgramRequestsApi } from "@/infrastructure/api/programsApi";

export interface NewSampleRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newRequest: Partial<SampleRequestItem>) => Promise<boolean | SampleRequestItem>;
  initialTrack?: TrackType;
  lockTrack?: boolean;
  requestCreatedBy?: string;
}

type TrackType = "marketing_request" | "feasibility_check" | "program_planning";

interface ProgramPickerProps {
  programs: SampleRequestItem[];
  value: string;
  onChange: (value: string) => void;
  onYearChange: (value: string) => void;
}

const ProgramPicker: React.FC<ProgramPickerProps> = ({ programs, value, onChange, onYearChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  const filteredPrograms = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return programs;
    return programs.filter((program) =>
      `${program.programName || program.programCampaignTitle || ""} ${program.programYear || ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [programs, query]);

  useEffect(() => setActiveIndex(0), [query]);

  useEffect(() => {
    const onOutsidePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !optionsRef.current?.contains(target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", onOutsidePointer);
    return () => document.removeEventListener("mousedown", onOutsidePointer);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }
    const updatePosition = () => {
      const input = inputRef.current;
      if (!input) return;
      const rect = input.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const opensAbove = spaceBelow < 200 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(160, Math.min(260, opensAbove ? spaceAbove : spaceBelow));
      const width = Math.max(rect.width, 280);
      setPosition({
        top: opensAbove ? rect.top - maxHeight - 4 : rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        width,
        maxHeight,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, filteredPrograms.length]);

  const openPicker = () => {
    setQuery(value);
    setIsOpen(true);
  };

  const selectProgram = (program: SampleRequestItem) => {
    const title = (program.programName || program.programCampaignTitle || "").trim();
    onChange(title);
    if (program.programYear) onYearChange(String(program.programYear));
    setQuery(title);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <input
          ref={inputRef}
          type="text"
          required
          role="combobox"
          aria-label="Program name"
          aria-expanded={isOpen}
          aria-controls="marketing-program-options"
          aria-autocomplete="list"
          placeholder="Select or enter a program..."
          value={isOpen ? query : value}
          onClick={openPicker}
          onFocus={openPicker}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange(event.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((index) => Math.min(index + 1, Math.max(filteredPrograms.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Escape") {
              setIsOpen(false);
            } else if (event.key === "Enter" && isOpen && filteredPrograms[activeIndex]) {
              event.preventDefault();
              selectProgram(filteredPrograms[activeIndex]);
            }
          }}
          className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] pl-8 pr-9 text-xs font-semibold text-[var(--on-surface)] outline-none transition-colors placeholder:text-[var(--on-surface-subtle)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Show matching programs"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (isOpen) setIsOpen(false);
            else {
              openPicker();
              inputRef.current?.focus();
            }
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer p-1 text-[var(--on-surface-subtle)] transition-colors hover:text-[var(--on-surface)]"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${isOpen ? "rotate-180 text-[var(--accent-primary)]" : ""}`} />
        </button>
      </div>

      {isOpen && position && createPortal(
        <div
          ref={optionsRef}
          id="marketing-program-options"
          role="listbox"
          style={{ position: "fixed", top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }}
          className="z-[99999] overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.25)]"
        >
          {filteredPrograms.length ? filteredPrograms.map((program, index) => {
            const title = program.programName || program.programCampaignTitle || "Untitled program";
            const isSelected = title.trim().toLowerCase() === value.trim().toLowerCase();
            return (
              <button
                key={program.id || `${title}-${program.programYear}-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex || isSelected}
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => selectProgram(program)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer ${
                  index === activeIndex || isSelected
                    ? "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] font-semibold"
                    : "text-[var(--on-surface)] hover:bg-[var(--surface-low)]"
                }`}
              >
                <span className="min-w-0 truncate text-xs font-semibold">{title}</span>
                <span className="shrink-0 text-[10px] font-mono text-[var(--on-surface-subtle)]">Season {program.programYear || "2026"}</span>
              </button>
            );
          }) : (
            <div className="px-2.5 py-3 text-center text-[11px] text-[var(--on-surface-subtle)]">
              {query.trim() ? "No matching program. You can keep the name you entered." : "Select a customer to see its programs."}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
};

export interface MarketingDeliverableType {
  id: "design" | "mockup" | "sample" | "costing";
  code: string;
  label: string;
  department: string;
  tag: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: {
    borderActive: string;
    bgActive: string;
    badge: string;
    text: string;
    ring: string;
  };
}

export const MARKETING_REQUEST_TYPES: MarketingDeliverableType[] = [
  {
    id: "design",
    code: "01",
    label: "Design",
    department: "Creative Studio",
    tag: "Artwork & Styling",
    desc: "Cover artwork, graphic themes, illustrations, typography & creative brief",
    icon: Palette,
    tone: {
      borderActive: "border-brand-600 ",
      bgActive: "bg-brand-50/50 ",
      badge: "bg-brand-50 text-brand-800 border-brand-200   ",
      text: "text-brand-600 ",
      ring: "ring-brand-500/20",
    },
  },
  {
    id: "mockup",
    code: "02",
    label: "Mockup",
    department: "Studio CAD",
    tag: "CAD Dummy & Die-line",
    desc: "CAD structural white dummy, die-line verification, folding format & digital 3D proof",
    icon: Box,
    tone: {
      borderActive: "border-brand-600 ",
      bgActive: "bg-brand-50/50 ",
      badge: "bg-brand-50 text-brand-800 border-brand-200   ",
      text: "text-brand-600 ",
      ring: "ring-brand-500/20",
    },
  },
  {
    id: "sample",
    code: "03",
    label: "Sampling",
    department: "Sampling Team",
    tag: "Physical Finished Prototype",
    desc: "Finished physical prototype with actual binding, ruling, paper stock & cover finishes",
    icon: Sparkles,
    tone: {
      borderActive: "border-brand-600 ",
      bgActive: "bg-brand-50/50 ",
      badge: "bg-brand-50 text-brand-800 border-brand-200   ",
      text: "text-brand-600 ",
      ring: "ring-brand-500/20",
    },
  },
  {
    id: "costing",
    code: "04",
    label: "Costing",
    department: "Commercial PMT",
    tag: "BOM & Volume Pricing",
    desc: "Comprehensive Bill of Materials costing, machine run-rates & volume tiered pricing",
    icon: Calculator,
    tone: {
      borderActive: "border-brand-600 ",
      bgActive: "bg-brand-50/50 ",
      badge: "bg-brand-50 text-brand-800 border-brand-200   ",
      text: "text-brand-600 ",
      ring: "ring-brand-500/20",
    },
  },
];

const FEASIBILITY_TYPES = [
  {
    id: "new_category",
    label: "New Category",
    desc: "Introduce new product lines or unlisted classifications",
    icon: Layers,
  },
  {
    id: "new_format",
    label: "New Format",
    desc: "Custom sizes, unique binding structures, or novel layouts",
    icon: BookOpen,
  },
  {
    id: "new_finish",
    label: "New Finish",
    desc: "Special cover treatments, foil, embossing, or lamination effects",
    icon: Sparkles,
  },
  {
    id: "new_accessories",
    label: "New Accessories",
    desc: "Custom ribbons, elastic bands, pockets, stickers, or clasps",
    icon: Package,
  },
  {
    id: "other",
    label: "Other Custom",
    desc: "Specific bespoke requirement or custom manufacturing check",
    icon: FileText,
  },
];

export const NewSampleRequestModal: React.FC<NewSampleRequestModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialTrack,
  lockTrack = false,
  requestCreatedBy,
}) => {
  const navigate = useNavigate();
  const requestCodeYear = String(getBusinessYearInfo().startYear).slice(-2);

  const resolveTrack = (track?: TrackType): "marketing_request" | "feasibility_check" | "program_planning" => {
    if (track === "marketing_request" || track === "feasibility_check" || track === "program_planning") {
      return track;
    }
    return "feasibility_check";
  };

  const [selectedTrack, setSelectedTrack] = useState<"marketing_request" | "feasibility_check" | "program_planning">(() => resolveTrack(initialTrack));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressingImages, setIsCompressingImages] = useState(false);
  const {
    customers,
    plants,
    isLoading: isMasterDataLoading,
    error: masterDataError,
  } = useMasterData(isOpen);
  const marketingIntakePlant = plants.find((plant) => String(plant.code) === "1505")?.name || "Navneet - Khaniwade";

  // Common fields
  const [customer, setCustomer] = useState("");
  const [targetPlant, setTargetPlant] = useState("");

  // Dynamic Business Year Information (Oct–Sep cycle)
  const byInfo = useMemo(() => getBusinessYearInfo(), [isOpen]);

  // Track 1: Marketing Request Intake fields
  const [marketingCustomer, setMarketingCustomer] = useState("");
  const [marketingProgramName, setMarketingProgramName] = useState("");
  const [marketingProgramYear, setMarketingProgramYear] = useState(() => getBusinessYearInfo().seasonYearOptions[0]);
  const [marketingTargetPlant, setMarketingTargetPlant] = useState("");

  // Track 2: Feasibility Check fields
  const [selectedFeasibilityType, setSelectedFeasibilityType] = useState<string>("new_category");
  const [customTypeOther, setCustomTypeOther] = useState("");
  const [feasibilityDescription, setFeasibilityDescription] = useState("");
  const [releaseRemarks, setReleaseRemarks] = useState("");
  const [feasibilityTargetDate, setFeasibilityTargetDate] = useState("");

  // Multi-Image & Multi-Link State (combined max 5 items total)
  const [uploadedImages, setUploadedImages] = useState<Array<{ id: string; url: string; name: string; size?: string }>>([]);
  const [webLinks, setWebLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState<string>("");
  const [mediaTab, setMediaTab] = useState<"files" | "links">("files");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalAttachments = uploadedImages.length + webLinks.length;

  // Track 3: Program Planning fields (Setup step 1 parameters)
  const [programPlanName, setProgramPlanName] = useState("");
  const [programPlanYear, setProgramPlanYear] = useState(() => getBusinessYearInfo().businessYearStr);

  // Open Seasonal Programs for selected Customer (Walmart, etc.)
  const [availablePrograms, setAvailablePrograms] = useState<SampleRequestItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchProgramRequestsApi()
        .then((items) => setAvailablePrograms(items || []))
        .catch((err) => console.error("Could not fetch seasonal programs for picker:", err));
      // Preload ProductStagingWorkspace module in the background for zero-delay transition
      import("@/features/sample-requests/components/ProductStagingWorkspace").catch(() => {});
    }
  }, [isOpen]);

  const matchingPrograms = useMemo(() => {
    if (!marketingCustomer.trim()) return [];
    const custClean = marketingCustomer.trim().toLowerCase();
    return availablePrograms.filter((p) => {
      const pCust = (p.customer || "").trim().toLowerCase();
      return pCust === custClean || pCust.includes(custClean) || custClean.includes(pCust);
    });
  }, [marketingCustomer, availablePrograms]);

  // Reset all fields whenever modal opens so every new request starts completely fresh and empty
  useEffect(() => {
    if (isOpen) {
      setSelectedTrack(resolveTrack(initialTrack));
      setError(null);
      setMarketingCustomer("");
      setMarketingProgramName("");
      setMarketingProgramYear(byInfo.seasonYearOptions[0]);
      setMarketingTargetPlant(marketingIntakePlant);
      setCustomer("");
      setTargetPlant("");
      setProgramPlanName("");
      setProgramPlanYear(byInfo.businessYearStr);
      setFeasibilityDescription("");
      setFeasibilityTargetDate("");
      setReleaseRemarks("");
      setUploadedImages([]);
      setWebLinks([]);
      setLinkInput("");
    }
  }, [isOpen, initialTrack, byInfo, plants]);

  // Default plant selection once plants master data loads (if not already set)
  useEffect(() => {
    if (!isOpen || !plants.length) return;
    const firstPlant = plants.find((plant) => String(plant.code) === "1505")?.name || "Navneet - Khaniwade";
    setTargetPlant((current) => current || firstPlant);
    setMarketingTargetPlant((current) => current || firstPlant);
  }, [isOpen, plants]);

  useEffect(() => {
    if (isOpen && masterDataError) setError(masterDataError);
  }, [isOpen, masterDataError]);

  // Allow up to 2 compressed images and 1 web link per feasibility request.
  const handleMultipleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remainingSlots = 2 - uploadedImages.length;
    if (remainingSlots <= 0) {
      setError("Maximum 2 images are allowed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const filesToProcess = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setError(`Only ${remainingSlots} more image slot(s) available. Added ${remainingSlots} image(s).`);
    } else {
      setError(null);
    }

    setIsCompressingImages(true);
    try {
      for (const file of filesToProcess) {
        try {
          if (!file.type.startsWith("image/")) {
            setError("Only image files are supported.");
            continue;
          }
          const { url, sizeKb } = await compressReferenceImage(file);
          setUploadedImages((prev) => prev.length >= 2 ? prev : [
            ...prev,
            {
              id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              url,
              name: file.name,
              size: `${sizeKb} KB`,
            },
          ]);
        } catch (uploadError: any) {
          setError(uploadError?.message || `${file.name} could not be compressed.`);
        }
      }
    } finally {
      setIsCompressingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = (id: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id));
  };

  // Allow one reference link in addition to the two image attachments.
  const handleAddWebLink = (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    const trimmed = linkInput.trim();
    if (!trimmed) return;
    if (webLinks.length >= 1) {
      setError("Maximum 1 reference link is allowed.");
      return;
    }
    const formatted = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (webLinks.includes(formatted)) {
      setError("This web link has already been added.");
      return;
    }
    setWebLinks((prev) => [...prev, formatted]);
    setLinkInput("");
    setError(null);
  };

  const handleRemoveWebLink = (idx: number) => {
    setWebLinks((prev) => prev.filter((_, i) => i !== idx));
  };

  const effectiveTypeLabel = useMemo(() => {
    if (selectedFeasibilityType === "other") {
      return customTypeOther.trim() || "Bespoke / Custom";
    }
    const found = FEASIBILITY_TYPES.find((t) => t.id === selectedFeasibilityType);
    return found ? found.label : "Feasibility Check";
  }, [selectedFeasibilityType, customTypeOther]);

  if (!isOpen) return null;


  // Transition to product staging workspace with the program header parameters (without pre-creating empty sample request)
  const handleSubmitSampling = (e: React.FormEvent) => {
    e.preventDefault();
    if (!marketingCustomer.trim()) {
      setError("Please select a customer account.");
      return;
    }
    if (!marketingProgramName.trim()) {
      setError("Please enter a program name.");
      return;
    }

    const stagingContext = {
      customer: marketingCustomer.trim(),
      programName: marketingProgramName.trim(),
      programYear: marketingProgramYear,
      year: byInfo.businessYearStr,
      targetPlant: marketingTargetPlant || undefined,
    };

    sessionStorage.setItem("samp_active_program_form", JSON.stringify(stagingContext));
    sessionStorage.removeItem("samp_active_staged_products");

    navigate("/sample-requests/product-staging", { state: stagingContext });
    onClose();
  };

  // Submit Handler: Track 2 (Feasibility Check)
  const handleSubmitFeasibility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (isCompressingImages) {
      setError("Wait for the reference images to finish processing before submitting.");
      return;
    }
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
      setError("The selected required date falls on a factory holiday (Sundays and even Saturdays are plant off days). Please select an active working day.");
      return;
    }

    const sections: string[] = [
      feasibilityDescription.trim(),
    ];

    if (releaseRemarks.trim()) {
      sections.push(`Marketing Remarks:\n${releaseRemarks.trim()}`);
    }

    if (webLinks.length > 0) {
      sections.push(
        `Reference Web Links (${webLinks.length}):\n` +
        webLinks.map((l, i) => `${i + 1}. ${l}`).join("\n")
      );
    }

    if (uploadedImages.length > 0) {
      sections.push(
        `Attached Images (${uploadedImages.length}):\n` +
        uploadedImages.map((img, i) => `${i + 1}. ${img.name}`).join("\n")
      );
    }

    const payload: Partial<SampleRequestItem> = {
      customer,
      productDescription: feasibilityDescription.trim().slice(0, 75),
      descriptionNotes: feasibilityDescription.trim().slice(0, 75),
      programName: `${customer} · ${effectiveTypeLabel}`,
      programYear: byInfo.businessYearStr,
      year: byInfo.businessYearStr,
      sampleRequiredDate: feasibilityTargetDate || undefined,
      qtyForSampling: 1,
      qtyDesignCosting: 0,
      requestTypes: [] as any,
      status: "Pending Feasibility",
      samplingFeasibilityResponse: null,
      samplingFeasibilityRemark: null,
      feasibilityClosedBy: null,
      feasibilityClosedAt: null,
      createdBy: requestCreatedBy || "Marketing Team (Corporate)",
      dateRequestCreated: new Date().toISOString().split("T")[0],
      creationMode: "feasibility_check",
      productImagePath: uploadedImages[0]?.url || (webLinks[0]?.startsWith("http") ? webLinks[0] : undefined),
      referenceImages: uploadedImages.map((img) => img.url),
      referenceImageNames: uploadedImages.map((img) => img.name),
      referenceLinks: webLinks,
      feasibilityType: selectedFeasibilityType,
      customFeasibilityType: selectedFeasibilityType === "other" ? customTypeOther.trim().slice(0, 25) : null,
      feasibilityDescription: feasibilityDescription.trim().slice(0, 75),
      marketingRemarks: releaseRemarks.trim() ? releaseRemarks.trim().slice(0, 100) : null,
    };

    setIsSubmitting(true);
    try {
      const saved = await onSubmit(payload);
      if (saved) onClose();
      else setError("The feasibility request could not be saved. Please check the details and try again.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The feasibility request could not be saved.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Proceed Handler: Track 3 -> Navigate to Dedicated Planning Page
  const handleProceedToPlanning = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer.trim()) {
      setError("Please select a customer account.");
      return;
    }
    if (!targetPlant.trim()) {
      setError("Please select a target plant.");
      return;
    }
    if (!programPlanName.trim()) {
      setError("Please provide a program campaign title.");
      return;
    }
    if (!programPlanYear.trim()) {
      setError("Please specify the program year.");
      return;
    }
    setError(null);
    onClose();
    navigate("/sample-requests/program-planning", {
      state: {
        customer,
        targetPlant,
        programPlanName,
        programPlanYear,
      },
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[var(--overlay-backdrop)] backdrop-blur-xs animate-smooth-backdrop transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="flex min-h-full items-center justify-center p-3 sm:p-5">
        <div className={`relative w-full ${selectedTrack === "feasibility_check" ? "max-w-4xl" : "max-w-3xl"} bg-[var(--surface-lowest)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl select-text overflow-hidden transition-all duration-200 animate-smooth-modal`}>
          
          {/* Luminous Engine Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 bg-[var(--surface-lowest)] shrink-0 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[var(--on-surface)] tracking-tight font-display">
                    {selectedTrack === "feasibility_check" && "Technical Feasibility Check"}
                    {selectedTrack === "marketing_request" && "Commercial Sample Request"}
                    {selectedTrack === "program_planning" && "Seasonal Program Planning"}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/20 tracking-wider uppercase">
                    {selectedTrack === "feasibility_check" ? `FC-${requestCodeYear}-001` : selectedTrack === "program_planning" ? `PP-${requestCodeYear}-001` : `SR-${requestCodeYear}-001`}
                  </span>
                </div>
                <p className="text-xs text-[var(--on-surface-muted)] mt-0.5 font-normal">
                  {selectedTrack === "feasibility_check" &&
                    "Sampling feasibility assessment, paper GSM & prototype specification evaluation"}
                  {selectedTrack === "marketing_request" &&
                    "Create a sampling request, then add products and specifications"}
                  {selectedTrack === "program_planning" &&
                    "Define customer account, target plant, campaign title, and seasonal pipeline"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)] transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Track Switcher Tabs (Only shown when not locked to a specific track) */}
          {!lockTrack && (
            <div className="flex items-center gap-1 px-6 bg-[var(--surface-low)] border-b border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => {
                  setSelectedTrack("feasibility_check");
                  setError(null);
                }}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer select-none ${
                  selectedTrack === "feasibility_check"
                    ? "border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--surface-lowest)] font-bold shadow-2xs"
                    : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-black/[0.02]"
                }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Feasibility Check</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedTrack("marketing_request");
                  setError(null);
                }}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer select-none ${
                  selectedTrack === "marketing_request"
                    ? "border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--surface-lowest)] font-bold shadow-2xs"
                    : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-black/[0.02]"
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Standard Sampling</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedTrack("program_planning");
                  setError(null);
                }}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer select-none ${
                  selectedTrack === "program_planning"
                    ? "border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--surface-lowest)] font-bold shadow-2xs"
                    : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-black/[0.02]"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Program Planning</span>
              </button>
            </div>
          )}

          {/* Modal Body: Single Page Document Sheet */}
          <div className="p-5 sm:p-6 max-h-[78vh] overflow-y-auto">
            {error && (
              <div className="mb-4 px-3.5 py-2.5 rounded border border-rose-200  bg-rose-50  text-rose-700  text-xs font-medium">
                {error}
              </div>
            )}

            {/* TAB 1: FEASIBILITY CHECK FORM */}
            {selectedTrack === "feasibility_check" && (
              <form onSubmit={handleSubmitFeasibility} className="space-y-4">
                <div className="bg-[var(--surface-lowest)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-4">
                  {/* Two-Column Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    {/* Left Column (7 cols) */}
                    <div className="lg:col-span-7 space-y-3.5">
                      {/* Customer Account */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--on-surface-muted)] mb-1.5 font-sans">
                          Customer Account <span className="text-rose-500">*</span>
                        </label>
                        <CustomerCombobox
                          customers={customers}
                          value={customer}
                          onChange={setCustomer}
                          className="w-full"
                        />
                      </div>

                      {/* Feasibility Type Selection Cards */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--on-surface-muted)] mb-1.5 font-sans">
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
                                  className="sm:col-span-2 flex min-h-12 items-center justify-between rounded-xl border border-[var(--accent-primary)] bg-[var(--accent-primary-subtle)] px-3 ring-2 ring-[var(--accent-primary)]/20 shadow-2xs"
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
                                    className="w-full bg-transparent text-xs font-medium text-[var(--on-surface)] outline-none placeholder:text-[var(--on-surface-subtle)]"
                                  />
                                  <span className={`text-[10px] font-mono shrink-0 ml-2 ${customTypeOther.length >= 25 ? "text-amber-500 font-bold" : "text-[var(--on-surface-subtle)]"}`}>
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
                                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary-subtle)] ring-2 ring-[var(--accent-primary)]/20 shadow-2xs"
                                    : "border-[var(--border-subtle)] bg-[var(--surface-low)] hover:bg-[var(--surface-lowest)] text-[var(--on-surface)]"
                                }`}
                              >
                                <div className="flex min-w-0 items-center justify-between w-full gap-3">
                                  <span
                                    className={`text-xs tracking-tight ${
                                      isSelected
                                        ? "text-[var(--accent-primary)] font-bold"
                                        : "font-semibold text-[var(--on-surface)]"
                                    }`}
                                  >
                                    {type.label}
                                  </span>
                                  <span
                                    className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                      isSelected
                                        ? "bg-[var(--accent-primary)] text-white"
                                        : "border border-[var(--border-strong)]"
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
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--on-surface-muted)] font-sans">
                            Technical Description &amp; Specifications <span className="text-rose-500">*</span>
                          </label>
                          <span className={`text-[10px] font-mono ${feasibilityDescription.length >= 75 ? "text-amber-500 font-bold" : "text-[var(--on-surface-subtle)]"}`}>
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
                          className="w-full p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 outline-none transition-all resize-none leading-relaxed shadow-2xs"
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
                          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--on-surface-muted)] font-sans">
                            Marketing Remarks / Notes
                          </label>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-[var(--on-surface-subtle)] font-medium">Optional</span>
                            <span className="text-[var(--border-strong)]">·</span>
                            <span className={`text-[10px] font-mono ${releaseRemarks.length >= 100 ? "text-amber-500 font-bold" : "text-[var(--on-surface-subtle)]"}`}>
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
                          className="w-full p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 outline-none transition-all resize-none leading-relaxed shadow-2xs"
                        />
                      </div>

                      {/* Attachments Section */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--on-surface-muted)] font-sans">
                            Reference Attachments
                          </label>
                          <span
                            className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full transition-colors font-mono ${
                              uploadedImages.length >= 2 && webLinks.length >= 1
                                ? "bg-amber-100 text-amber-800   border border-amber-300/40"
                                : totalAttachments > 0
                                ? "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/20"
                                : "bg-[var(--surface-low)] text-[var(--on-surface-subtle)]"
                            }`}
                          >
                            {uploadedImages.length}/2 images · {webLinks.length}/1 link
                          </span>
                        </div>

                        <div className="space-y-2.5">
                          <div className="inline-flex w-full rounded-xl bg-[var(--surface-low)] p-1 text-[11px] border border-[var(--border-subtle)]">
                            <button
                              type="button"
                              onClick={() => setMediaTab("files")}
                              className={`flex-1 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                mediaTab === "files"
                                  ? "bg-[var(--surface-lowest)] text-[var(--accent-primary)] shadow-xs font-bold"
                                  : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] font-medium"
                              }`}
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>Image Upload</span>
                              {uploadedImages.length > 0 && (
                                <span className="ml-1 text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)]">
                                  {uploadedImages.length}
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setMediaTab("links")}
                              className={`flex-1 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                mediaTab === "links"
                                  ? "bg-[var(--surface-lowest)] text-[var(--accent-primary)] shadow-xs font-bold"
                                  : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] font-medium"
                              }`}
                            >
                              <Link2 className="w-3.5 h-3.5" />
                              <span>Web URL Link</span>
                              {webLinks.length > 0 && (
                                <span className="ml-1 text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)]">
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
                                disabled={isCompressingImages}
                                onChange={handleMultipleImageUpload}
                                className="hidden"
                              />
                              {uploadedImages.length < 2 ? (
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="w-full py-3 px-3.5 rounded-xl border-2 border-dashed border-[var(--border-subtle)] hover:border-[var(--accent-primary)] bg-[var(--surface-low)] hover:bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] hover:text-[var(--accent-primary)] flex items-center justify-between text-xs font-medium transition-all cursor-pointer group shadow-2xs"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-[var(--surface-lowest)] group-hover:bg-[var(--accent-primary-subtle)] text-[var(--on-surface-subtle)] group-hover:text-[var(--accent-primary)] flex items-center justify-center transition-colors border border-[var(--border-subtle)] group-hover:border-[var(--accent-primary)]/30">
                                      <UploadCloud className="w-4 h-4" />
                                    </div>
                                    <div className="text-left">
                                      <span className="block font-semibold text-[var(--on-surface)] group-hover:text-[var(--accent-primary)] transition-colors">
                                        Choose photos to upload
                                      </span>
                                      <span className="block text-[10px] text-[var(--on-surface-subtle)]">
                                        Supports PNG, JPG, WEBP
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)] group-hover:bg-[var(--accent-primary-subtle)] group-hover:text-[var(--accent-primary)] transition-colors font-mono">
                                    {2 - uploadedImages.length} slot{2 - uploadedImages.length === 1 ? "" : "s"} left
                                  </span>
                                </button>
                              ) : (
                                <div className="w-full h-9 px-3 rounded-xl bg-[var(--surface-low)] text-[var(--on-surface-muted)] text-xs font-medium flex items-center justify-center border border-[var(--border-subtle)]">
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
                                className="flex-1 h-9 px-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 outline-none disabled:opacity-50 transition-all shadow-2xs"
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
                                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] text-xs shadow-2xs group"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <img
                                      src={img.url}
                                      alt={img.name}
                                      className="w-7 h-7 rounded-lg object-cover border border-[var(--border-subtle)] shrink-0"
                                    />
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/20 shrink-0 font-mono">
                                      IMG
                                    </span>
                                    <span className="truncate font-medium text-[var(--on-surface)] text-xs" title={img.name}>
                                      {img.name}
                                    </span>
                                    {img.size && (
                                      <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono shrink-0">
                                        ({img.size})
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveImage(img.id)}
                                    title="Remove image"
                                    className="p-1.5 rounded-lg text-[var(--on-surface-subtle)] hover:text-rose-600 hover:bg-rose-50  transition-colors shrink-0 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}

                              {webLinks.map((url, idx) => (
                                <div
                                  key={`link-${idx}`}
                                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] text-xs shadow-2xs group"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/25 shrink-0 font-mono">
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
                                    className="p-1.5 rounded-lg text-[var(--on-surface-subtle)] hover:text-rose-600 hover:bg-rose-50  transition-colors shrink-0 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="px-3 py-3 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-low)]/50 text-center">
                              <span className="text-xs text-[var(--on-surface-subtle)]">
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
                <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-9 px-4 rounded-xl bg-[var(--surface-low)] hover:bg-[var(--surface-lowest)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] transition-colors cursor-pointer shadow-2xs"
                  >
                    Discard
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[var(--on-surface-subtle)] font-mono hidden sm:inline">
                      Ready to submit to Sampling Desk
                    </span>
                    <button
                      type="submit"
                      disabled={isSubmitting || isCompressingImages}
                      className="h-9 px-5 rounded-xl text-white text-xs font-bold cursor-pointer transition-all shadow-2xs hover:shadow-md flex items-center gap-2 disabled:opacity-60 disabled:cursor-wait active:scale-98 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
                    >
                      {isSubmitting || isCompressingImages ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>{isCompressingImages ? "Processing images..." : isSubmitting ? "Submitting..." : "Submit Feasibility Check"}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* TAB 2: STANDARD SAMPLING FORM (Commercial Sample Request Step 1 Intake) */}
            {selectedTrack === "marketing_request" && (
              <form onSubmit={handleSubmitSampling} className="space-y-4">
                {/* Form Sheet Content */}
                <div className="bg-[var(--surface-lowest)] border border-[var(--border-subtle)] rounded-2xl p-6 space-y-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
                  {/* Row 1: Customer Account & Program Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--on-surface-muted)] mb-1.5 font-sans">
                        Customer Account <span className="text-rose-500">*</span>
                      </label>
                      <CustomerCombobox
                        customers={customers}
                        value={marketingCustomer}
                        onChange={setMarketingCustomer}
                        placeholder="Select or enter customer account..."
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--on-surface-muted)] font-sans">
                          Program Name <span className="text-rose-500">*</span>
                        </label>
                        {matchingPrograms.length > 0 && (
                          <span className="text-[10.5px] font-mono text-[var(--accent-primary)] font-bold">
                            {matchingPrograms.length} open program{matchingPrograms.length !== 1 ? "s" : ""} found
                          </span>
                        )}
                      </div>
                      <ProgramPicker
                        programs={matchingPrograms}
                        value={marketingProgramName}
                        onChange={setMarketingProgramName}
                        onYearChange={setMarketingProgramYear}
                      />
                      {marketingCustomer.trim() && matchingPrograms.length === 0 && (
                        <p className="mt-1.5 text-[10.5px] text-[var(--on-surface-subtle)]">
                          No saved programs for this customer. You can enter a program name.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Program Year */}
                  <div className="pt-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--on-surface-muted)] mb-2 font-sans">
                      Program Year <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {byInfo.seasonYearOptions.map((year) => {
                        const isSelected = marketingProgramYear === year;
                        return (
                          <button
                            key={year}
                            type="button"
                            onClick={() => setMarketingProgramYear(year)}
                            className={`h-11 px-4 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center cursor-pointer select-none ${
                              isSelected
                                ? "border-[var(--accent-primary)] bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] font-bold ring-2 ring-[var(--accent-primary)]/20 shadow-xs"
                                : "border-[var(--border-subtle)] bg-[var(--surface-low)] text-[var(--on-surface-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-lowest)]"
                            }`}
                          >
                            <span className="font-mono text-xs tracking-wide">{year}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-10 px-5 rounded-xl bg-[var(--surface-low)] hover:bg-[var(--surface-lowest)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] transition-colors cursor-pointer"
                  >
                    Discard
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={isSubmitting || isCompressingImages || !marketingCustomer.trim() || !marketingProgramName.trim()}
                      className="h-10 px-6 rounded-xl text-white text-xs font-bold cursor-pointer transition-all shadow-2xs hover:shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-98 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Opening Product Staging...</span>
                        </>
                      ) : (
                        <>
                          <span>Create &amp; Add Product</span>
                          <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* TAB 3: PROGRAM PLANNING FORM (Single-Page Setup) */}
            {selectedTrack === "program_planning" && (
              <form onSubmit={handleProceedToPlanning} className="space-y-4">
                <div className="bg-[var(--surface-lowest)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] space-y-5">
                  {/* Sheet Header Row */}
                  <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[var(--border-subtle)] gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[var(--on-surface)] font-display">
                          Seasonal Program Planning Setup
                        </h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/20 font-bold uppercase tracking-wider">
                          CAMPAIGN SETUP
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--on-surface-muted)] mt-0.5">
                        Initialize high-volume seasonal line, define target facility, and setup planning workspace.
                      </p>
                    </div>

                    <div className="hidden sm:flex items-center gap-2 bg-[var(--surface-low)] border border-[var(--border-subtle)] px-3 py-1 rounded-xl">
                      <span className="text-[10px] font-bold text-[var(--on-surface-subtle)] uppercase tracking-wider">PLANNING CYCLE</span>
                      <span className="text-xs font-mono font-bold text-[var(--accent-primary)]">{byInfo.businessYearStr}</span>
                    </div>
                  </div>

                  {/* Customer Account & Target Plant */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--on-surface-muted)] mb-1.5 font-sans">
                        Customer Name <span className="text-rose-500">*</span>
                      </label>
                      <CustomerCombobox
                        customers={customers}
                        value={customer}
                        onChange={setCustomer}
                        placeholder="Select or enter customer account..."
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--on-surface-muted)] mb-1.5 font-sans">
                        Target Plant <span className="text-rose-500">*</span>
                      </label>
                      <Select
                        value={targetPlant}
                        disabled={isMasterDataLoading || plants.length === 0}
                        onChange={(e) => setTargetPlant(e.target.value)}
                        className="w-full"
                        selectClassName="h-10 text-xs font-semibold"
                      >
                        {plants.map((item) => (
                          <option key={item.id} value={item.name}>{item.name}</option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  {/* Program Campaign Title */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--on-surface-muted)] mb-1.5 font-sans">
                      Program Campaign Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={programPlanName}
                      onChange={(e) => setProgramPlanName(e.target.value)}
                      placeholder="e.g. Back-to-School 2026-2027 Hardcover Line"
                      className="w-full h-10 px-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 transition-all shadow-2xs"
                    />
                  </div>

                  {/* Program Business Year */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--on-surface-muted)] mb-1.5 font-sans">
                      Program Business Year <span className="text-rose-500">*</span>
                    </label>
                    <Select
                      value={programPlanYear}
                      onChange={(e) => setProgramPlanYear(e.target.value)}
                      className="w-full"
                      selectClassName="h-10 text-xs font-mono font-medium"
                    >
                      {byInfo.businessYearOptions.map((by) => (
                        <option key={by} value={by}>{by}</option>
                      ))}
                    </Select>
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-10 px-5 rounded-xl bg-[var(--surface-low)] hover:bg-[var(--surface-lowest)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] transition-colors cursor-pointer"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    className="h-10 px-6 rounded-xl text-white text-xs font-bold cursor-pointer transition-all shadow-2xs hover:shadow-md inline-flex items-center justify-center gap-1.5 select-none active:scale-98 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
                  >
                    <span>Initialize Program Plan</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NewSampleRequestModal;
