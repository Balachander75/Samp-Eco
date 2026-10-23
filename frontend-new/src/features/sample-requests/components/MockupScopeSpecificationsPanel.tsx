import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { useFeasibilityImageSources } from "../hooks/useFeasibilityImageSources";

export interface MockupScopeImage {
  id: string | number;
  name?: string;
  url?: string;
}

export interface MockupScopeMetric {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}

export interface MockupScopeNote {
  label: string;
  value: string;
  tone?: "default" | "warning";
}

interface MockupScopeSpecificationsPanelProps {
  description?: string | null;
  metrics: MockupScopeMetric[];
  notes?: MockupScopeNote[];
  images?: MockupScopeImage[];
  onPreview: (url: string) => void;
  leftContent?: ReactNode;
}

export const MockupScopeSpecificationsPanel: React.FC<MockupScopeSpecificationsPanelProps> = ({
  description,
  metrics,
  notes = [],
  images = [],
  onPreview,
  leftContent,
}) => {
  const previewableImages = useMemo(
    () => images.filter((image): image is MockupScopeImage & { url: string } => Boolean(image.url)),
    [images]
  );
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const imageUrlsKey = previewableImages.map((image) => image.url).join("\n");
  const { sourceFor: imageSourceFor, statusFor: imageStatusFor } = useFeasibilityImageSources(
    previewableImages.map((image) => image.url)
  );

  useEffect(() => {
    setActiveImageIndex(0);
    setFailedImageUrl(null);
  }, [imageUrlsKey]);

  const safeIndex = activeImageIndex >= previewableImages.length ? 0 : activeImageIndex;
  const currentImage = previewableImages[safeIndex];

  return (
    <div className={previewableImages.length > 0 ? "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" : "w-full"}>
      <div className={previewableImages.length > 0 ? "lg:col-span-6 space-y-4" : "w-full space-y-4"}>
        {leftContent}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">
              Technical Description &amp; Scope
            </span>
            {description && (
              <CopyBadge text={description} label="Copy Scope" className="text-[10px] py-0.5 px-2" />
            )}
          </div>
          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs sm:text-[13px] text-[var(--on-surface)] leading-relaxed font-sans shadow-2xs whitespace-pre-wrap min-h-[96px]">
            {description || (
              <span className="text-[var(--on-surface-subtle)] italic font-normal">
                No technical description specified by Marketing.
              </span>
            )}
          </div>
        </div>

        <div className={`grid gap-2.5 ${previewableImages.length > 0 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
          {metrics.slice(0, 4).map((metric) => (
            <div key={metric.label} className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] flex flex-col justify-between gap-1 shadow-2xs min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] font-semibold">
                {metric.label}
              </span>
              <div className="font-sans font-bold text-xs text-[var(--on-surface)] break-words">
                {metric.value || "—"}
              </div>
              {metric.detail && (
                <div className="text-[11px] text-[var(--on-surface-muted)] break-words">{metric.detail}</div>
              )}
            </div>
          ))}
        </div>

        {notes.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-700 ">
              Brief &amp; Instructions
            </div>
            <div className="p-3.5 rounded-xl border border-amber-200/70 bg-amber-50/50   text-xs text-[var(--on-surface)] font-sans leading-relaxed shadow-2xs whitespace-pre-wrap space-y-1.5">
              {notes.map((note) => (
                <p key={note.label} className={note.tone === "warning" ? "text-amber-800 " : undefined}>
                  <strong>{note.label}: </strong>{note.value}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {currentImage && (
        <div className="lg:col-span-6 sticky top-4">
          <div className="relative w-full h-[480px] sm:h-[520px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-low)]/50 overflow-hidden shadow-inner flex items-center justify-center p-4 sm:p-6 select-none group">
            <div
              className="absolute inset-0 opacity-[0.35]  pointer-events-none"
              style={{ backgroundImage: "radial-gradient(var(--border-strong) 1px, transparent 1px)", backgroundSize: "20px 20px" }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--surface-container)_100%)] opacity-40 pointer-events-none" />

            {imageSourceFor(currentImage.url) && failedImageUrl !== currentImage.url ? (
              <img
                src={imageSourceFor(currentImage.url)}
                alt={currentImage.name || "Mockup reference image"}
                onClick={() => onPreview(currentImage.url)}
                onError={() => setFailedImageUrl(currentImage.url)}
                className="max-w-full max-h-full object-contain rounded-xl transition duration-300 group-hover:scale-[1.015] cursor-zoom-in filter drop-shadow-[0_8px_20px_rgba(11,28,48,0.12)]  z-[1]"
              />
            ) : imageStatusFor(currentImage.url) === "error" || failedImageUrl === currentImage.url ? (
              <div className="flex flex-col items-center justify-center gap-2 text-rose-500 text-xs z-[1]">
                <AlertTriangle className="w-8 h-8 opacity-60" />
                <span>Could not load image</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-[var(--on-surface-subtle)] text-xs z-[1]">
                <Loader2 className="w-7 h-7 animate-spin text-[var(--accent-primary)]" />
                <span>Loading image…</span>
              </div>
            )}

            {previewableImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveImageIndex((previous) => previous > 0 ? previous - 1 : previewableImages.length - 1);
                    setFailedImageUrl(null);
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[var(--surface-base)]/85 hover:bg-[var(--surface-base)] text-[var(--on-surface)] flex items-center justify-center backdrop-blur-md transition shadow-md cursor-pointer active:scale-95 z-10 border border-[var(--border-subtle)] opacity-0 group-hover:opacity-100 hover:scale-105"
                  title="Previous image"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveImageIndex((previous) => previous < previewableImages.length - 1 ? previous + 1 : 0);
                    setFailedImageUrl(null);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[var(--surface-base)]/85 hover:bg-[var(--surface-base)] text-[var(--on-surface)] flex items-center justify-center backdrop-blur-md transition shadow-md cursor-pointer active:scale-95 z-10 border border-[var(--border-subtle)] opacity-0 group-hover:opacity-100 hover:scale-105"
                  title="Next image"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-[var(--surface-base)]/85 backdrop-blur-md border border-[var(--border-subtle)] flex items-center gap-1.5 z-10 shadow-sm">
                  {previewableImages.map((image, index) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveImageIndex(index);
                        setFailedImageUrl(null);
                      }}
                      className={`transition-all rounded-full cursor-pointer ${
                        safeIndex === index
                          ? "w-4 h-1.5 bg-[var(--accent-primary)] shadow-xs"
                          : "w-1.5 h-1.5 bg-[var(--on-surface-subtle)]/30 hover:bg-[var(--on-surface-subtle)]/60"
                      }`}
                      title={`Go to image ${index + 1}`}
                      aria-label={`Go to image ${index + 1}`}
                      aria-current={safeIndex === index ? "true" : undefined}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
