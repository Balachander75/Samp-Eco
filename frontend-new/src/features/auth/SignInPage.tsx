import React, { useState, useEffect } from "react";
import { User, Lock, Eye, EyeOff, Loader2, X, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { AuthResponse } from "./types";
import { persistAuthSession } from "@/lib/session";
import { apiRawFetch } from "@/infrastructure/api/client";
import logoImg from "@/assets/logo.png";
import brandHeroImg from "@/assets/brand-hero.jpg";

export interface SignInPageProps {
  onSignInSuccess: (response: AuthResponse) => void;
}

interface ParsedError {
  message: string;
  code?: string;
  field?: "identifier" | "password" | "general";
}

export const SignInPage: React.FC<SignInPageProps> = ({ onSignInSuccess }) => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState<number>(0);
  const [errorInfo, setErrorInfo] = useState<ParsedError | null>(null);

  // Rate limit countdown tick
  useEffect(() => {
    if (retryCountdown <= 0) return;
    const interval = setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev <= 1) {
          setErrorInfo(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [retryCountdown]);

  // Auto-dismiss floating toast notification
  useEffect(() => {
    if (!errorInfo || retryCountdown > 0) return;
    const timer = setTimeout(() => {
      setErrorInfo(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [errorInfo, retryCountdown]);

  // Keyboard accessibility: dismiss toast on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && errorInfo) {
        setErrorInfo(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [errorInfo]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || retryCountdown > 0) return;

    const cleanId = identifier.trim();

    if (!cleanId) {
      setErrorInfo({
        message: "Please enter your username or email.",
        code: "REQUIRED_FIELD",
        field: "identifier",
      });
      return;
    }
    if (!password) {
      setErrorInfo({
        message: "Please enter your password.",
        code: "REQUIRED_FIELD",
        field: "password",
      });
      return;
    }

    setIsLoading(true);
    setErrorInfo(null);

    try {
      const response = await apiRawFetch("/api/auth/login", {
        method: "POST",
        timeoutMs: 15_000,
        jsonBody: {
          identifier: cleanId,
          password,
          remember_me: rememberMe,
        },
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        let msg = "Invalid credentials. Please verify your username and password.";
        let code = response.status === 401 ? "INVALID_CREDENTIALS" : `ERROR_${response.status}`;

        if (data?.detail?.error?.message) {
          msg = data.detail.error.message;
          code = data.detail.error.code || code;
        } else if (typeof data?.detail === "string") {
          msg = data.detail;
        } else if (data?.message) {
          msg = data.message;
        }

        setErrorInfo({
          message: msg,
          code,
          field: "general",
        });

        if (response.status === 429) {
          const retryHeader = response.headers.get("retry-after");
          const sec = retryHeader ? parseInt(retryHeader, 10) : 60;
          setRetryCountdown(Math.max(5, sec));
        }
        return;
      }

      const token = data.access_token || "";
      const user = data.user;
      const refreshToken = data.refresh_token;

      if (!token || !user) {
        setErrorInfo({
          message: "Unexpected response from authentication service. Please try again.",
          code: "INVALID_SERVER_RESPONSE",
          field: "general",
        });
        return;
      }

      const authData: AuthResponse = {
        access_token: token,
        refresh_token: refreshToken,
        token_type: "bearer",
        expires_in: data.expires_in,
        user,
      };

      persistAuthSession(token, user, rememberMe, refreshToken);
      onSignInSuccess(authData);
    } catch {
      setErrorInfo({
        message: "Unable to reach the authentication server. Please verify network connectivity.",
        code: "NETWORK_ERROR",
        field: "general",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative isolate flex min-h-screen w-full items-center justify-center overflow-y-auto bg-cover bg-center px-4 py-8 font-sans text-onSurface select-none"
      style={{ backgroundImage: `url(${brandHeroImg})` }}
    >
      {/* Ensure browser autofill matches theme tokens smoothly */}
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px var(--surface-low, #f4f7fb) inset !important;
          -webkit-text-fill-color: var(--on-surface, #0f172a) !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

      {/* Background with subtle blur effect and dark depth overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-slate-950/65 backdrop-blur-[3px] transition-all"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/50"
      />

      {/* Main Solid Form Container */}
      <main className="relative z-10 w-full max-w-md py-4 select-text">
        <section className="rounded-2xl bg-surface-lowest p-7 sm:p-9 shadow-2xl border border-[var(--border-subtle)] transition-all">
          {/* Header Branding */}
          <header className="mb-7 flex flex-col items-center text-center select-none">
            <div className="mb-4 flex items-center justify-center">
              <img
                src={logoImg}
                alt="Navneet Education Limited"
                className="h-10 sm:h-11 w-auto object-contain drop-shadow-xs"
              />
            </div>
            <h1 className="font-display text-2xl sm:text-[26px] font-bold tracking-tight text-onSurface">
              Sign In
            </h1>
            <p className="mt-1.5 text-xs text-onSurface-muted leading-relaxed max-w-xs">
              Enter your corporate credentials to access the enterprise operations workspace
            </p>
          </header>

          {/* Form */}
          <form onSubmit={handleFormSubmit} className="space-y-4" noValidate>
            {/* Username/Email Input */}
            <div>
              <label
                htmlFor="identifier"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-onSurface select-none"
              >
                Username or Email
              </label>
              <div className="group relative">
                <User
                  className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${
                    errorInfo?.field === "identifier"
                      ? "text-rose-500"
                      : "text-onSurface-subtle group-focus-within:text-[var(--accent-primary)]"
                  }`}
                  aria-hidden="true"
                />
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  disabled={isLoading || retryCountdown > 0}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (errorInfo?.field === "identifier" || errorInfo?.field === "general") {
                      setErrorInfo(null);
                    }
                  }}
                  placeholder="Enter your corporate ID"
                  autoFocus
                  required
                  aria-invalid={errorInfo?.field === "identifier"}
                  aria-describedby={errorInfo?.field === "identifier" ? "identifier-error" : undefined}
                  className={[
                    "h-11 w-full rounded-lg border bg-surface-low pl-10 pr-3.5 text-sm text-onSurface placeholder:text-onSurface-subtle/70 outline-none transition-all focus:bg-surface-lowest focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed",
                    errorInfo?.field === "identifier"
                      ? "border-rose-400 ring-2 ring-rose-500/20 focus:border-rose-500"
                      : "border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:ring-[var(--accent-primary)]/20",
                  ].join(" ")}
                />
              </div>
              {errorInfo?.field === "identifier" && (
                <div id="identifier-error" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{errorInfo.message}</span>
                </div>
              )}
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-onSurface select-none"
              >
                Password
              </label>
              <div className="group relative">
                <Lock
                  className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${
                    errorInfo?.field === "password"
                      ? "text-rose-500"
                      : "text-onSurface-subtle group-focus-within:text-[var(--accent-primary)]"
                  }`}
                  aria-hidden="true"
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  disabled={isLoading || retryCountdown > 0}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorInfo?.field === "password" || errorInfo?.field === "general") {
                      setErrorInfo(null);
                    }
                  }}
                  placeholder="Enter your password"
                  required
                  aria-invalid={errorInfo?.field === "password"}
                  aria-describedby={errorInfo?.field === "password" ? "password-error" : undefined}
                  className={[
                    "h-11 w-full rounded-lg border bg-surface-low pl-10 pr-11 text-sm text-onSurface placeholder:text-onSurface-subtle/70 outline-none transition-all focus:bg-surface-lowest focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed",
                    errorInfo?.field === "password"
                      ? "border-rose-400 ring-2 ring-rose-500/20 focus:border-rose-500"
                      : "border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:ring-[var(--accent-primary)]/20",
                  ].join(" ")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  disabled={isLoading || retryCountdown > 0}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-onSurface-subtle transition-colors hover:bg-surface-container hover:text-onSurface focus-visible:outline-none cursor-pointer disabled:opacity-40"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errorInfo?.field === "password" && (
                <div id="password-error" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{errorInfo.message}</span>
                </div>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center pt-1 select-none">
              <label htmlFor="rememberMe" className="flex cursor-pointer items-center gap-2 text-xs font-medium text-onSurface-muted hover:text-onSurface transition-colors">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  disabled={isLoading || retryCountdown > 0}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-[var(--border-subtle)] accent-[var(--accent-primary)] focus-visible:outline-none disabled:cursor-not-allowed"
                />
                <span>Keep me signed in</span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading || retryCountdown > 0}
                className="group relative flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 text-sm font-bold text-[var(--on-accent-primary,white)] shadow-sm transition-all hover:brightness-105 hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
                    <span>Authenticating…</span>
                  </>
                ) : retryCountdown > 0 ? (
                  <span>Rate Limit Active ({retryCountdown}s)</span>
                ) : (
                  <>
                    <span>Sign In to System</span>
                    <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Corporate & Security Footer */}
        <footer className="mt-6 flex flex-col items-center justify-center gap-2 text-center text-xs text-white/80 drop-shadow select-none font-sans">
          <div className="flex items-center gap-2">
            <span>Navneet Education Limited</span>
            <span className="text-white/40">·</span>
            <span>Enterprise Operations</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-white/60 font-mono">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>256-bit TLS Encrypted Session</span>
          </div>
        </footer>
      </main>

      {/* Bottom-Right Floating Toast Notification */}
      {errorInfo && (
        <aside
          role="alert"
          aria-live="assertive"
          className="fixed bottom-6 right-6 z-50 flex max-w-sm sm:max-w-md items-start gap-3.5 rounded-xl border border-rose-300/80 dark:border-rose-900/70 bg-surface-lowest text-onSurface p-4 shadow-2xl ring-1 ring-black/5 animate-smooth-toast select-text"
        >
          {/* Status Indicator Icon */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
          </div>

          {/* Toast Message Body */}
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-onSurface tracking-tight">
                Authentication Error
              </h4>
              {errorInfo.code && (
                <span className="rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                  {errorInfo.code}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-onSurface-muted leading-relaxed">
              {errorInfo.message}
            </p>
            {retryCountdown > 0 && (
              <div className="mt-2 text-xs font-mono font-medium text-rose-600 dark:text-rose-400">
                Unlocks in: {retryCountdown} seconds
              </div>
            )}
          </div>

          {/* Dismiss Action */}
          <button
            type="button"
            onClick={() => setErrorInfo(null)}
            className="shrink-0 rounded-md p-1 text-onSurface-subtle transition-colors hover:text-onSurface hover:bg-surface-low focus-visible:outline-none cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </aside>
      )}
    </div>
  );
};

export default SignInPage;
