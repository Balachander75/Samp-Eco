import React, { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  X,
} from "lucide-react";
import {
  getHolidayInfo,
  formatYMD,
  parseYMD,
  formatDisplayDate,
  isDateRestricted,
} from "@/lib/holidayUtils";
import { cn } from "@/lib/utils";

export interface OperationalDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (dateStr: string) => void;
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  calendarAlign?: "left" | "right";
  compact?: boolean;
  id?: string;
  name?: string;
  hasError?: boolean;
  errorMessage?: string;
  label?: string;
  helperText?: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export const OperationalDatePicker: React.FC<OperationalDatePickerProps> = ({
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = "Select required target date...",
  disabled = false,
  calendarAlign = "left",
  compact = false,
  required = false,
  className,
  id,
  name,
  hasError = false,
  errorMessage,
  label,
  helperText,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number; placement: "top" | "bottom" } | null>(null);
  const [rejectedAttemptMessage, setRejectedAttemptMessage] = useState<string | null>(null);

  // Parse current selected date
  const selectedDate = useMemo(() => parseYMD(value), [value]);

  // Current view year & month in the calendar popover
  const [viewYear, setViewYear] = useState<number>(() => {
    return selectedDate ? selectedDate.getFullYear() : new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState<number>(() => {
    return selectedDate ? selectedDate.getMonth() : new Date().getMonth();
  });

  // Calculate popover positioning relative to trigger
  const calcPopoverPosition = useCallback(() => {
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (!triggerRect) return null;

    const panelWidth = calendarRef.current?.offsetWidth || 310;
    const panelHeight = calendarRef.current?.offsetHeight || 340;
    const viewportPadding = 8;
    let left = calendarAlign === "right" ? triggerRect.right - panelWidth : triggerRect.left;
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - panelWidth - viewportPadding));

    let top = triggerRect.bottom + 6;
    let placement: "top" | "bottom" = "bottom";
    if (top + panelHeight > window.innerHeight - viewportPadding) {
      top = triggerRect.top - panelHeight - 6;
      placement = "top";
    }
    top = Math.max(viewportPadding, Math.min(top, window.innerHeight - panelHeight - viewportPadding));

    return { top, left, placement };
  }, [calendarAlign]);

  // Toggle dropdown with immediate positioning calculation to guarantee buttery-smooth entry animation
  const handleToggle = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (disabled) return;
    if (!isOpen) {
      const initialPos = calcPopoverPosition();
      if (initialPos) {
        setPopoverPosition(initialPos);
      }
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [disabled, isOpen, calcPopoverPosition]);

  // Sync calendar view month when a new valid value is supplied
  useEffect(() => {
    if (selectedDate) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    }
  }, [selectedDate]);

  // Dismiss dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !calendarRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPopoverPosition(null);
      return;
    }

    const updatePopoverPosition = () => {
      const pos = calcPopoverPosition();
      if (pos) {
        setPopoverPosition(pos);
      }
    };

    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [isOpen, calcPopoverPosition, rejectedAttemptMessage, viewYear, viewMonth]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Clear transient reject attempt message after 3.5s
  useEffect(() => {
    if (rejectedAttemptMessage) {
      const t = setTimeout(() => setRejectedAttemptMessage(null), 3500);
      return () => clearTimeout(t);
    }
  }, [rejectedAttemptMessage]);

  // Check if selected value itself is accidentally a restricted date (e.g. from draft / initial seed)
  const isSelectedValueHoliday = useMemo(() => {
    return selectedDate ? isDateRestricted(selectedDate) : false;
  }, [selectedDate]);

  const selectedValueHolidayInfo = useMemo(() => {
    return selectedDate ? getHolidayInfo(selectedDate) : null;
  }, [selectedDate]);

  const minMonth = minDate ? parseYMD(minDate) : null;
  const maxMonth = maxDate ? parseYMD(maxDate) : null;
  const currentMonthStart = new Date(viewYear, viewMonth, 1);
  const canNavigatePrevMonth =
    !minMonth || currentMonthStart > new Date(minMonth.getFullYear(), minMonth.getMonth(), 1);
  const nextMonthStart = new Date(viewYear, viewMonth + 1, 1);
  const canNavigateNextMonth =
    !maxMonth || nextMonthStart <= new Date(maxMonth.getFullYear(), maxMonth.getMonth(), 1);

  // Navigate months
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canNavigatePrevMonth) return;
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canNavigateNextMonth) return;
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Generate calendar grid days
  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: Array<{
      date: Date;
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      isHoliday: boolean;
      holidayLabel?: string;
      isDisabled: boolean;
      disabledReason?: string;
    }> = [];

    const todayStr = formatYMD(new Date());
    const minD = minDate ? parseYMD(minDate) : null;
    const maxD = maxDate ? parseYMD(maxDate) : null;

    // Previous month padding days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonthIdx = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const d = new Date(prevYear, prevMonthIdx, dayNum);
      const dStr = formatYMD(d);
      const holiday = getHolidayInfo(d);

      days.push({
        date: d,
        dateStr: dStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSelected: value === dStr,
        isHoliday: holiday.isHoliday,
        holidayLabel: holiday.label,
        isDisabled: true, // padding days disabled
        disabledReason: "Outside current month",
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const d = new Date(viewYear, viewMonth, dayNum);
      const dStr = formatYMD(d);
      const holiday = getHolidayInfo(d);

      let isDisabled = false;
      let disabledReason: string | undefined;

      if (holiday.isHoliday) {
        isDisabled = true;
        disabledReason = holiday.label;
      } else if (minD && d < minD) {
        isDisabled = true;
        disabledReason = `Cannot select dates before ${minDate}`;
      } else if (maxD && d > maxD) {
        isDisabled = true;
        disabledReason = `Cannot select dates after ${maxDate}`;
      }

      days.push({
        date: d,
        dateStr: dStr,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        isSelected: value === dStr,
        isHoliday: holiday.isHoliday,
        holidayLabel: holiday.label,
        isDisabled,
        disabledReason,
      });
    }

    // Next month padding days to complete 35 or 42 grid cells
    const remainingCells = (7 - (days.length % 7)) % 7;
    const totalNeeded = days.length + remainingCells < 35 ? 35 - days.length : remainingCells;
    for (let dayNum = 1; dayNum <= totalNeeded; dayNum++) {
      const nextMonthIdx = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const d = new Date(nextYear, nextMonthIdx, dayNum);
      const dStr = formatYMD(d);
      const holiday = getHolidayInfo(d);

      days.push({
        date: d,
        dateStr: dStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSelected: value === dStr,
        isHoliday: holiday.isHoliday,
        holidayLabel: holiday.label,
        isDisabled: true, // padding days disabled
        disabledReason: "Outside current month",
      });
    }

    return days;
  }, [viewYear, viewMonth, value, minDate, maxDate]);

  // Handle day click
  const handleDaySelect = (day: typeof calendarGrid[0]) => {
    if (day.isDisabled || day.isHoliday || !day.isCurrentMonth) {
      if (day.isHoliday) {
        setRejectedAttemptMessage(
          `Selection Restricted: ${day.holidayLabel} is an off-day. Only active working days are allowed.`
        );
      }
      return;
    }

    onChange(day.dateStr);
    setRejectedAttemptMessage(null);
    setIsOpen(false);
  };

  // Clear date
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="mb-1 block text-[11px] font-semibold text-[var(--on-surface-muted)]"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Main Interactive Trigger */}
      <div
        id={id}
        ref={triggerRef}
        onClick={handleToggle}
        className={cn(
          cn(
            "group flex w-full cursor-pointer select-none items-center justify-between border transition-colors",
            compact ? "h-8 rounded-lg px-2.5 text-xs" : "h-10 rounded-[var(--radius-control)] px-3 text-xs"
          ),
          disabled && "cursor-not-allowed bg-[var(--surface-low)] opacity-50",
          !disabled && "bg-[var(--surface-lowest)] hover:bg-[var(--surface-low)]",
          isSelectedValueHoliday || hasError
            ? "border-rose-500 bg-rose-50/20 text-rose-900 focus:ring-1 focus:ring-rose-500"
            : "border-[var(--border-subtle)] text-[var(--on-surface)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15"
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {!compact && <CalendarIcon
            className={cn(
              "w-4 h-4 shrink-0",
              isSelectedValueHoliday || hasError
                ? "text-rose-500"
                : "text-[var(--on-surface-subtle)] transition-colors group-hover:text-[var(--accent-primary)]"
            )}
          />}
          {value ? (
            compact ? (
              <span className="whitespace-nowrap font-mono font-medium text-[11px] text-[var(--on-surface)]" title={formatDisplayDate(value)}>
                {value}
              </span>
            ) : (
              <div className="flex items-center gap-2 truncate">
                <span className="font-mono font-medium text-[12px]">{value}</span>
                <span className="truncate text-[11px] text-[var(--on-surface-muted)]">
                  ({formatDisplayDate(value)})
                </span>
                {isSelectedValueHoliday && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 shrink-0">
                    ⚠️ HOLIDAY ({selectedValueHolidayInfo?.badge})
                  </span>
                )}
              </div>
            )
          ) : (
            <span className="truncate font-normal text-[var(--on-surface-subtle)] text-[11px]">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              title="Clear date"
              className="rounded p-1 text-[var(--on-surface-subtle)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {compact ? (
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-[var(--on-surface-subtle)]" />
          ) : (
            <span className="font-mono text-[10px] text-[var(--on-surface-subtle)]">📅</span>
          )}
        </div>
      </div>

      {/* Hidden input to maintain native form compatibility if needed */}
      <input type="hidden" name={name} value={value} required={required} />

      {/* Holiday / Error banner below input */}
      {isSelectedValueHoliday && (
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-600 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            {selectedValueHolidayInfo?.label || "Plant Holiday"}: This date is restricted. Please select an active working day.
          </span>
        </div>
      )}

      {errorMessage && !isSelectedValueHoliday && (
        <p className="mt-1 text-[11px] text-rose-500 font-medium">{errorMessage}</p>
      )}

      {helperText && !isSelectedValueHoliday && !errorMessage && (
        <p className="mt-1 font-mono text-[10px] text-[var(--on-surface-subtle)]">{helperText}</p>
      )}

      {/* Render the calendar outside scroll containers so it remains fully visible. */}
      {isOpen && popoverPosition && typeof document !== "undefined" && createPortal(
        <div
          ref={calendarRef}
          className={cn(
            "fixed z-[1000] w-[310px] select-none rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-3 text-[var(--on-surface)] shadow-2xl",
            popoverPosition.placement === "top" ? "animate-smooth-popover-up" : "animate-smooth-popover"
          )}
          style={{
            width: "min(310px, calc(100vw - 16px))",
            top: popoverPosition.top,
            left: popoverPosition.left,
          }}
        >
          {/* Calendar Header: Navigation & Month Selector */}
          <div className="mb-2 flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={!canNavigatePrevMonth}
              className="rounded-md p-1.5 text-[var(--on-surface-muted)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)] disabled:cursor-not-allowed disabled:opacity-30"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 text-xs font-semibold text-[var(--on-surface)]">
              <span className="font-medium text-[13px]">{MONTH_NAMES[viewMonth]}</span>
              <span className="font-mono text-[var(--on-surface-muted)]">{viewYear}</span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              disabled={!canNavigateNextMonth}
              className="rounded-md p-1.5 text-[var(--on-surface-muted)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)] disabled:cursor-not-allowed disabled:opacity-30"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Restriction Notice Banner (if user attempted to click holiday) */}
          {rejectedAttemptMessage && (
            <div className="mb-2 p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[11px] leading-tight flex items-start gap-1.5 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
              <span>{rejectedAttemptMessage}</span>
            </div>
          )}

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAY_NAMES.map((w, idx) => {
              const isSundayCol = idx === 0;
              const isSaturdayCol = idx === 6;
              return (
                <div
                  key={w}
                  className={cn(
                    "text-[10px] font-mono font-bold uppercase tracking-wider py-0.5",
                    isSundayCol
                      ? "text-rose-600"
                      : isSaturdayCol
                      ? "text-amber-700"
                      : "text-[var(--on-surface-subtle)]"
                  )}
                  title={
                    isSundayCol
                      ? "Sundays: Weekly Plant Holidays (OFF)"
                      : isSaturdayCol
                      ? "Saturdays: 2nd & 4th are Off, 1st & 3rd are Working"
                      : undefined
                  }
                >
                  {w}
                </div>
              );
            })}
          </div>

          {/* Calendar Grid of Days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarGrid.map((day, idx) => {
              const {
                dayNumber,
                isCurrentMonth,
                isToday,
                isSelected,
                isHoliday,
                holidayLabel,
                isDisabled,
                disabledReason,
                dateStr,
              } = day;

              if (!isCurrentMonth) {
                return (
                  <div
                    key={`pad-${idx}`}
                    className="flex h-8 select-none items-center justify-center rounded font-mono text-[11px] text-[var(--on-surface-subtle)] opacity-40"
                  >
                    {dayNumber}
                  </div>
                );
              }

              // Holiday cell styling (Sundays and 2nd/4th Saturdays)
              if (isHoliday) {
                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => handleDaySelect(day)}
                    title={`Restricted: ${holidayLabel} (Plant Off)`}
                    className={cn(
                      "relative h-8 rounded flex flex-col items-center justify-center transition-all cursor-not-allowed",
                      "bg-rose-50/70 border border-rose-200/60",
                      "text-rose-600 hover:border-rose-400 active:scale-95"
                    )}
                  >
                    <span className="text-[11px] font-mono font-bold leading-none">
                      {dayNumber}
                    </span>
                    <span className="text-[7.5px] font-mono font-black uppercase text-rose-700 bg-rose-200/80 px-1 py-0.2 rounded-xs leading-none mt-0.5 tracking-tighter">
                      OFF
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => handleDaySelect(day)}
                  disabled={isDisabled}
                  title={disabledReason || dateStr}
                  className={cn(
                    "relative flex h-8 items-center justify-center rounded font-mono text-[11.5px] transition-colors",
                    isDisabled &&
                      "cursor-not-allowed bg-[var(--surface-low)] text-[var(--on-surface-subtle)] opacity-35",
                    !isDisabled && !isSelected && [
                      "cursor-pointer text-[var(--on-surface)] hover:bg-[var(--surface-low)]",
                      isToday && "border border-[var(--accent-primary)] font-semibold text-[var(--accent-primary-strong)]",
                    ],
                    isSelected &&
                      "cursor-pointer bg-[var(--accent-primary)] font-bold text-[var(--on-accent-primary)] shadow-xs ring-2 ring-[var(--accent-primary)]/30"
                  )}
                >
                  <span className="leading-none">{dayNumber}</span>
                  {isToday && !isSelected && (
                    <span className="mt-0.5 h-1 w-1 rounded-full bg-[var(--accent-primary)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default OperationalDatePicker;
