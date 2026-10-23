import React, { useRef, useState } from "react";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { compressScopeReferenceImage } from "@/lib/referenceImage";
import type { ReferenceImageScopeId, StagedReferenceImage } from "../../types/staging";

const MAX_IMAGES = 2;

const scopeLabels: Record<ReferenceImageScopeId, string> = {
  sample: "Sample",
  mockup: "Mockup",
  costing: "Costing",
};

interface ScopeReferenceImageFieldProps {
  scope: ReferenceImageScopeId;
  images: StagedReferenceImage[];
  onChange: (images: StagedReferenceImage[]) => void;
  onProcessingChange?: (processing: boolean) => void;
}

export const ScopeReferenceImageField: React.FC<ScopeReferenceImageFieldProps> = ({
  scope,
  images,
  onChange,
  onProcessingChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const remaining = Math.max(0, MAX_IMAGES - images.length);

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    input.value = "";
    if (!files.length) return;

    if (remaining === 0) {
      setError("Maximum 2 images are allowed for this request.");
      return;
    }

    const selected = files.slice(0, remaining);
    setError(files.length > remaining ? `Only ${remaining} image slot${remaining === 1 ? "" : "s"} left; the extra files were skipped.` : "");
    setIsProcessing(true);
    onProcessingChange?.(true);
    try {
      const next: StagedReferenceImage[] = [];
      for (const file of selected) {
        try {
          const { url, sizeKb } = await compressScopeReferenceImage(file);
          next.push({
            id: `scope-img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            url,
            name: file.name,
            size: `${sizeKb} KB`,
            originalSizeBytes: file.size,
          });
        } catch (reason) {
          setError(reason instanceof Error ? `${file.name}: ${reason.message}` : `${file.name} could not be compressed.`);
        }
      }
      if (next.length) onChange([...images, ...next].slice(0, MAX_IMAGES));
    } finally {
      setIsProcessing(false);
      onProcessingChange?.(false);
    }
  };

  const removeImage = (id: string) => {
    onChange(images.filter((image) => image.id !== id));
    setError("");
  };

  return (
    <section aria-label={`${scopeLabels[scope]} reference images`} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3  ">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 ">
            {scopeLabels[scope]} reference images <span className="font-medium normal-case tracking-normal text-slate-500">(optional)</span>
          </h4>
          <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500 ">Up to 2 images. Compressed to about 30% of the original size, with a 512 KB stored size limit each.</p>
        </div>
        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600   " aria-live="polite">
          {images.length}/2
        </span>
      </div>

      {images.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {images.map((image) => (
            <li key={image.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white p-2  ">
              <img src={image.url} alt={image.name} className="h-10 w-10 shrink-0 rounded-md border border-slate-200 object-cover " />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-slate-700 " title={image.name}>{image.name}</p>
                {image.size && <p className="text-[10px] text-slate-500 ">{image.size}</p>}
              </div>
              <button
                type="button"
                onClick={() => removeImage(image.id)}
                disabled={isProcessing}
                aria-label={`Remove ${image.name}`}
                className="rounded-md p-1.5 text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-40   "
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={handleFiles} aria-label={`Choose ${scopeLabels[scope]} reference images`} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={remaining === 0 || isProcessing}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50   "
        >
          {isProcessing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {isProcessing ? "Compressing…" : remaining ? "Add image" : "2 images added"}
        </button>
        <span className="text-[10px] text-slate-500 ">JPEG, PNG, or WebP · max 15 MB each</span>
      </div>
      {error && <p role="alert" className="text-[10px] font-medium text-rose-700 ">{error}</p>}
    </section>
  );
};

export default ScopeReferenceImageField;
