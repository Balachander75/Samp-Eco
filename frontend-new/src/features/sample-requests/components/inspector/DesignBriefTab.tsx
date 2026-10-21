import React, { useState, useMemo } from "react";
import {
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { SampleRequestItem } from "../../types";
import { API_BASE_URL } from "@/infrastructure/api/client";
import { CopyBadge } from "@/components/ui/CopyBadge";

export interface DesignReferenceAsset {
  url: string;
  label: string;
  kind: "image" | "link";
}

function resolveReferenceImageUrl(url: string): string {
  if (/^(?:https?:|data:|blob:)/i.test(url)) return url;
  const baseUrl = API_BASE_URL.replace(/\/+$/, "");
  return `${baseUrl}/${url.replace(/^\/+/, "")}`;
}

function resolveReferenceLinkUrl(url: string): string {
  if (/^(?:https?:|mailto:)/i.test(url)) return url;
  return `https://${url.replace(/^\/\//, "")}`;
}

function formatDate(val?: string | null): string {
  if (!val) return "Not specified";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return val;
  }
}

export interface DesignBriefTabProps {
  activeRequest: SampleRequestItem;
  references: DesignReferenceAsset[];
  onPreviewImage: (url: string) => void;
}

export const DesignBriefTab: React.FC<DesignBriefTabProps> = React.memo(({
  activeRequest,
  references,
  onPreviewImage,
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imageErrorMap, setImageErrorMap] = useState<Record<string, boolean>>({});

  // Filter references into previewable images and web links
  const previewableImages = useMemo(
    () => references.filter((r) => r.kind === "image"),
    [references]
  );

  const referenceLinks = useMemo(
    () => references.filter((r) => r.kind === "link"),
    [references]
  );

  const safeIdx = activeImageIndex >= previewableImages.length ? 0 : activeImageIndex;
  const currentImg = previewableImages[safeIdx] || previewableImages[0];
  const currentImgUrl = currentImg ? resolveReferenceImageUrl(currentImg.url) : "";

  const handleImageError = (url: string) => {
    setImageErrorMap((prev) => ({ ...prev, [url]: true }));
  };

  return (
    <div className="py-2">
      {/* 2-Column Split View: Left (Technical Specs & Directives) + Right (Studio Light-Table Direct Image Viewer) */}
      <div className={previewableImages.length > 0 ? "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" : "w-full"}>

        {/* ── LEFT COLUMN ── */}
        <div className={previewableImages.length > 0 ? "lg:col-span-6 space-y-4" : "w-full space-y-4 max-w-3xl mx-auto"}>

          {/* 1. Technical Description & Product Scope */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">
                Technical Description &amp; Scope
              </span>
              {activeRequest.productDescription && (
                <CopyBadge
                  text={activeRequest.productDescription}
                  label="Copy Scope"
                  className="text-[10px] py-0.5 px-2"
                />
              )}
            </div>
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs sm:text-[13px] text-[var(--on-surface)] leading-relaxed font-sans shadow-2xs whitespace-pre-wrap min-h-[96px]">
              {activeRequest.productDescription || (
                <span className="text-[var(--on-surface-subtle)] italic font-normal">
                  No technical description specified by Marketing.
                </span>
              )}
            </div>
          </div>

          {/* 2. Four Informational Metric Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Box 1: Assigned Designer */}
            <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] flex flex-col justify-between gap-1 shadow-2xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] font-semibold">
                Designer
              </span>
              <div className="font-sans font-bold text-xs truncate text-[var(--on-surface)]">
                {activeRequest.claimedBy || (
                  <span className="text-[var(--on-surface-subtle)] font-normal italic">Pending Assignment</span>
                )}
              </div>
            </div>

            {/* Box 2: Target Artwork Date */}
            <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] flex flex-col justify-between gap-1 shadow-2xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] font-semibold">
                Artwork Target
              </span>
              <div className="font-sans font-mono font-bold text-xs text-[var(--on-surface)] truncate">
                {formatDate(activeRequest.targetArtworkDateCreative || activeRequest.sampleRequiredDate)}
              </div>
            </div>

            {/* Box 3: Artwork Target Scope */}
            <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] flex flex-col justify-between gap-1 shadow-2xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] font-semibold">
                Artwork Scope
              </span>
              <div className="font-display font-bold text-xs text-[var(--on-surface)] truncate">
                {Number(activeRequest.numberOfDesigns || activeRequest.productArtworkNos || activeRequest.designsCustomerCreative || 1)} Artworks Target
              </div>
            </div>

            {/* Box 4: Theme / Trend */}
            <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] flex flex-col justify-between gap-1 shadow-2xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] font-semibold">
                Theme / Trend
              </span>
              <div className="font-sans font-bold text-xs truncate text-[var(--on-surface)]">
                {(activeRequest as any).themeOrTrend || activeRequest.trend || activeRequest.programName || (
                  <span className="text-[var(--on-surface-subtle)] font-normal italic">General Commercial</span>
                )}
              </div>
            </div>
          </div>

          {/* 3. Marketing Directives & Commercial Notes */}
          {activeRequest.designRemarks && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Marketing Directives &amp; Commercial Notes
              </div>
              <div className="p-3.5 rounded-xl border border-amber-200/70 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20 text-xs text-[var(--on-surface)] font-sans leading-relaxed shadow-2xs whitespace-pre-wrap">
                {activeRequest.designRemarks}
              </div>
            </div>
          )}

          {/* 4. External Reference Links */}
          {referenceLinks.length > 0 && (
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">
                Reference Links ({referenceLinks.length})
              </span>
              <div className="grid grid-cols-1 gap-2">
                {referenceLinks.map((link, i) => {
                  const href = resolveReferenceLinkUrl(link.url);
                  return (
                    <a
                      key={i}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-between gap-3 p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary-subtle)]/30 transition shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-[var(--surface-low)] flex items-center justify-center shrink-0 text-[10px] font-mono font-bold text-[var(--accent-primary)]">
                          #{i + 1}
                        </span>
                        <div className="min-w-0">
                          {link.label && link.label !== "Reference Link" && (
                            <p className="text-[11px] font-semibold text-[var(--on-surface)] truncate">
                              {link.label}
                            </p>
                          )}
                          <p className="font-mono text-xs text-[var(--on-surface-muted)] truncate group-hover:text-[var(--accent-primary)] transition">
                            {link.url.replace(/^https?:\/\//, "")}
                          </p>
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] group-hover:text-[var(--accent-primary)] shrink-0 transition" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: PURE IMMERSIVE DIRECT IMAGE VIEWER ── */}
        {previewableImages.length > 0 && (
          <div className="lg:col-span-6 sticky top-4">
            <div className="relative w-full h-[480px] sm:h-[520px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-low)]/50 overflow-hidden shadow-inner flex items-center justify-center p-4 sm:p-6 select-none group">
              {/* Studio Light-Table Grid Backdrop (blends seamlessly with active theme) */}
              <div
                className="absolute inset-0 opacity-[0.35] dark:opacity-[0.18] pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(var(--border-strong) 1px, transparent 1px)`,
                  backgroundSize: "20px 20px",
                }}
              />
              {/* Soft Radial Ambient Vignette */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--surface-container)_100%)] opacity-40 pointer-events-none" />

              {/* Direct Full Image */}
              {imageErrorMap[currentImgUrl] ? (
                <div className="flex flex-col items-center justify-center gap-2 text-rose-500 text-xs z-[1]">
                  <AlertTriangle className="w-8 h-8 opacity-60" />
                  <span>Could not load image</span>
                  <a
                    href={currentImgUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[var(--accent-primary)] underline mt-1"
                  >
                    Open original image
                  </a>
                </div>
              ) : currentImgUrl ? (
                <img
                  src={currentImgUrl}
                  alt={currentImg.label || "Design reference image"}
                  onClick={() => onPreviewImage(currentImgUrl)}
                  onError={() => handleImageError(currentImgUrl)}
                  className="max-w-full max-h-full object-contain rounded-xl transition duration-300 group-hover:scale-[1.015] cursor-zoom-in filter drop-shadow-[0_8px_20px_rgba(11,28,48,0.12)] dark:drop-shadow-[0_12px_28px_rgba(0,0,0,0.6)] z-[1]"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-[var(--on-surface-subtle)] text-xs z-[1]">
                  <Loader2 className="w-7 h-7 animate-spin text-[var(--accent-primary)]" />
                  <span>Loading image…</span>
                </div>
              )}

              {/* Direct Navigation Arrows (< and >) */}
              {previewableImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : previewableImages.length - 1));
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[var(--surface-base)]/85 hover:bg-[var(--surface-base)] text-[var(--on-surface)] flex items-center justify-center backdrop-blur-md transition shadow-md cursor-pointer active:scale-95 z-10 border border-[var(--border-subtle)] opacity-0 group-hover:opacity-100 hover:scale-105"
                    title="Previous Image"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImageIndex((prev) => (prev < previewableImages.length - 1 ? prev + 1 : 0));
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[var(--surface-base)]/85 hover:bg-[var(--surface-base)] text-[var(--on-surface)] flex items-center justify-center backdrop-blur-md transition shadow-md cursor-pointer active:scale-95 z-10 border border-[var(--border-subtle)] opacity-0 group-hover:opacity-100 hover:scale-105"
                    title="Next Image"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </>
              )}

              {/* Minimal Bottom Indicator Dots */}
              {previewableImages.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-[var(--surface-base)]/85 backdrop-blur-md border border-[var(--border-subtle)] flex items-center gap-1.5 z-10 shadow-sm">
                  {previewableImages.map((_, dotIdx) => (
                    <button
                      key={dotIdx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveImageIndex(dotIdx);
                      }}
                      className={`transition-all rounded-full cursor-pointer ${
                        safeIdx === dotIdx
                          ? "w-4 h-1.5 bg-[var(--accent-primary)] shadow-xs"
                          : "w-1.5 h-1.5 bg-[var(--on-surface-subtle)]/30 hover:bg-[var(--on-surface-subtle)]/60"
                      }`}
                      title={`Go to image ${dotIdx + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

DesignBriefTab.displayName = "DesignBriefTab";
