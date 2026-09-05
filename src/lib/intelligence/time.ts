export const DAY_MS = 86_400_000;

export function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function dateOnly(value: Date | string) {
  return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  const fromTime = new Date(`${from.slice(0, 10)}T12:00:00Z`).getTime();
  const toTime = new Date(`${to.slice(0, 10)}T12:00:00Z`).getTime();
  return Math.round((toTime - fromTime) / DAY_MS);
}

export function minutesBetween(start: string, end: string) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000));
}

export function startOfWeek(day: string, weekStartsOn = 1) {
  const date = new Date(`${day}T12:00:00Z`);
  const delta = (date.getUTCDay() - weekStartsOn + 7) % 7;
  date.setUTCDate(date.getUTCDate() - delta);
  return dateOnly(date);
}

export function endOfWeek(day: string, weekStartsOn = 1) {
  const start = new Date(`${startOfWeek(day, weekStartsOn)}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() + 6);
  return dateOnly(start);
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function severityFromScore(score: number) {
  if (score >= 88) return "critical" as const;
  if (score >= 70) return "high" as const;
  if (score >= 48) return "medium" as const;
  return "low" as const;
}
