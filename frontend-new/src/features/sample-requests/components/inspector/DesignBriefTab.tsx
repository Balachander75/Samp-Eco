import React, { useState, useEffect } from "react";
import { Sparkles, Users, Image as ImageIcon, Link2, ExternalLink, Maximize2 } from "lucide-react";
import { SampleRequestItem } from "../../types";
import { API_BASE_URL } from "@/infrastructure/api/client";

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

const DesignReferenceImage: React.FC<{
  reference: DesignReferenceAsset;
  onPreview: (url: string) => void;
}> = React.memo(({ reference, onPreview }) => {
  const [hasLoadError, setHasLoadError] = useState(false);
  const imageUrl = resolveReferenceImageUrl(reference.url);

  useEffect(() => setHasLoadError(false), [imageUrl]);

  return (
    <div className="group relative aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-zinc-900">
      {hasLoadError ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-slate-600 dark:text-zinc-300">
          <ImageIcon className="h-6 w-6 text-slate-400" />
          <span>Preview unavailable</span>
          <a
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[var(--accent-primary)] underline underline-offset-2 dark:text-emerald-300"
          >
            Open original image
          </a>
        </div>
      ) : (
        <img
          src={imageUrl}
          alt={reference.label}
          loading="lazy"
          onError={() => setHasLoadError(true)}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        />
      )}
      {!hasLoadError && (
        <button
          type="button"
          onClick={() => onPreview(imageUrl)}
          className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-950/85 px-2.5 py-1.5 text-xs font-semibold text-white opacity-100 transition-opacity focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
          aria-label={`Preview ${reference.label}`}
        >
          <Maximize2 className="h-3.5 w-3.5" /> Preview
        </button>
      )}
    </div>
  );
});

DesignReferenceImage.displayName = "DesignReferenceImage";

const DesignReferencePanel: React.FC<{
  references: DesignReferenceAsset[];
  onPreview: (url: string) => void;
}> = React.memo(({ references, onPreview }) => (
  <section className="space-y-4 border-t border-slate-100 pt-5 dark:border-white/10">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Marketing references &amp; moodboard</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Images and links attached to this design brief.
        </p>
      </div>
      <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 font-mono">
        {references.length} {references.length === 1 ? "attachment" : "attachments"}
      </span>
    </div>

    {references.length === 0 ? (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
        <ImageIcon className="h-5 w-5 shrink-0" />
        <span>No reference images or links were added to this brief.</span>
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {references.map((reference, index) => (
          <article
            key={`${reference.kind}-${index}`}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50 shadow-2xs"
          >
            {reference.kind === "image" ? (
              <DesignReferenceImage reference={reference} onPreview={onPreview} />
            ) : (
              <div className="flex min-h-36 flex-col items-start justify-center gap-2 bg-emerald-50/60 p-4 dark:bg-emerald-950/20">
                <Link2 className="h-5 w-5 text-[var(--accent-primary)] dark:text-emerald-300" />
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{reference.label}</span>
                <a
                  href={resolveReferenceLinkUrl(reference.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="max-w-full break-all text-xs text-[var(--accent-primary)] underline underline-offset-2 dark:text-emerald-300 font-mono"
                  title={reference.url}
                >
                  {reference.url}
                </a>
                <a
                  href={resolveReferenceLinkUrl(reference.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-primary-hover)] transition"
                >
                  Open link <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
            {reference.kind === "image" && (
              <div className="border-t border-slate-100 px-3 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
                {reference.label}
              </div>
            )}
          </article>
        ))}
      </div>
    )}
  </section>
));

DesignReferencePanel.displayName = "DesignReferencePanel";

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
  return (
    <div className="space-y-6">
      {/* Technical Description & Scope Box */}
      <div>
        <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-2">
          Technical Description &amp; Product Scope
        </h3>
        <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-white/[0.02] text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed min-h-[70px]">
          {activeRequest.productDescription || ""}
        </div>
      </div>

      {/* Art Direction & Aesthetic Theme */}
      <div>
        <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-2">
          Art Direction &amp; Aesthetic Theme
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="text-xs text-[var(--accent-primary)] dark:text-emerald-300 font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Theme / Trend</span>
            </div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {activeRequest.trend || ""}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-teal-200/80 dark:border-teal-900/40 bg-teal-50/40 dark:bg-teal-950/20 space-y-1.5">
            <div className="text-xs text-teal-800 dark:text-teal-300 font-bold flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>Target Audience</span>
            </div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {activeRequest.targetAudience || ""}
            </div>
          </div>
        </div>
      </div>

      {/* Additional Direction & Finishing Specifications */}
      <div>
        <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-2">
          Additional Direction &amp; Finishing Specifications
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-2">
            <div className="text-xs text-zinc-500 font-medium">Program Specification</div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {activeRequest.programName || ""}
            </div>
            <div className="text-xs text-zinc-500 font-mono">
              Year: {activeRequest.programYear || ""}
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-2">
            <div className="text-xs text-zinc-500 font-medium">Finishing Notes / Remarks</div>
            <div className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
              {activeRequest.designRemarks || ""}
            </div>
          </div>
        </div>
      </div>

      <DesignReferencePanel references={references} onPreview={onPreviewImage} />
    </div>
  );
});

DesignBriefTab.displayName = "DesignBriefTab";
