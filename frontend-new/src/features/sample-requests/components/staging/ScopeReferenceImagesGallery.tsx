import React from "react";
import { Image as ImageIcon } from "lucide-react";

type ScopeId = "sample" | "mockup" | "costing";
type ScopeReferenceImage = { id: string | number; name: string; url?: string };
type ScopeReferenceImages = Partial<Record<ScopeId, ScopeReferenceImage[]>>;

const labels: Record<ScopeId, string> = {
  sample: "Sample",
  mockup: "Mockup",
  costing: "Costing",
};

interface ScopeReferenceImagesGalleryProps {
  images?: ScopeReferenceImages;
  scopes?: ScopeId[];
  onPreview: (url: string) => void;
}

export const ScopeReferenceImagesGallery: React.FC<ScopeReferenceImagesGalleryProps> = ({
  images = {},
  scopes = ["sample", "mockup", "costing"],
  onPreview,
}) => {
  const visibleScopes = scopes.filter((scope) => (images[scope] || []).length > 0);
  if (!visibleScopes.length) return null;

  return (
    <section aria-label="Request reference images" className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-3.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Reference Images</h3>
        <span className="text-[10px] text-[var(--on-surface-muted)]">Saved with this request</span>
      </div>
      <div className="space-y-2.5">
        {visibleScopes.map((scope) => (
          <div key={scope} className="flex flex-wrap items-center gap-2.5">
            <span className="w-16 shrink-0 text-[10px] font-semibold text-[var(--on-surface-muted)]">{labels[scope]}</span>
            {(images[scope] || []).map((image) => (
              image.url ? (
                <button key={image.id} type="button" onClick={() => onPreview(image.url!)} className="group flex min-w-0 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-1.5 text-left transition hover:border-[var(--accent-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]">
                  <img src={image.url} alt={image.name} className="h-11 w-11 shrink-0 rounded-md object-cover" />
                  <span className="max-w-40 truncate text-[10px] font-medium text-[var(--on-surface)]">{image.name}</span>
                </button>
              ) : (
                <span key={image.id} className="inline-flex items-center gap-1 text-[10px] text-[var(--on-surface-muted)]">
                  <ImageIcon className="h-3 w-3" />{image.name}
                </span>
              )
            ))}
          </div>
        ))}
      </div>
    </section>
  );
};

export default ScopeReferenceImagesGallery;
