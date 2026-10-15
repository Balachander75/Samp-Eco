import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X, Plus } from "lucide-react";
import { CustomerItem } from "@/features/sample-requests/types";

interface CustomerComboboxProps {
  customers: CustomerItem[];
  value: string;
  onChange: (customerName: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/** Searchable and editable customer selector with robust dropdown portal positioning. */
export const CustomerCombobox: React.FC<CustomerComboboxProps> = ({
  customers,
  value,
  onChange,
  disabled = false,
  placeholder = "Search customer or country...",
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.name.toLowerCase() === (value || "").trim().toLowerCase()),
    [customers, value]
  );

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return customers;
    return customers.filter((customer) =>
      `${customer.name} ${customer.country || ""}`.toLowerCase().includes(normalizedQuery)
    );
  }, [customers, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Close when clicking outside both container and portal dropdown
  useEffect(() => {
    const handleOutsidePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !optionsRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsidePointer);
    return () => document.removeEventListener("mousedown", handleOutsidePointer);
  }, []);

  // Compute fixed dropdown coordinates relative to viewport
  useLayoutEffect(() => {
    if (!isOpen || disabled) {
      setDropdownPosition(null);
      return;
    }

    const updatePosition = () => {
      const input = inputRef.current;
      if (!input) return;

      const rect = input.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const spaceBelow = viewportHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const opensAbove = spaceBelow < 200 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(160, Math.min(260, opensAbove ? spaceAbove : spaceBelow));
      const width = Math.max(rect.width, 280);
      const left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8));
      const top = opensAbove ? rect.top - maxHeight - 4 : rect.bottom + 4;

      setDropdownPosition({
        top,
        left,
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
  }, [isOpen, disabled, filteredCustomers.length]);

  const openSearch = () => {
    if (disabled) return;
    setQuery(value || "");
    setActiveIndex(0);
    setIsOpen(true);
  };

  const selectCustomer = (customer: CustomerItem) => {
    onChange(customer.name);
    setQuery(customer.name);
    setActiveIndex(0);
    setIsOpen(false);
  };

  const clearCustomer = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setQuery("");
    setActiveIndex(0);
    setIsOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  // Determine display text when not actively typing in open dropdown
  const displayValue = isOpen
    ? query
    : selectedCustomer
    ? selectedCustomer.country
      ? `${selectedCustomer.name} · ${selectedCustomer.country}`
      : selectedCustomer.name
    : value || "";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="customer-options"
          aria-activedescendant={
            isOpen && filteredCustomers[activeIndex]
              ? `customer-option-${filteredCustomers[activeIndex].id}`
              : undefined
          }
          aria-autocomplete="list"
          aria-label="Customer account"
          value={displayValue}
          placeholder={placeholder}
          disabled={disabled}
          onClick={openSearch}
          onFocus={openSearch}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            onChange(next);
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((index) =>
                isOpen ? Math.min(index + 1, Math.max(0, filteredCustomers.length - 1)) : 0
              );
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((index) =>
                isOpen ? Math.max(index - 1, 0) : Math.max(filteredCustomers.length - 1, 0)
              );
            }
            if (event.key === "Escape") {
              setIsOpen(false);
            }
            if (event.key === "Enter") {
              if (isOpen && filteredCustomers[activeIndex]) {
                event.preventDefault();
                selectCustomer(filteredCustomers[activeIndex]);
              } else if (query.trim()) {
                event.preventDefault();
                onChange(query.trim());
                setIsOpen(false);
              }
            }
          }}
          className={`h-10 w-full rounded-xl border border-zinc-200 bg-white pl-8 ${
            value ? "pr-14" : "pr-8"
          } text-xs font-semibold text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700/80 dark:bg-zinc-900/80 dark:text-zinc-100`}
        />
        {value && (
          <button
            type="button"
            aria-label="Clear selected customer"
            title="Clear customer"
            onMouseDown={(event) => event.preventDefault()}
            onClick={clearCustomer}
            className="absolute right-7 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.preventDefault();
            if (isOpen) {
              setIsOpen(false);
            } else {
              openSearch();
              inputRef.current?.focus();
            }
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-150 ${
              isOpen ? "rotate-180 text-emerald-600" : ""
            }`}
          />
        </button>
      </div>

      {isOpen && !disabled && dropdownPosition &&
        createPortal(
          <div
            ref={optionsRef}
            id="customer-options"
            role="listbox"
            style={{
              position: "fixed",
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              maxHeight: dropdownPosition.maxHeight,
            }}
            className="z-[99999] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-[0_12px_36px_rgba(15,23,42,0.2)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_12px_36px_rgba(0,0,0,0.6)]"
          >
            {/* Custom customer suggestion option if typed query has no exact match */}
            {query.trim() &&
              !filteredCustomers.some(
                (c) => c.name.toLowerCase() === query.trim().toLowerCase()
              ) && (
                <button
                  type="button"
                  role="option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(query.trim());
                    setQuery(query.trim());
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-b border-zinc-100 dark:border-zinc-800 mb-1 cursor-pointer transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0 stroke-[2.5]" />
                  <span className="truncate">
                    Use <span className="font-bold">"{query.trim()}"</span> as customer
                  </span>
                </button>
              )}

            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer, index) => {
                const isSelected =
                  customer.name.toLowerCase() === (value || "").trim().toLowerCase();
                return (
                  <button
                    key={customer.id || `${customer.name}-${index}`}
                    type="button"
                    role="option"
                    id={`customer-option-${customer.id || index}`}
                    aria-selected={index === activeIndex || isSelected}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => selectCustomer(customer)}
                    tabIndex={-1}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer ${
                      index === activeIndex || isSelected
                        ? "bg-emerald-50 text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-200 font-semibold"
                        : "hover:bg-slate-50 text-zinc-800 dark:hover:bg-zinc-800/60 dark:text-zinc-200"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">
                        {customer.name}
                      </span>
                      {customer.country && (
                        <span className="block truncate text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                          {customer.country}
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400 stroke-[2.5]" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-2.5 py-3 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
                No matching customer found. Type to use a custom account.
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

export default CustomerCombobox;
