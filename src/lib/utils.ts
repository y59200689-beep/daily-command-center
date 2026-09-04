import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function minutesLabel(minutes?: number) {
  if (!minutes) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function classifyCapture(value: string) {
  const normalized = value.trim();
  const first = normalized.split(/\s+/)[0]?.toLowerCase();
  const types = ["task", "note", "idea", "reminder", "decision"] as const;
  const type = types.find((candidate) => candidate === first) ?? "task";
  const text = types.includes(first as (typeof types)[number])
    ? normalized.slice(first.length).trim()
    : normalized;
  return { type, text };
}

export function safeRedirectPath(value: string | null, fallback = "/today") {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
