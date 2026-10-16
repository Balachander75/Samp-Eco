import React, { useState, useEffect } from "react";
import { User, Lock, Eye, EyeOff, Loader2, AlertCircle, ArrowRight, X } from "lucide-react";
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
  field?: "identifier" | "password" | "general";
}

export const SignInPage: React.FC<SignInPageProps> = ({ onSignInSuccess }) => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState<number>(0);
  const [errorInfo, setErrorInfo] = useState<ParsedError | null>(null);

  // Apple-style fluid typing reactivity key states
  const [userPulseKey, setUserPulseKey] = useState(0);
  const [lockPulseKey, setLockPulseKey] = useState(0);

  // Rate limit countdown
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

  // Auto-dismiss error alert after 5 seconds
  useEffect(() => {
    if (!errorInfo || retryCountdown > 0) return;
    const timer = setTimeout(() => setErrorInfo(null), 5000);
    return () => clearTimeout(timer);
  }, [errorInfo, retryCountdown]);

  // Escape key to dismiss error
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && errorInfo) setErrorInfo(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [errorInfo]);

  const triggerError = (err: ParsedError) => {
    setErrorInfo(err);
    setShake(true);
    setTimeout(() => setShake(false), 450);
  };

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIdentifier(e.target.value);
    if (errorInfo) setErrorInfo(null);
    setUserPulseKey((prev) => prev + 1);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (errorInfo) setErrorInfo(null);
    setLockPulseKey((prev) => prev + 1);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || retryCountdown > 0) return;

    const cleanId = identifier.trim();

    if (!cleanId) {
      triggerError({
        message: "Please enter your username or corporate email.",
        field: "identifier",
      });
      return;
    }
    if (!password) {
      triggerError({
        message: "Please enter your password to continue.",
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
        let msg = "Incorrect username or password.";

        if (response.status === 401) {
          msg = "Incorrect username or password.";
        } else if (response.status === 403) {
          msg = "Your account does not have access permissions.";
        } else if (response.status === 429) {
          msg = "Too many failed attempts. Security cooldown active.";
        } else if (response.status >= 500) {
          msg = "Authentication service is temporarily unavailable.";
        }

        if (data?.detail?.error?.message) {
          msg = data.detail.error.message;
        } else if (typeof data?.detail === "string") {
          msg = data.detail;
        } else if (data?.message) {
          msg = data.message;
        }

        triggerError({
          message: msg,
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
        triggerError({
          message: "Unable to complete sign in. Please try again.",
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
      triggerError({
        message: "Cannot reach server. Please check your network.",
        field: "general",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isIdentifierError = Boolean(errorInfo?.field === "identifier" || (errorInfo && shake));
  const isPasswordError = Boolean(errorInfo?.field === "password" || (errorInfo && shake));

  return (
    <div
      className="relative isolate flex min-h-screen w-full items-center justify-center overflow-y-auto bg-cover bg-center px-4 py-10 font-sans select-none"
      style={{ backgroundImage: `url(${brandHeroImg})` }}
    >
      {/* Autofill and subtle shake styles */}
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
          -webkit-text-fill-color: #0f172a !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        @keyframes appleShakeKeyframe {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-6px); }
          30% { transform: translateX(6px); }
          45% { transform: translateX(-4px); }
          60% { transform: translateX(4px); }
          75% { transform: translateX(-2px); }
          90% { transform: translateX(2px); }
        }
        .apple-shake {
          animation: appleShakeKeyframe 0.42s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
        @keyframes appleSpringPulse {
          0% { transform: scale(1) translateY(0); }
          35% { transform: scale(1.15) translateY(-1px); }
          100% { transform: scale(1) translateY(0); }
        }
        .apple-icon-spring {
          animation: appleSpringPulse 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes appleIconError {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2.5px); }
          75% { transform: translateX(2.5px); }
        }
        .apple-icon-error {
          animation: appleIconError 0.35s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
        @keyframes toastEntranceTop {
          0% {
            opacity: 0;
            transform: translate(-50%, -16px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
        }
        .toast-top-entrance {
          animation: toastEntranceTop 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>

      {/* Atmospheric hero backdrop: Clean dark overlay so the white card pops out with sharp contrast */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-slate-950/45"
      />

      {/* Solid Pure White Card (Crystal Clear Legibility, Zero Blur Slop) */}
      <main
        className={`relative z-10 w-full max-w-[400px] select-text transition-transform ${
          shake ? "apple-shake" : ""
        }`}
      >
        <section className="rounded-3xl bg-white p-8 sm:p-10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.45)] border border-slate-100">
          {/* Header Branding */}
          <header className="mb-7 flex flex-col items-center justify-center select-none text-center">
            <img
              src={logoImg}
              alt="Navneet Education Limited"
              className="h-11 sm:h-12 w-auto object-contain transition-transform duration-200 hover:scale-[1.02]"
            />
          </header>

          {/* Form */}
          <form onSubmit={handleFormSubmit} className="space-y-4" noValidate>
            {/* Username/Email Input with Apple-style Fluid Responsive Icon */}
            <div>
              <label
                htmlFor="identifier"
                className="mb-1.5 block text-xs font-semibold text-slate-800 tracking-tight"
              >
                Username or Email
              </label>
              <div className="group relative">
                {/* Profile icon: fluid spring bounce on typing, rose red on error */}
                <div
                  className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center transition-colors duration-200 ${
                    isIdentifierError
                      ? "text-rose-500"
                      : identifier
                      ? "text-[#1b4332]"
                      : "text-slate-400 group-focus-within:text-[#1b4332]"
                  }`}
                  aria-hidden="true"
                >
                  <span
                    key={userPulseKey}
                    className={
                      isIdentifierError
                        ? "apple-icon-error inline-flex items-center justify-center"
                        : userPulseKey > 0
                        ? "apple-icon-spring inline-flex items-center justify-center"
                        : "inline-flex items-center justify-center"
                    }
                  >
                    <User className="h-4 w-4" strokeWidth={1.85} />
                  </span>
                </div>

                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  disabled={isLoading || retryCountdown > 0}
                  onChange={handleIdentifierChange}
                  placeholder="Enter corporate ID or email"
                  autoFocus
                  required
                  aria-invalid={isIdentifierError}
                  className={[
                    "h-11 w-full rounded-xl border bg-slate-50/70 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 hover:border-slate-400 focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed",
                    isIdentifierError
                      ? "border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10"
                      : "border-slate-300 focus:border-[#1b4332] focus:ring-4 focus:ring-[#1b4332]/10",
                  ].join(" ")}
                />
              </div>
            </div>

            {/* Password Input with Apple-style Fluid Responsive Lock Icon */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-semibold text-slate-800 tracking-tight"
              >
                Password
              </label>
              <div className="group relative">
                {/* Lock icon: tactile spring bounce on typing, rose red on error */}
                <div
                  className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center transition-colors duration-200 ${
                    isPasswordError
                      ? "text-rose-500"
                      : password
                      ? "text-[#1b4332]"
                      : "text-slate-400 group-focus-within:text-[#1b4332]"
                  }`}
                  aria-hidden="true"
                >
                  <span
                    key={lockPulseKey}
                    className={
                      isPasswordError
                        ? "apple-icon-error inline-flex items-center justify-center"
                        : lockPulseKey > 0
                        ? "apple-icon-spring inline-flex items-center justify-center"
                        : "inline-flex items-center justify-center"
                    }
                  >
                    <Lock className="h-4 w-4" strokeWidth={1.85} />
                  </span>
                </div>

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  disabled={isLoading || retryCountdown > 0}
                  onChange={handlePasswordChange}
                  placeholder="Enter your password"
                  required
                  aria-invalid={isPasswordError}
                  className={[
                    "h-11 w-full rounded-xl border bg-slate-50/70 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 hover:border-slate-400 focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed",
                    isPasswordError
                      ? "border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10"
                      : "border-slate-300 focus:border-[#1b4332] focus:ring-4 focus:ring-[#1b4332]/10",
                  ].join(" ")}
                />

                {/* Eye toggle with tactile Apple-feel click */}
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={isLoading || retryCountdown > 0}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100/90 active:scale-90 transition-all duration-150 cursor-pointer disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b4332]/30"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="inline-flex transition-transform duration-150">
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-[#1b4332]" strokeWidth={1.85} />
                    ) : (
                      <Eye className="h-4 w-4" strokeWidth={1.85} />
                    )}
                  </span>
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center pt-0.5 select-none">
              <label htmlFor="rememberMe" className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  disabled={isLoading || retryCountdown > 0}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#1b4332] accent-[#1b4332] focus-visible:ring-0 focus-visible:outline-none disabled:cursor-not-allowed"
                />
                <span>Stay signed in</span>
              </label>
            </div>

            {/* Modern Executive Forest Emerald Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading || retryCountdown > 0}
                className="group relative flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#245942] to-[#1b4332] px-4 text-sm font-medium tracking-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_6px_20px_-4px_rgba(27,67,50,0.4)] transition-all duration-200 ease-out hover:from-[#1f4e39] hover:to-[#153a2b] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_24px_-4px_rgba(27,67,50,0.5)] active:scale-[0.985] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_8px_rgba(27,67,50,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b4332] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 disabled:shadow-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0 text-white/80" strokeWidth={2} aria-hidden="true" />
                    <span>Signing in…</span>
                  </>
                ) : retryCountdown > 0 ? (
                  <span>Rate Limit Active ({retryCountdown}s)</span>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-white/80 transition-transform duration-200 ease-out group-hover:translate-x-1 group-hover:text-white"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Minimalist Corporate Footer */}
        <footer className="mt-6 text-center select-none font-sans">
          <p className="text-xs text-white/90 font-medium drop-shadow-md">
            Navneet Education Limited · Enterprise ERP
          </p>
        </footer>
      </main>

      {/* Soft & Clean Balanced Floating Indicator (Centered Top - Apple Dynamic Pill) */}
      {errorInfo && (
        <aside
          role="alert"
          aria-live="assertive"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border border-rose-200/90 bg-white/95 px-4 py-2.5 sm:px-5 sm:py-2.5 shadow-[0_14px_38px_-6px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.04)] backdrop-blur-md toast-top-entrance select-text w-auto max-w-[calc(100vw-2.5rem)] sm:max-w-lg"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertCircle className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
          </span>

          <span className="text-xs sm:text-[13px] font-medium text-slate-800 leading-normal">
            {errorInfo.message}
            {retryCountdown > 0 && (
              <span className="ml-1.5 font-mono font-semibold text-rose-600">
                ({retryCountdown}s)
              </span>
            )}
          </span>

          <button
            type="button"
            onClick={() => setErrorInfo(null)}
            className="ml-1 -mr-1 shrink-0 rounded-full p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer focus-visible:outline-none"
            aria-label="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </aside>
      )}
    </div>
  );
};

export default SignInPage;
