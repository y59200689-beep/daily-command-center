export type StrategicItem = { id: string; title: string; targetDate?: string | null; priority?: number | null; status?: string | null; value?: number | null; blocked?: boolean; confidence?: number | null; domain?: string; route?: string };

export function strategicPriority(item: StrategicItem, today = new Date().toISOString().slice(0, 10)) {
  const days = item.targetDate ? Math.floor((Date.parse(`${item.targetDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000) : null;
  const deadline = days === null ? 0 : days < 0 ? 42 : Math.max(0, 30 - days);
  const blocked = item.blocked ? 35 : 0;
  const risk = item.status === "at_risk" ? 24 : 0;
  const importance = Math.max(0, Math.min(5, item.priority ?? 3)) * 7;
  const value = Math.min(20, Math.max(0, Number(item.value ?? 0) / 1000));
  const confidence = Math.round(Math.max(0, Math.min(1, item.confidence ?? 1)) * 8);
  return Math.round(deadline + blocked + risk + importance + value + confidence);
}

export function rankStrategicItems(items: StrategicItem[], today?: string) {
  return [...items].sort((a, b) => strategicPriority(b, today) - strategicPriority(a, today) || a.title.localeCompare(b.title));
}

export function capacityState(input: { commitments: number; deadlines: number; meetingHours?: number | null; availableHours?: number | null }) {
  if (input.availableHours == null || input.meetingHours == null) return { state: "unavailable" as const, reason: "Capacity estimate unavailable." };
  const load = input.commitments + input.deadlines + input.meetingHours / Math.max(1, input.availableHours);
  const state = load >= 10 ? "overcommitted" : load >= 7 ? "heavy" : load >= 4 ? "balanced" : "light";
  return { state, reason: `${input.commitments} active commitments, ${input.deadlines} hard deadlines, and ${Math.round(input.meetingHours)} hours of scheduled meetings.` } as const;
}

export function horizonFor(date: string | null | undefined, today = new Date().toISOString().slice(0, 10)) {
  if (!date) return null;
  const days = Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (days < 0 || days > 90) return null;
  return days <= 30 ? 30 : days <= 60 ? 60 : 90;
}
