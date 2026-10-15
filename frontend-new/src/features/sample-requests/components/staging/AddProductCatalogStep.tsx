import React from "react";
import { ArrowLeft, BookOpen, Check, ChevronRight, Hash, Search, X } from "lucide-react";
import { BindingHierarchyResponse, ProductSearchResult } from "../../types";
import { DeliverableScopeId } from "../../types/staging";

export interface AddProductCatalogStepProps {
  purpose: "mockup" | "costing";
  includesDesign: boolean;
  selectedScopes: DeliverableScopeId[];
  modalError: string | null;
  searchMode: "material_code" | "binding";
  materialSearchQuery: string;
  materialSearchResults: ProductSearchResult[];
  isSearchingMaterial: boolean;
  selectedProduct: ProductSearchResult | null;
  newProductDescription: string;
  bindingHierarchy: BindingHierarchyResponse;
  selectedBinding1: string;
  selectedBinding2: string;
  bindingSearchResults: ProductSearchResult[];
  isSearchingBinding: boolean;
  onSetSearchMode: (mode: "material_code" | "binding") => void;
  onSetMaterialSearchQuery: (value: string) => void;
  onSelectProduct: (product: ProductSearchResult) => void;
  onSetNewProductDescription: (value: string) => void;
  onSelectBinding1: (value: string) => void;
  onSelectBinding2: (value: string) => void;
  onBack: () => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}

