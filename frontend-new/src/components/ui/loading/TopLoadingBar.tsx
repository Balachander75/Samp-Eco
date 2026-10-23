import React from "react";

export interface TopLoadingBarProps {
  isLoading: boolean;
  className?: string;
}

/**
 * Ultra-sleek, luminous top loading bar indicating background or route loading
 * with hardware-accelerated fluid gradient progression.
 */
export const TopLoadingBar: React.FC<TopLoadingBarProps> = ({ isLoading, className = "" }) => {
  if (!isLoading) return null;

  return (
    <div
      role="progressbar"
      aria-label="Loading content"
      aria-busy="true"
      className={`fixed top-0 left-0 right-0 z-[9999] h-[2.5px] overflow-hidden bg-transparent pointer-events-none ${className}`}
    >
      <div
        className="absolute top-0 bottom-0 rounded-full shadow-[0_0_10px_var(--accent-primary)] bg-gradient-to-r from-[var(--accent-primary)] via-[var(--accent-primary-hover)] to-[var(--accent-teal)]"
        style={{
          animation: "topBarIndeterminate 1.6s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite",
        }}
      />
    </div>
  );
};

export default TopLoadingBar;
