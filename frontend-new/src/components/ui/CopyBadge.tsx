import React from "react";
import { Copy, Check } from "lucide-react";
import { useClipboard } from "@/hooks/useClipboard";

export interface CopyBadgeProps {
  text: string;
  label?: string;
  className?: string;
  title?: string;
  showIcon?: boolean;
  onCopySuccess?: (text: string) => void;
}

export const CopyBadge: React.FC<CopyBadgeProps> = ({
  text,
  label,
  className = "",
  title,
  showIcon = true,
  onCopySuccess,
}) => {
  const { copy, isCopied } = useClipboard({ timeout: 1300 });
  const copied = isCopied(text);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copy(text, e);
    if (success && onCopySuccess) {
      onCopySuccess(text);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title || (copied ? "Copied to clipboard!" : `Click to copy: ${text}`)}
      className={`group/copy inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-xs cursor-pointer select-none transition-all duration-150 border ${
        copied
          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
          : "bg-neutral-100/80 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 text-neutral-800 dark:text-zinc-200 border-neutral-200/90 dark:border-zinc-700"
      } ${className}`}
    >
      <span className="truncate">{label || text}</span>
      {showIcon && (
        <span className="shrink-0 flex items-center justify-center">
          {copied ? (
            <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
          ) : (
            <Copy className="w-3 h-3 text-neutral-400 group-hover/copy:text-neutral-700 dark:text-zinc-500 dark:group-hover/copy:text-zinc-300 transition-colors" />
          )}
        </span>
      )}
    </button>
  );
};

export default CopyBadge;