export const AddProductCatalogStep: React.FC<AddProductCatalogStepProps> = ({
  purpose,
  includesDesign,
  modalError,
  searchMode,
  materialSearchQuery,
  materialSearchResults,
  isSearchingMaterial,
  selectedProduct,
  newProductDescription,
  bindingHierarchy,
  selectedBinding1,
  selectedBinding2,
  bindingSearchResults,
  isSearchingBinding,
  onSetSearchMode,
  onSetMaterialSearchQuery,
  onSelectProduct,
  onSetNewProductDescription,
  onSelectBinding1,
  onSelectBinding2,
  onBack,
  onClose,
  onSubmit,
}) => {
  const scopeLabel = purpose === "mockup" ? "Mockup" : "Costing";
  const products = searchMode === "material_code" ? materialSearchResults : bindingSearchResults;
  const isSearching = searchMode === "material_code" ? isSearchingMaterial : isSearchingBinding;
  const hasBinding = Boolean(selectedBinding1);
  const binding2Options = selectedBinding1 ? bindingHierarchy.hierarchy[selectedBinding1] ?? [] : [];

  return (
    <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl animate-smooth-modal dark:border-white/[0.08] dark:bg-zinc-900">
      {/* Modal Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shrink-0 border-b border-slate-100 dark:border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] dark:text-emerald-400 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight font-display">
                Select Catalog Product Reference
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] dark:text-emerald-400 border border-[var(--accent-primary)]/20 tracking-wider uppercase">
                {scopeLabel.toUpperCase()} SPEC
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              {includesDesign
                ? "Your design brief will be linked to the selected catalog product"
                : "Search existing master product database by material code or binding"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
          {modalError && (
            <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              <span className="flex-1">{modalError}</span>
            </div>
          )}

          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
              Search product
            </label>
            <div className="flex rounded-md border border-zinc-200 bg-zinc-100/80 p-1 dark:border-zinc-700 dark:bg-zinc-950">
              <button
                type="button"
                onClick={() => onSetSearchMode("material_code")}
                aria-pressed={searchMode === "material_code"}
                className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded px-3 text-xs transition-colors ${
                  searchMode === "material_code"
                    ? "bg-white font-semibold text-[var(--accent-primary)] shadow-sm dark:bg-zinc-900 dark:text-emerald-400"
                    : "font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                <Hash className="h-3.5 w-3.5" />
                Material code
              </button>
              <button
                type="button"
                onClick={() => onSetSearchMode("binding")}
                aria-pressed={searchMode === "binding"}
                className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded px-3 text-xs transition-colors ${
                  searchMode === "binding"
                    ? "bg-white font-semibold text-[var(--accent-primary)] shadow-sm dark:bg-zinc-900 dark:text-emerald-400"
                    : "font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Binding
              </button>
            </div>
          </div>

          {searchMode === "material_code" ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" />
              <input
                type="search"
                value={materialSearchQuery}
                onChange={(event) => onSetMaterialSearchQuery(event.target.value)}
                placeholder="Search by material code, description, or customer..."
                className="h-10 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-xs text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-[var(--accent-primary)]/60 focus:ring-2 focus:ring-[var(--accent-primary)]/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Binding 1 <span className="text-rose-500">*</span>
                <select
                  required
                  value={selectedBinding1}
                  onChange={(event) => onSelectBinding1(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-[var(--accent-primary)]/60 focus:ring-2 focus:ring-[var(--accent-primary)]/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="">Select binding 1</option>
                  {bindingHierarchy.binding1_options.map((binding) => (
                    <option key={binding} value={binding}>{binding}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Binding 2
                <select
                  disabled={!hasBinding || binding2Options.length === 0}
                  value={selectedBinding2}
                  onChange={(event) => onSelectBinding2(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-[var(--accent-primary)]/60 focus:ring-2 focus:ring-[var(--accent-primary)]/15 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:disabled:bg-zinc-800/60"
                >
                  <option value="">
                    {!hasBinding
                      ? "Select binding 1 first"
                      : binding2Options.length === 0
                        ? "No linked binding 2 values"
                        : "Any linked binding 2"}
                  </option>
                  {binding2Options.map((binding) => <option key={binding} value={binding}>{binding}</option>)}
                </select>
              </label>
            </div>
          )}

          {searchMode === "binding" && !hasBinding ? (
            <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-zinc-200 bg-slate-50 dark:bg-zinc-900 px-4 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:bg-white/[0.025] dark:text-zinc-400">
              Choose a binding to see matching products.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-white/[0.08]">
              <div className="flex items-center justify-between border-b border-zinc-200 bg-slate-50 dark:bg-zinc-900 px-3 py-2 dark:border-white/[0.08] dark:bg-zinc-950">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                  Matching products
                </span>
                <span className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                  {products.length}
                </span>
              </div>
              <div className="max-h-64 divide-y divide-zinc-100 overflow-y-auto dark:divide-white/[0.06]">
                {isSearching ? (
                  <div className="px-4 py-8 text-center text-xs text-zinc-500 dark:text-zinc-400">Searching products…</div>
                ) : products.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
                    {searchMode === "material_code" ? "No matching products found." : "No products match this binding."}
                  </div>
                ) : products.map((product) => {
                  const isSelected = selectedProduct?.id === product.id;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => onSelectProduct(product)}
                      aria-pressed={isSelected}
                      className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors ${
                        isSelected
                          ? "bg-emerald-50/70 ring-inset ring-1 ring-[var(--accent-primary)]/25 dark:bg-emerald-950/30 dark:ring-emerald-500/20"
                          : "bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-white/[0.035]"
                      }`}
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        isSelected
                          ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white"
                          : "border-zinc-300 text-transparent dark:border-zinc-600"
                      }`}>
                        {isSelected && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                            {product.material_code || "No material code"}
                          </span>
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            {product.sr_number} · Use as starting product
                          </span>
                        </span>
                        <span className="mt-1 block truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {product.product_description}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                          {product.customer || "Customer not listed"}
                          {product.product_category && ` · ${product.product_category}`}
                          {product.product_sub_category && ` › ${product.product_sub_category}`}
                          {(product.binding_type_1 || product.binding_type_2) &&
                            ` · ${[product.binding_type_1, product.binding_type_2].filter(Boolean).join(" / ")}`}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedProduct && (
            <div className="space-y-2 rounded-xl border border-[var(--accent-primary)]/20 bg-emerald-50/50 p-3.5 dark:border-emerald-500/20 dark:bg-emerald-950/25">
              <div className="text-xs">
                <span className="font-bold text-[var(--accent-primary)] dark:text-emerald-400">Starting product</span>
                <span className="ml-2 font-medium text-zinc-800 dark:text-zinc-200">
                  {selectedProduct.material_code} · {selectedProduct.product_description}
                </span>
                {selectedProduct.product_category && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] dark:text-emerald-300 border border-[var(--accent-primary)]/20">
                    {selectedProduct.product_category}
                    {selectedProduct.product_sub_category && ` › ${selectedProduct.product_sub_category}`}
                  </span>
                )}
              </div>
              {!includesDesign && (
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                  New product description <span className="text-rose-500">*</span>
                  <input
                    required
                    value={newProductDescription}
                    onChange={(event) => onSetNewProductDescription(event.target.value)}
                    placeholder="Describe the new product"
                    className="mt-1.5 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs font-normal normal-case tracking-normal text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-[var(--accent-primary)]/60 focus:ring-2 focus:ring-[var(--accent-primary)]/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <span className="mt-1 block font-normal normal-case tracking-normal text-zinc-500 dark:text-zinc-400">
                    The selected record is used as a reference. A new material code will be generated.
                  </span>
                </label>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-white px-6 py-4 dark:border-white/[0.06] dark:bg-zinc-900">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 px-4 text-xs font-semibold text-slate-700 transition-colors cursor-pointer dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-white/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{includesDesign ? "Back to Design Brief" : "Back to Deliverables"}</span>
          </button>
          <button
            type="submit"
            disabled={!selectedProduct || (!includesDesign && !newProductDescription.trim())}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-5 text-xs font-bold text-white shadow-[0_2px_10px_rgba(0,109,50,0.25)] hover:shadow-[0_4px_14px_rgba(0,109,50,0.35)] transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 active:scale-98 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
          >
            <span>Add Product to Batch</span>
            <ChevronRight className="h-3.5 w-3.5 stroke-[2.5]" />
          </button>
        </div>
      </form>
    </div>
  );
};
