import { useState, useCallback } from "react";

export interface UseClipboardOptions {
  timeout?: number;
}

export interface UseClipboardReturn {
  copiedValue: string | null;
  copy: (text: string, e?: React.MouseEvent) => Promise<boolean>;
  isCopied: (value?: string | null) => boolean;
  clear: () => void;
}

/**
 * Standard hook for copying strings to the system clipboard with auto-resetting feedback state.
 */
export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const { timeout = 1400 } = options;
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const copy = useCallback(
    async (text: string, e?: React.MouseEvent): Promise<boolean> => {
      if (e) {
        e.stopPropagation();
      }
      if (!text) return false;

      try {
        await navigator.clipboard.writeText(text);
        setCopiedValue(text);
        setTimeout(() => {
          setCopiedValue((current) => (current === text ? null : current));
        }, timeout);
        return true;
      } catch (err) {
        console.error("Failed to copy to clipboard:", err);
        return false;
      }
    },
    [timeout]
  );

  const isCopied = useCallback(
    (value?: string | null): boolean => {
      if (!value) return Boolean(copiedValue);
      return copiedValue === value;
    },
    [copiedValue]
  );

  const clear = useCallback(() => {
    setCopiedValue(null);
  }, []);

  return { copiedValue, copy, isCopied, clear };
}

export default useClipboard;
