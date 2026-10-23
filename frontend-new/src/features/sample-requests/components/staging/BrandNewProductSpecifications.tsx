import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, LoaderCircle } from "lucide-react";
import Select from "@/components/ui/Select";
import { fetchAllProductCharacteristics } from "@/infrastructure/api/masterApi";
import type { ProductCharacteristicItem } from "@/infrastructure/api/masterApi";
import type { StagedProductItem } from "../../types/staging";
import { isMockupCreativeCharacteristic } from "./mockupCreativeFields";

type CustomProductDetail = NonNullable<StagedProductItem["customDetails"]>[number];

interface BrandNewProductSpecificationsProps {
  details: CustomProductDetail[];
  onChange: (details: CustomProductDetail[]) => void;
}

const detailKey = (className: string, characteristicName: string) =>
  `${className.trim()}::${characteristicName.trim()}`.toLowerCase();

const detailClassName = (detail: CustomProductDetail) => detail.className || detail.class_name || "";
const detailCharacteristicName = (detail: CustomProductDetail) =>
  detail.characteristicName || detail.characteristic_name || "";

const classOrder = [
  "productclass",
  "nbbinding",
  ...Array.from({ length: 7 }, (_, index) => `component${index + 1}`),
  "nbdividerspec",
  "packagingspec1",
  "rulingdetail",
  "packingdetail",
];

const normalizeClassName = (className: string) => className.toLowerCase().replace(/[^a-z0-9]/g, "");
const normalizeClassOrderKey = (className: string) => {
  const key = normalizeClassName(className);
  if (key.startsWith("nbcomponent")) return key.slice(2);
  if (["nbdividerspecs", "nbdividingspec", "nbdividingspecs"].includes(key)) return "nbdividerspec";
  return key;
};

