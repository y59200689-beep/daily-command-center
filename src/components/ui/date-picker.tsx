"use client";

import { useEffect, useRef, useState } from "react";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateKey(key: string): Date | null {
  if (!key || key.length < 10) return null;
  const parts = key.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatHuman(key: string): string {
  const date = parseDateKey(key);
  if (!date) return "";
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function DatePicker({
  id,
  value = "",
  onChange,
  placeholder = "Select date",
  required,
  className,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDate = parseDateKey(value);
  const today = new Date();
  const todayKey = toDateKey(today);

  // Current viewed month/year in the calendar
  const [viewDate, setViewDate] = useState(() => selectedDate || new Date());

  // Sync viewed month when opened or value changes
  useEffect(() => {
    if (open && value) {
      const parsed = parseDateKey(value);
      if (parsed) setViewDate(parsed);
    }
  }, [open, value]);

  // Handle clicking outside to close
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Navigation handlers
  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1));
  }
  function goToToday() {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // 0 for Monday, 6 for Sunday
  const startDate = new Date(year, month, 1 - startDayOfWeek);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalSlotsNeeded = startDayOfWeek + daysInMonth;
  const slotCount = totalSlotsNeeded <= 28 ? 28 : totalSlotsNeeded <= 35 ? 35 : 42;

  const days: Date[] = [];
  for (let i = 0; i < slotCount; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    days.push(d);
  }

  function handleSelect(d: Date) {
    const key = toDateKey(d);
    onChange(key);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  // Presets
  function setQuick(daysToAdd: number) {
    const target = new Date(today);
    target.setDate(today.getDate() + daysToAdd);
    handleSelect(target);
  }

  function setNextMonday() {
    const target = new Date(today);
    const day = target.getDay(); // 0 is Sun, 1 is Mon
    const daysUntilNextMon = ((8 - day) % 7) || 7;
    target.setDate(target.getDate() + daysUntilNextMon);
    handleSelect(target);
  }

  const monthLabel = viewDate.toLocaleDateString([], { month: "long", year: "numeric" });

  return (
    <div className={cn("date-picker-wrap", className)} ref={containerRef}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn("date-picker-trigger", open && "is-open", value && "has-value")}
      >
        <span className="date-picker-trigger__icon">
          <Icons.CalendarDays size={15} />
        </span>
        <span className={cn("date-picker-trigger__label", !value && "is-placeholder")}>
          {value ? formatHuman(value) : placeholder}
        </span>
        {value && !disabled ? (
          <button
            type="button"
            className="date-picker-trigger__clear"
            onClick={handleClear}
            title="Clear date"
            aria-label="Clear date"
          >
            <Icons.X size={13} />
          </button>
        ) : (
          <Icons.ChevronDown size={14} className="date-picker-trigger__chevron" />
        )}
      </button>

      {open ? (
        <div className="date-picker-popover" role="dialog" aria-label="Calendar date picker">
          {/* Quick Preset Buttons */}
          <div className="date-picker-presets">
            <button type="button" onClick={() => setQuick(0)}>Today</button>
            <button type="button" onClick={() => setQuick(1)}>Tomorrow</button>
            <button type="button" onClick={setNextMonday}>Next Mon</button>
            <button type="button" onClick={() => setQuick(7)}>+1 Week</button>
            {value ? (
              <button type="button" className="date-picker-preset--clear" onClick={handleClear}>
                Clear
              </button>
            ) : null}
          </div>

          {/* Month Header */}
          <div className="date-picker-header">
            <button
              type="button"
              className="date-picker-nav-btn"
              onClick={prevMonth}
              aria-label="Previous month"
            >
              <Icons.ChevronLeft size={15} />
            </button>
            <button
              type="button"
              className="date-picker-month-title"
              onClick={goToToday}
              title="Jump to today"
            >
              <strong>{monthLabel}</strong>
            </button>
            <button
              type="button"
              className="date-picker-nav-btn"
              onClick={nextMonth}
              aria-label="Next month"
            >
              <Icons.ChevronRight size={15} />
            </button>
          </div>

          {/* Weekday labels */}
          <div className="date-picker-weekdays" aria-hidden="true">
            {WEEKDAYS.map((wd) => (
              <span key={wd}>{wd}</span>
            ))}
          </div>

          {/* 42-day Calendar Grid */}
          <div className="date-picker-grid" role="grid">
            {days.map((d) => {
              const dKey = toDateKey(d);
              const isCurrentMonth = d.getMonth() === month;
              const isSelected = dKey === value;
              const isToday = dKey === todayKey;

              return (
                <button
                  key={dKey}
                  type="button"
                  onClick={() => handleSelect(d)}
                  className={cn(
                    "date-picker-cell",
                    !isCurrentMonth && "is-outside",
                    isToday && "is-today",
                    isSelected && "is-selected"
                  )}
                  aria-label={d.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}
                  aria-pressed={isSelected}
                >
                  <span className="date-picker-cell__number">{d.getDate()}</span>
                  {isToday && !isSelected ? <span className="date-picker-today-dot" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
