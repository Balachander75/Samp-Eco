import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  LoaderCircle,
  Search,
  X,
  Printer,
} from "lucide-react";
import {
  fetchProductInspectionDetailsApi,
  ProductDetailItem,
  PRODUCT_CLASS_ORDER,
} from "@/infrastructure/api/masterApi";
import { ProductSearchResult } from "../../types";
import { downloadProductDocketPdf, printProductDocketView, productDocketSectionTitle } from "./productDocketPdf";
import { ProductDocketView } from "./ProductDocketView";
import { isListedCreativeCharacteristic, isMockupCreativeCharacteristic } from "./mockupCreativeFields";

interface CatalogProductInspectModalProps {
  product: ProductSearchResult | null;
  onClose: () => void;
  heading?: string;
  intro?: string;
  footer?: React.ReactNode;
  embedded?: boolean;
  highlightCreativeFields?: boolean;
  creativeCharacteristicKeys?: Array<{ className: string; characteristicName: string }>;
}

const EMPTY_VALUES = new Set(["", "NA", "N/A", "NAN", "NULL", "NONE", "—", "-"]);

function hasConfiguredValue(value: string | null | undefined): boolean {
  return !EMPTY_VALUES.has(String(value || "").trim().toUpperCase());
}

function displayClassName(value: string): string {
  return value.replace(/_/g, " ").trim();
}

