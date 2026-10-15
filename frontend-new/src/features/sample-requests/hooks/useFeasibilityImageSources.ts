import { useEffect, useState } from "react";
import { fetchFeasibilityImageObjectUrl } from "@/infrastructure/api";

const isProtectedFeasibilityImage = (url: string) =>
  url.includes("/api/v1/feasibility-requests/") && url.includes("/images/");

export type FeasibilityImageLoadStatus = "loading" | "ready" | "error";

/** Fetch private image bytes with the session bearer token and release blob URLs on cleanup. */
export function useFeasibilityImageSources(urls: Array<string | undefined>) {
  const requestKey = Array.from(new Set(urls.filter((url): url is string => Boolean(url)))).join("\n");
  const [sources, setSources] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, FeasibilityImageLoadStatus>>({});

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    const requestUrls = requestKey ? requestKey.split("\n") : [];

    setSources({});
    setStatuses(Object.fromEntries(
      requestUrls.filter(isProtectedFeasibilityImage).map((url) => [url, "loading"])
    ));
    void Promise.all(requestUrls.filter(isProtectedFeasibilityImage).map(async (url) => {
      try {
        const objectUrl = await fetchFeasibilityImageObjectUrl(url);
        if (!active) {
          URL.revokeObjectURL(objectUrl);
          return [url, { source: "", status: "error" as const }] as const;
        }
        objectUrls.push(objectUrl);
        return [url, { source: objectUrl, status: "ready" as const }] as const;
      } catch {
        return [url, { source: "", status: "error" as const }] as const;
      }
    })).then((loaded) => {
      if (!active) return;
      setSources(Object.fromEntries(loaded.map(([url, result]) => [url, result.source])));
      setStatuses(Object.fromEntries(loaded.map(([url, result]) => [url, result.status])));
    });

    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [requestKey]);

  return {
    sourceFor: (url?: string) => {
      if (!url) return undefined;
      if (!isProtectedFeasibilityImage(url)) return url;
      return sources[url] || undefined;
    },
    statusFor: (url?: string): FeasibilityImageLoadStatus => {
      if (!url || !isProtectedFeasibilityImage(url)) return "ready";
      return statuses[url] || "loading";
    },
  };
}
