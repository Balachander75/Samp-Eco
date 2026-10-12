import React from "react";
import { ParsedImageRef } from "../../utils/feasibilityParsers";
import { ExternalLink, Eye, Image as ImageIcon } from "lucide-react";

export interface InspectorAttachmentsTabProps {
  previewableImages: ParsedImageRef[];
  referenceLinks: string[];
  imageSourceFor: (url?: string) => string | undefined;
  onSelectPreviewImage: (url: string) => void;
}

export const InspectorAttachmentsTab: React.FC<InspectorAttachmentsTabProps> = ({
  previewableImages,
  referenceLinks,
  imageSourceFor,
  onSelectPreviewImage,
}) => {
  return (
    <div className="py-4 space-y-6">
      {previewableImages.length > 0 && (
        <div className="space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-display">
            Attached Photo References ({previewableImages.length})
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {previewableImages.map((img, idx) => (
              <div
                key={img.id}
                onClick={() => img.url && onSelectPreviewImage(img.url)}
                className="group relative rounded-2xl bg-slate-100/60 dark:bg-zinc-900 border border-slate-200/60 dark:border-white/5 overflow-hidden cursor-pointer transition hover:shadow-md"
              >
                <div className="aspect-[4/3] w-full bg-slate-100 dark:bg-zinc-800 overflow-hidden relative">
                  <img
                    src={imageSourceFor(img.url)}
                    alt={img.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <span className="text-[11px] font-semibold text-white bg-black/75 px-2.5 py-1 rounded-lg flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </span>
                  </div>
                </div>
                <div className="p-2 flex items-center justify-between text-[11px] text-slate-600 dark:text-zinc-400">
                  <span className="truncate font-medium">{img.name}</span>
                  <span className="font-mono text-[10px] text-slate-400">#{idx + 1}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {referenceLinks.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-display">
            Web Reference Links ({referenceLinks.length})
          </div>
          <div className="space-y-2">
            {referenceLinks.map((url, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100/70 hover:bg-slate-200/70 dark:bg-zinc-800/60 dark:hover:bg-zinc-700/60 text-xs transition"
              >
                <a
                  href={url.startsWith("http") ? url : `https://${url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent-primary)] dark:text-[var(--accent-primary)] hover:underline truncate font-mono text-xs flex-1 font-semibold"
                >
                  {url}
                </a>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {previewableImages.length === 0 && referenceLinks.length === 0 && (
        <div className="py-12 text-center text-slate-400 font-display">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-400 flex items-center justify-center mx-auto mb-2">
            <ImageIcon className="w-6 h-6" />
          </div>
          <span>No reference attachments or links attached to this record.</span>
        </div>
      )}
    </div>
  );
};

export default InspectorAttachmentsTab;
