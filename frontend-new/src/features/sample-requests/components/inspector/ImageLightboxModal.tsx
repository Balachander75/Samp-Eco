import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { ParsedImageRef } from "../../utils/feasibilityParsers";

export interface ImageLightboxModalProps {
  selectedImage: string | null;
  images: ParsedImageRef[];
  onClose: () => void;
  onNavigate: (direction: -1 | 1) => void;
  imageSourceFor?: (url?: string) => string | undefined;
  imageStatusFor?: (url?: string) => "loading" | "ready" | "error";
  onSelectImage?: (url: string) => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  selectedImage,
  images,
  onClose,
  onNavigate,
  imageSourceFor,
  imageStatusFor,
  onSelectImage,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Reset zoom & pan when image changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  }, [selectedImage]);

  // Keyboard navigation & controls
  useEffect(() => {
    if (!selectedImage) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onNavigate(-1);
      if (event.key === "ArrowRight") onNavigate(1);
      if (event.key === "+" || event.key === "=") {
        setZoom((z) => Math.min(+(z + 0.25).toFixed(2), 3.5));
      }
      if (event.key === "-" || event.key === "_") {
        setZoom((z) => {
          const next = Math.max(+(z - 0.25).toFixed(2), 1);
          if (next === 1) setPan({ x: 0, y: 0 });
          return next;
        });
      }
      if (event.key === "0") {
        setZoom(1);
        setRotation(0);
        setPan({ x: 0, y: 0 });
      }
      if (event.key.toLowerCase() === "r") {
        setRotation((r) => (r + 90) % 360);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImage, onClose, onNavigate]);

  if (!selectedImage) return null;

  const validImages = images.filter((img) => Boolean(img.url));
  const currentIndex = validImages.findIndex((img) => img.url === selectedImage);
  const activeImageRef = validImages[currentIndex];
  const displaySource = imageSourceFor?.(selectedImage) || selectedImage;
  const imageStatus = imageStatusFor?.(selectedImage) || "ready";

  const handleZoomIn = () => setZoom((z) => Math.min(+(z + 0.3).toFixed(2), 3.5));
  const handleZoomOut = () => {
    setZoom((z) => {
      const next = Math.max(+(z - 0.3).toFixed(2), 1);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };
  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleDoubleClick = () => {
    if (zoom > 1) {
      handleResetZoom();
    } else {
      setZoom(2);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // Clean, human-friendly image name
  const rawName = activeImageRef?.name || "";
  const displayName = rawName
    ? rawName.replace(/^whatsapp image\s*/i, "Ref Photo ")
    : `Reference Image ${currentIndex >= 0 ? currentIndex + 1 : 1}`;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image Preview Lightbox"
      className="fixed inset-0 z-[120] flex flex-col justify-between p-3 sm:p-5 select-none overflow-hidden animate-smooth-backdrop text-slate-100"
      style={{
        backgroundColor: "rgba(3, 7, 18, 0.96)",
        backdropFilter: "blur(16px)",
      }}
      onClick={onClose}
    >
      {/* ── TOP FLOATING TOOLBAR ── */}
      <div
        className="w-full max-w-5xl mx-auto flex items-center justify-between text-white z-20 gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Index badge & Title */}
        <div className="flex items-center gap-2.5 sm:gap-3 bg-slate-900/90 border border-slate-700/80 px-3.5 py-1.5 sm:py-2 rounded-2xl shadow-2xl backdrop-blur-xl min-w-0">
          <span className="font-mono text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full shrink-0">
            {currentIndex >= 0 ? `${currentIndex + 1} / ${validImages.length}` : "1 / 1"}
          </span>
          <span
            className="text-xs sm:text-sm text-slate-100 font-semibold truncate max-w-[200px] sm:max-w-md font-sans"
            title={rawName || displayName}
          >
            {displayName}
          </span>
        </div>

        {/* Right: Actions & Close */}
        <div className="flex items-center gap-2 shrink-0">
          {displaySource && imageStatus === "ready" && (
            <a
              href={displaySource}
              target="_blank"
              rel="noopener noreferrer"
              download={activeImageRef?.name || undefined}
              className="h-9 px-3.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 transition flex items-center gap-2 text-xs font-semibold shadow-xl cursor-pointer"
              title="Open full original file in new browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden sm:inline">Open Original</span>
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800/90 hover:bg-rose-900/60 hover:border-rose-500/60 hover:text-rose-100 text-slate-300 border border-slate-700/80 flex items-center justify-center transition cursor-pointer active:scale-95 shadow-xl"
            title="Close Lightbox (Esc)"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* ── PREV / NEXT NAVIGATION ARROWS ── */}
      {validImages.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(-1);
            }}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-white flex items-center justify-center backdrop-blur-xl transition-all cursor-pointer active:scale-90 z-20 shadow-2xl hover:scale-105"
            title="Previous Image (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(1);
            }}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-white flex items-center justify-center backdrop-blur-xl transition-all cursor-pointer active:scale-90 z-20 shadow-2xl hover:scale-105"
            title="Next Image (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6 stroke-[2.5]" />
          </button>
        </>
      )}

      {/* ── MAIN INTERACTIVE IMAGE VIEWPORT ── */}
      <div
        ref={imageContainerRef}
        className="flex-1 w-full max-w-6xl mx-auto flex items-center justify-center p-2 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in" }}
      >
        {imageStatus === "error" ? (
          <div role="alert" className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-500/40 bg-rose-950/70 p-8 text-center text-rose-200 shadow-2xl">
            <AlertTriangle className="w-10 h-10 text-rose-400" />
            <p className="text-sm font-semibold">Could not load this reference image</p>
          </div>
        ) : imageStatus === "loading" ? (
          <div role="status" className="flex flex-col items-center justify-center gap-3 text-slate-300">
            <Loader2 className="w-10 h-10 animate-spin text-[var(--accent-primary)]" />
            <span className="text-xs font-medium">Loading high-resolution image…</span>
          </div>
        ) : (
          <div
            className="relative flex items-center justify-center transition-transform duration-150 ease-out select-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            }}
            onDoubleClick={handleDoubleClick}
          >
            <img
              src={displaySource}
              alt={rawName || "Reference image"}
              className="max-h-[74vh] max-w-[86vw] object-contain rounded-xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] pointer-events-none select-none border border-white/5"
              draggable={false}
            />
          </div>
        )}
      </div>

      {/* ── BOTTOM FLOATING DOCK: CONTROLS & THUMBNAILS ── */}
      <div
        className="w-full max-w-2xl mx-auto flex flex-col items-center gap-2 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Zoom & Action Controls Dock */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-3.5 py-1.5 sm:py-2 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 text-white shadow-2xl">
          {/* Zoom Out */}
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= 1}
            className="w-8 h-8 rounded-xl hover:bg-slate-800 flex items-center justify-center text-slate-300 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Zoom Percentage */}
          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/70 text-emerald-400 min-w-[56px] text-center shadow-inner">
            {Math.round(zoom * 100)}%
          </span>

          {/* Zoom In */}
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= 3.5}
            className="w-8 h-8 rounded-xl hover:bg-slate-800 flex items-center justify-center text-slate-300 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-slate-750 mx-1" />

          {/* Reset Fit */}
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-slate-800 flex items-center gap-1.5 text-slate-200 hover:text-white transition cursor-pointer border border-slate-700/60"
            title="Reset to Fit (0 or R)"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Fit</span>
          </button>

          {/* Rotate 90 deg */}
          <button
            type="button"
            onClick={handleRotate}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-slate-800 flex items-center gap-1.5 text-slate-200 hover:text-white transition cursor-pointer border border-slate-700/60"
            title="Rotate 90° Clockwise (R)"
          >
            <RotateCw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Rotate</span>
          </button>
        </div>

        {/* Thumbnail Preview Strip */}
        {validImages.length > 1 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 shadow-2xl overflow-x-auto max-w-full">
            {validImages.map((img, idx) => {
              const isSelected = img.url === selectedImage;
              return (
                <button
                  key={img.id || idx}
                  type="button"
                  onClick={() => {
                    if (onSelectImage && img.url) {
                      onSelectImage(img.url);
                    } else if (idx !== currentIndex) {
                      onNavigate(idx > currentIndex ? 1 : -1);
                    }
                  }}
                  className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 overflow-hidden shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? "border-emerald-500 ring-2 ring-emerald-500/40 scale-105 opacity-100 shadow-lg"
                      : "border-slate-700/70 opacity-60 hover:opacity-100 hover:border-slate-500"
                  }`}
                  title={img.name}
                >
                  {imageSourceFor?.(img.url) ? (
                    <img
                      src={imageSourceFor(img.url)}
                      alt={img.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center text-[10px] font-mono font-bold text-slate-300">
                      #{idx + 1}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Quick Keyboard & Interaction Hint */}
        <p className="text-[11px] font-mono text-slate-400/90 text-center tracking-wide hidden sm:block">
          Scroll to zoom · Drag to pan · Double-click to toggle · <span className="text-slate-300 font-semibold">Esc</span> to close
        </p>
      </div>
    </div>,
    document.body
  );
};

export default ImageLightboxModal;
