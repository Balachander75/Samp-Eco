import React from "react";

export interface PulseSpinnerProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

const SIZE_MAP = {
  xs: "w-3 h-3 border-[1.5px]",
  sm: "w-4 h-4 border-2",
  md: "w-5 h-5 border-2",
  lg: "w-7 h-7 border-[2.5px]",
};

/**
 * Modern dual-ring glowing spinner styled with enterprise theme tokens.
 */
export const PulseSpinner: React.FC<PulseSpinnerProps> = ({
  size = "sm",
  className = "",
  label,
}) => {
  return (
    <div
      role="status"
      className={`inline-flex items-center gap-2 text-current ${className}`}
    >
      <div
        className={`inline-block animate-spin rounded-full border-current border-t-transparent ${SIZE_MAP[size]}`}
        style={{
          borderRightColor: "transparent",
        }}
        aria-hidden="true"
      />
      {label && <span className="text-xs font-medium">{label}</span>}
    </div>
  );
};

export default PulseSpinner;
