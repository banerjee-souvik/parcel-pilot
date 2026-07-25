"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const WINDOW_LABEL: Record<string, string> = {
  "09:00-13:00": "9 AM – 1 PM",
  "13:00-18:00": "1 PM – 6 PM",
};

function dayParts(dateStr: string): { weekday: string; day: string } {
  const d = new Date(`${dateStr}T00:00:00`);
  return {
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d),
    day: String(d.getDate()),
  };
}

// Tapping a date + window composes the equivalent natural-language message rather than skipping
// the model — see design.md: "chat is for intent, widgets are for precision," not a bypass.
export function DatePickerCard({
  dates,
  windows,
  onSelect,
}: {
  dates: string[];
  windows: readonly string[];
  onSelect: (message: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function commit(date: string | null, window: string | null) {
    if (!date || !window || submitted) return;
    const label = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(
      new Date(`${date}T00:00:00`)
    );
    setSubmitted(true);
    onSelect(`${label}, ${WINDOW_LABEL[window] ?? window} please`);
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex gap-2">
        {dates.slice(0, 4).map((date) => {
          const { weekday, day } = dayParts(date);
          const isSelected = selectedDate === date;
          return (
            <button
              key={date}
              type="button"
              disabled={submitted}
              onClick={() => {
                setSelectedDate(date);
                commit(date, selectedWindow);
              }}
              className={cn(
                "flex w-full flex-col items-center gap-0.5 rounded-xl border py-2.5 disabled:cursor-default",
                isSelected ? "border-accent bg-accent" : "border-border bg-bg hover:bg-bg-subtle"
              )}
            >
              <span className={cn("text-xs font-medium", isSelected ? "text-[#C7D2FE]" : "text-text-secondary")}>
                {weekday}
              </span>
              <span className={cn("text-[17px] font-semibold", isSelected ? "text-white" : "text-text-primary")}>
                {day}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        {windows.map((window) => {
          const isSelected = selectedWindow === window;
          return (
            <button
              key={window}
              type="button"
              disabled={submitted}
              onClick={() => {
                setSelectedWindow(window);
                commit(selectedDate, window);
              }}
              className={cn(
                "w-full rounded-[10px] border py-2.5 text-[13px] font-medium disabled:cursor-default",
                isSelected ? "border-accent bg-accent-soft text-accent" : "border-border bg-bg text-text-secondary hover:bg-bg-subtle"
              )}
            >
              {WINDOW_LABEL[window] ?? window}
            </button>
          );
        })}
      </div>
    </div>
  );
}
