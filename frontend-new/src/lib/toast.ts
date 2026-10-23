export type ToastTone = "success" | "error" | "info";

export interface ToastPayload {
  message: string;
  tone?: ToastTone;
}

export function showToast(message: string, tone: ToastTone = "info"): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<ToastPayload>("app:toast", {
        detail: { message, tone },
      })
    );
  }
}
