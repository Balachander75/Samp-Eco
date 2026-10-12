import React, { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  options?: SelectOption[];
  icon?: React.ReactNode;
  size?: "sm" | "md";
  className?: string;
  selectClassName?: string;
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      options,
      icon,
      size = "sm",
      className = "",
      selectClassName = "",
      containerClassName = "",
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const combinedClassName = selectClassName ? `${className} ${selectClassName}`.trim() : className;
    const sizeClasses = {
      sm: "h-8 py-1 pl-2.5 pr-8 text-xs",
      md: "h-9 py-1.5 pl-3 pr-9 text-xs",
    };

    return (
      <div className={`relative inline-flex items-center ${containerClassName}`}>
        {icon && (
          <span className="absolute left-2.5 pointer-events-none text-[var(--on-surface-subtle)] shrink-0">
            {icon}
          </span>
        )}

        <select
          ref={ref}
          disabled={disabled}
          className={`appearance-none rounded-lg bg-[var(--surface-low)] text-[var(--on-surface)] border border-[var(--border-subtle)] font-mono transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ${
            icon ? "pl-8" : ""
          } ${sizeClasses[size]} ${combinedClassName}`}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  className="bg-[var(--surface-lowest)] text-[var(--on-surface)]"
                >
                  {opt.label}
                  {opt.count !== undefined ? ` (${opt.count})` : ""}
                </option>
              ))
            : children}
        </select>

        <span className="absolute right-2.5 pointer-events-none text-[var(--on-surface-subtle)] flex items-center">
          <ChevronDown className="w-3.5 h-3.5" />
        </span>
      </div>
    );
  }
);

Select.displayName = "Select";

export default Select;
