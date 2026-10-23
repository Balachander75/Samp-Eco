import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "subtle" | "ghost" | "danger";
  size?: "xs" | "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      leftIcon,
      rightIcon,
      type = "button",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "group inline-flex items-center justify-center font-medium transition-colors duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-lowest)] disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

    const sizeStyles = {
      xs: "h-7 px-2.5 text-[12px] rounded gap-1.5",
      sm: "h-8 px-3 text-[13px] rounded-md gap-2",
      md: "h-9 px-3.5 text-[13px] rounded-md gap-2",
      lg: "h-10 px-4 text-sm rounded-md gap-2.5",
    };

    const variantStyles = {
      primary:
        "bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] active:brightness-90 text-[var(--on-accent-primary)] shadow-sm border border-[var(--accent-primary-hover)]",
      secondary:
        "bg-[var(--surface-lowest)] hover:bg-[var(--surface-low)] active:bg-[var(--surface-container)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-xs",
      subtle:
        "bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-[var(--text-primary)] border border-transparent",
      ghost:
        "bg-transparent hover:bg-[var(--surface-low)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
      danger:
        "bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-xs border border-rose-700/40",
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