export const CatalogProductInspectModal: React.FC<CatalogProductInspectModalProps> = ({ product, onClose, heading, intro, footer, embedded = false, highlightCreativeFields = false, creativeCharacteristicKeys = [] }) => {
  const [details, setDetails] = useState<ProductDetailItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [view, setView] = useState<"configured" | "all" | "docket">("configured");
  const [characteristicQuery, setCharacteristicQuery] = useState("");
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!product) return;
    let cancelled = false;
    setIsLoading(true);
    setDetails([]);
    setDetailsError("");
    setView("configured");
    setCharacteristicQuery("");
    setExpandedClasses(new Set());

    fetchProductInspectionDetailsApi(product.id, true)
      .then((loadedDetails) => {
        if (cancelled) return;
        setDetails(loadedDetails);
        setExpandedClasses(new Set());
      })
      .catch(() => {
        if (!cancelled) setDetailsError("Could not load this product's specifications. Close this view and try again.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product?.id]);

  useEffect(() => {
    if (!highlightCreativeFields || details.length === 0) return;
    const targetClasses = new Set(
      details
        .filter((detail) => isMockupCreativeCharacteristic(detail.className, detail.characteristicName) || isListedCreativeCharacteristic(detail, creativeCharacteristicKeys))
        .map((detail) => detail.className)
    );
    if (targetClasses.size) {
      setView("all");
      setExpandedClasses(targetClasses);
    }
  }, [details, highlightCreativeFields, creativeCharacteristicKeys]);

  useEffect(() => {
    if (!product) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [product, onClose]);

  const configuredCount = useMemo(
    () => details.filter((item) => hasConfiguredValue(item.value)).length,
    [details]
  );
  const classGroups = useMemo(() => {
    const groups = new Map<string, ProductDetailItem[]>();
    for (const item of details) {
      if (!item.className) continue;
      const group = groups.get(item.className) || [];
      group.push(item);
      groups.set(item.className, group);
    }
    const savedClasses = new Set(
      details.filter((item) => item.id >= 0).map((item) => item.className.toUpperCase())
    );
    const classesWithValues = new Set(
      details.filter((item) => hasConfiguredValue(item.value)).map((item) => item.className.toUpperCase())
    );
    const relevantClasses = savedClasses.size > 0 ? savedClasses : classesWithValues;
    return [...groups.entries()]
      .filter(([className]) => relevantClasses.has(className.toUpperCase()))
      .sort(([a], [b]) => {
        const aIndex = PRODUCT_CLASS_ORDER.indexOf(a as typeof PRODUCT_CLASS_ORDER[number]);
        const bIndex = PRODUCT_CLASS_ORDER.indexOf(b as typeof PRODUCT_CLASS_ORDER[number]);
        return (aIndex === -1 ? PRODUCT_CLASS_ORDER.length : aIndex) - (bIndex === -1 ? PRODUCT_CLASS_ORDER.length : bIndex)
          || a.localeCompare(b);
      });
  }, [details]);

  const availableSpecCount = useMemo(
    () => classGroups.reduce((count, [, specs]) => count + specs.length, 0),
    [classGroups]
  );

  const filteredClassGroups = useMemo(() => {
    const query = characteristicQuery.trim().toLocaleLowerCase();
    return classGroups
      .map(([className, specs]) => [
        className,
        specs.filter((item) => {
          if (view === "configured" && !hasConfiguredValue(item.value)) return false;
          if (!query) return true;
          return `${className} ${item.characteristicName} ${item.value || ""} ${item.uom || ""}`
            .toLocaleLowerCase()
            .includes(query);
        }),
      ] as [string, ProductDetailItem[]])
      .filter(([, specs]) => specs.length > 0);
  }, [characteristicQuery, classGroups, view]);

  if (!product) return null;

  const toggleClass = (className: string) => {
    setExpandedClasses((current) => {
      const next = new Set(current);
      if (next.has(className)) next.delete(className);
      else next.add(className);
      return next;
    });
  };

  return (
    <div
      className={embedded ? "w-full" : "fixed inset-0 z-[180] flex items-center justify-center bg-[var(--on-surface)]/45 p-2 backdrop-blur-[2px] sm:p-5"}
      onMouseDown={embedded ? undefined : (event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role={embedded ? "region" : "dialog"}
        aria-modal={embedded ? undefined : "true"}
        aria-labelledby="catalog-inspect-title"
        className={embedded
          ? "w-full overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface)]"
          : `flex h-[88vh] max-h-[94vh] w-full ${view === "docket" ? "max-w-[1140px]" : "max-w-[960px]"} flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface)] shadow-[0_24px_80px_rgba(2,6,23,0.2)] transition-[max-width] duration-200`}
      >
        <header className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-low)] px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {product.material_code && (
                  <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 font-mono text-xs font-bold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300">
                    {product.material_code}
                  </span>
                )}
                <h2 id="catalog-inspect-title" className="min-w-0 text-base font-bold text-[var(--on-surface)] sm:text-lg">
                  {product.product_description || "Product specification"}
                </h2>
              </div>
              {!embedded && <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-[var(--on-surface-muted)]">
                {product.customer && <span className="rounded-md bg-[var(--surface-lowest)] px-2 py-1"><span className="text-[var(--on-surface-subtle)]">Customer:</span> {product.customer}</span>}
                {product.target_plant && <span className="rounded-md bg-[var(--surface-lowest)] px-2 py-1"><span className="text-[var(--on-surface-subtle)]">Plant:</span> {product.target_plant}</span>}
                {product.sr_number && <span className="rounded-md bg-[var(--surface-lowest)] px-2 py-1 font-mono">{product.sr_number}</span>}
                {(product.product_category || product.product_sub_category || product.product_third_category) && (
                  <span className="rounded-md bg-[var(--surface-lowest)] px-2 py-1">
                    <span className="text-[var(--on-surface-subtle)]">Category:</span>{" "}
                    {[product.product_category, product.product_sub_category, product.product_third_category].filter(Boolean).join(" / ")}
                  </span>
                )}
              </div>}
            </div>
            {!embedded && <button
              type="button"
              onClick={onClose}
              aria-label="Close product inspection"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
            >
              <X className="h-4 w-4" />
            </button>}
          </div>
        </header>

        <div className={embedded ? "min-w-0" : "min-h-0 flex-1 overflow-y-auto lg:flex lg:flex-col lg:overflow-hidden"}>
          <main className={embedded ? "min-w-0" : "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden"}>
            <div className="space-y-2.5 border-b border-[var(--border-subtle)] p-3 sm:p-3.5 lg:shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">{heading || "Product specifications"}</h3>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">{view === "docket" ? "All characteristics in this product’s classes. — means no saved value; NA is shown as recorded." : intro || "Showing classes with saved values. Expand a class to view its specifications."}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {!isLoading && !detailsError && (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 dark:bg-zinc-900 dark:text-zinc-300">
                      {classGroups.length} classes · {configuredCount} saved
                    </span>
                  )}
                  <button type="button" disabled={isLoading || !!detailsError || classGroups.length === 0} onClick={() => downloadProductDocketPdf(product, classGroups)} className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800" title="Download Complete Technical Docket PDF">
                    <Download className="h-3.5 w-3.5" /> PDF
                  </button>
                  {view === "docket" && (
                    <button
                      type="button"
                      disabled={isLoading || !!detailsError || classGroups.length === 0}
                      onClick={() => printProductDocketView(product)}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 text-[10px] font-semibold text-sky-800 transition hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200 dark:hover:bg-sky-900/60 cursor-pointer"
                      title="Print or Save Complete Docket as PDF via Browser"
                    >
                      <Printer className="h-3.5 w-3.5" /> Print / Save PDF
                    </button>
                  )}
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-900" aria-label="Specification view">
                    <button type="button" onClick={() => { setView("configured"); setExpandedClasses(new Set()); }} aria-pressed={view === "configured"} className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition ${view === "configured" ? "bg-white text-[var(--accent-primary)] shadow-sm dark:bg-zinc-800 dark:text-emerald-300" : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"}`}>
                      Configured <span className="ml-1 opacity-70">{configuredCount}</span>
                    </button>
                    <button type="button" onClick={() => { setView("all"); setExpandedClasses(new Set()); }} aria-pressed={view === "all"} className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition ${view === "all" ? "bg-white text-[var(--accent-primary)] shadow-sm dark:bg-zinc-800 dark:text-emerald-300" : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"}`}>
                      All <span className="ml-1 opacity-70">{availableSpecCount}</span>
                    </button>
                    <button type="button" onClick={() => { setView("docket"); setExpandedClasses(new Set(classGroups.map(([name]) => name))); }} aria-pressed={view === "docket"} className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition ${view === "docket" ? "bg-white text-[var(--accent-primary)] shadow-sm dark:bg-zinc-800 dark:text-emerald-300" : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"}`}>
                      Docket
                    </button>
                  </div>
                </div>
              </div>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={characteristicQuery}
                  onChange={(event) => setCharacteristicQuery(event.target.value)}
                  placeholder="Filter classes and characteristics…"
                  aria-label="Filter classes and characteristics"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              </label>
            </div>

            <div className={embedded ? "p-3 sm:p-3.5" : "p-3 sm:p-3.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"}>
              {isLoading ? (
                <div className="flex h-48 items-center justify-center gap-2 text-sm text-slate-500 dark:text-zinc-400"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading product details…</div>
              ) : detailsError ? (
                <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">{detailsError}</div>
              ) : filteredClassGroups.length === 0 ? (
                <div className="flex min-h-48 flex-col items-center justify-center px-4 text-center text-sm text-slate-500 dark:text-zinc-400">
                  {characteristicQuery.trim() ? "No specifications match this filter." : "No saved specifications are available for this product."}
                </div>
              ) : (
                view === "docket" ? (
                  <div className="overflow-x-auto pb-4">
                    <div className="min-w-[740px]">
                      <ProductDocketView
                        product={product}
                        classGroups={filteredClassGroups}
                        searchQuery={characteristicQuery}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredClassGroups.map(([className, specs]) => {
                      const allSpecsInClass = classGroups.find(([name]) => name === className)?.[1] || specs;
                      const configuredInClass = allSpecsInClass.filter((item) => hasConfiguredValue(item.value)).length;
                      const expanded = expandedClasses.has(className);
                      return (
                      <section key={className} className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]">
                          <button
                            type="button"
                            aria-expanded={expanded}
                            onClick={() => toggleClass(className)}
                            className="flex min-h-10 w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-[var(--surface-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-primary)] sm:px-3.5"
                          >
                            <span className="min-w-0">
                              <span className="text-xs font-semibold text-slate-800 dark:text-zinc-100">
                                {displayClassName(className)}
                              </span>
                              <span className="ml-2 text-[10px] text-slate-400 dark:text-zinc-500">
                                {view === "configured"
                                  ? `${configuredInClass} configured`
                                  : `${configuredInClass}/${allSpecsInClass.length} configured`}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800 sm:block">
                                <span
                                  className="block h-full rounded-full bg-[var(--accent-primary)]"
                                  style={{
                                    width: `${allSpecsInClass.length ? (configuredInClass / allSpecsInClass.length) * 100 : 0}%`,
                                  }}
                                />
                              </span>
                              {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                            </span>
                          </button>
                          {expanded && (
                          <div className="border-t border-[var(--border-subtle)]">
                              <div className="grid grid-cols-[minmax(0,1fr)_minmax(100px,0.8fr)_56px] gap-2 bg-[var(--surface-low)] px-3 py-1.5 text-[9px] font-bold uppercase tracking-wide text-[var(--on-surface-subtle)] sm:px-3.5">
                                <span>Characteristic</span>
                                <span>Value</span>
                                <span>UOM</span>
                              </div>
                              {specs.map((item) => (
                                <div
                                  key={`${item.className}-${item.characteristicName}`}
                                  className={`grid grid-cols-[minmax(0,1fr)_minmax(100px,0.8fr)_56px] gap-2 border-t border-slate-100 px-3 py-2 text-[11px] dark:border-zinc-800/80 sm:px-3.5 ${highlightCreativeFields && (isMockupCreativeCharacteristic(item.className, item.characteristicName) || isListedCreativeCharacteristic(item, creativeCharacteristicKeys)) ? "border border-rose-500 bg-rose-50/80 ring-1 ring-inset ring-rose-400 dark:border-rose-400 dark:bg-rose-950/25 dark:ring-rose-500" : ""}`}
                                >
                                  <div className="min-w-0 break-words">
                                    <span className="font-medium text-slate-700 dark:text-zinc-200">
                                      {item.characteristicName}
                                    </span>
                                    {highlightCreativeFields && (isMockupCreativeCharacteristic(item.className, item.characteristicName) || isListedCreativeCharacteristic(item, creativeCharacteristicKeys)) && (
                                      <span className="ml-2 inline-flex rounded-full bg-rose-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-rose-800 dark:bg-rose-900/50 dark:text-rose-200">Creative input</span>
                                    )}
                                  </div>
                                  <span
                                    className={`min-w-0 break-words ${
                                      hasConfiguredValue(item.value)
                                        ? "font-semibold text-slate-900 dark:text-zinc-100"
                                        : "text-slate-400 dark:text-zinc-500"
                                    }`}
                                  >
                                    {hasConfiguredValue(item.value) ? item.value?.trim() : ""}
                                  </span>
                                  <span className="text-slate-500 dark:text-zinc-400">{item.uom || ""}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                )

              )}
            </div>
          </main>
        </div>
        {footer && (
          <footer className="shrink-0 border-t border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6">
            {footer}
          </footer>
        )}
      </section>
    </div>
  );
};

export default CatalogProductInspectModal;