export const BrandNewProductSpecifications: React.FC<BrandNewProductSpecificationsProps> = ({
  details,
  onChange,
}) => {
  const [characteristics, setCharacteristics] = useState<ProductCharacteristicItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setLoadError("");
    fetchAllProductCharacteristics()
      .then((items: any) => {
        if (isCurrent) setCharacteristics(items);
      })
      .catch(() => {
        if (isCurrent) setLoadError("Product classes could not be loaded. Retry to continue.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [reloadKey]);

  const classGroups = useMemo(() => {
    const groups = new Map<string, ProductCharacteristicItem[]>();
    characteristics.forEach((item) => {
      const className = item.class_name?.trim();
      if (!className) return;
      const current = groups.get(className) || [];
      current.push(item);
      groups.set(className, current);
    });
    return [...groups.entries()].sort(([left], [right]) => {
      const leftName = normalizeClassOrderKey(left);
      const rightName = normalizeClassOrderKey(right);
      const leftIsPackingDetail = leftName.startsWith("packingdetail");
      const rightIsPackingDetail = rightName.startsWith("packingdetail");
      if (leftIsPackingDetail !== rightIsPackingDetail) return leftIsPackingDetail ? 1 : -1;

      const leftPriority = classOrder.findIndex((name) => leftName === name);
      const rightPriority = classOrder.findIndex((name) => rightName === name);
      const leftRank = leftPriority < 0 ? classOrder.length : leftPriority;
      const rightRank = rightPriority < 0 ? classOrder.length : rightPriority;

      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [characteristics]);

  const valuesByKey = useMemo(() => {
    const values = new Map<string, CustomProductDetail>();
    details.forEach((detail) => {
      const className = detailClassName(detail);
      const characteristicName = detailCharacteristicName(detail);
      if (className && characteristicName) values.set(detailKey(className, characteristicName), detail);
    });
    return values;
  }, [details]);

  const updateValue = (item: ProductCharacteristicItem, value: string) => {
    const key = detailKey(item.class_name, item.characteristic_name);
    const nextDetail: CustomProductDetail = {
      class_name: item.class_name,
      characteristic_name: item.characteristic_name,
      value: value.trim() ? value : null,
      uom: item.uom || null,
    };
    const currentIndex = details.findIndex((detail) =>
      detailKey(detailClassName(detail), detailCharacteristicName(detail)) === key
    );
    const nextDetails = [...details];
    if (currentIndex < 0) nextDetails.push(nextDetail);
    else nextDetails[currentIndex] = nextDetail;
    onChange(nextDetails);
  };

  const filledCount = (items: ProductCharacteristicItem[]) => items.filter((item) =>
    String(valuesByKey.get(detailKey(item.class_name, item.characteristic_name))?.value ?? "").trim()
  ).length;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60  ">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3">
        <div>
          <h3 className="text-xs font-bold text-slate-900 ">Product specifications</h3>
          <p className="mt-0.5 text-[11px] text-slate-600 ">
            Open a class to add its characteristics. Fields you do not know can stay empty.
          </p>
        </div>
        {!isLoading && !loadError && classGroups.length > 0 && (
          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-mono font-semibold tabular-nums text-slate-600  ">
            {classGroups.length} classes
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 border-t border-slate-200 px-3.5 py-4 text-xs text-slate-500  ">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading product classes...
        </div>
      ) : loadError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rose-200 bg-rose-50 px-3.5 py-3  ">
          <p role="alert" className="text-xs text-rose-700 ">{loadError}</p>
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-800 transition-colors hover:bg-rose-100 cursor-pointer select-none  "
          >
            Retry
          </button>
        </div>
      ) : classGroups.length === 0 ? (
        <p className="border-t border-slate-200 px-3.5 py-4 text-xs text-slate-500  ">
          No active product classes are available.
        </p>
      ) : (
        <div className="divide-y divide-slate-200 border-t border-slate-200  ">
          {classGroups.map(([className, items]) => {
            const enteredCount = filledCount(items);
            return (
              <details key={className} className="group bg-white ">
                <summary className="flex cursor-pointer select-none list-none items-center justify-between gap-3 px-3.5 py-3 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-primary)] ">
                  <span className="min-w-0 truncate text-xs font-semibold text-slate-800 ">
                    {className.replace(/_/g, " ")}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-[10px] font-mono text-slate-500 ">
                    <span className="tabular-nums">{items.length} fields · {enteredCount} entered</span>
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                  </span>
                </summary>
                <div className="grid gap-x-4 gap-y-3 border-t border-slate-100 bg-slate-50/70 px-3.5 py-3   sm:grid-cols-2">
                  {items.map((item) => {
                    const key = detailKey(item.class_name, item.characteristic_name);
                    const value = String(valuesByKey.get(key)?.value ?? "");
                    const options = Array.isArray(item.options) ? item.options : [];
                    const creativeOwned = isMockupCreativeCharacteristic(item.class_name, item.characteristic_name);
                    return (
                      <label
                        key={key}
                        className={`block min-w-0 space-y-1 text-[10.5px] font-medium text-slate-600  ${creativeOwned ? "rounded-lg border border-rose-500 bg-rose-50/80 p-2.5 ring-1 ring-inset ring-rose-400   " : ""}`}
                      >
                        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                          <span className="break-words">
                            {item.characteristic_name.replace(/_/g, " ")}
                          </span>
                          {item.uom && <span className="shrink-0 text-[10px] font-normal text-slate-400 ">{item.uom}</span>}
                        </span>
                        {options.length > 0 ? (
                          <Select
                            size="md"
                            containerClassName="w-full"
                            className="w-full"
                            value={value}
                            onChange={(event) => updateValue(item, event.target.value)}
                            onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
                            options={[
                              { value: "", label: "Select value" },
                              ...options.map((option: any) => ({ value: option, label: option })),
                            ]}
                          />
                        ) : (
                          <input
                            value={value}
                            onChange={(event) => updateValue(item, event.target.value)}
                            onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
                            placeholder="Enter value"
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-normal text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]    "
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default BrandNewProductSpecifications;
