import type { CalendarSnapshot } from "@/lib/v4";

export type CalendarConflictDisplayType =
  | "concurrent_edit"
  | "external_deleted"
  | "remote_changed_before_local_delete"
  | "manual_review";

export type ScheduleItem = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  all_day?: boolean;
  timezone?: string | null;
  source: "google" | "local" | "focus" | "daily_plan";
  source_record_id?: string;
};

export type ScheduleOverlap = {
  id: string;
  firstId: string;
  secondId: string;
  first: ScheduleItem;
  second: ScheduleItem;
  overlapMinutes: number;
  versionKey: string;
};

const comparableFields: Array<keyof CalendarSnapshot> = [
  "title",
  "description",
  "start",
  "end",
  "all_day",
  "timezone",
  "recurrence",
  "recurring_event_id",
  "original_start_time",
];

export function calendarConflictDisplayType(conflictType: string, localDeleteIntent = false): CalendarConflictDisplayType {
  if (localDeleteIntent) return "remote_changed_before_local_delete";
  if (conflictType === "sync_conflict" || conflictType === "concurrent_edit") return "concurrent_edit";
  if (conflictType === "external_deleted") return "external_deleted";
  return "manual_review";
}

export function conflictFieldDifferences(local: CalendarSnapshot, remote: CalendarSnapshot) {
  return comparableFields.filter((field) => local[field] !== remote[field]);
}

export function recurrenceScope(snapshot: CalendarSnapshot | null) {
  if (!snapshot?.recurrence && !snapshot?.recurring_event_id) return "Single event";
  return snapshot.recurring_event_id || snapshot.original_start_time ? "This occurrence" : "Entire series";
}

export function recurrenceIdentityIsAmbiguous(base: CalendarSnapshot | null, remote: CalendarSnapshot | null) {
  if (!base || !remote) return false;
  return base.recurring_event_id !== remote.recurring_event_id || base.original_start_time !== remote.original_start_time;
}

export function calendarSourceLabel(source: ScheduleItem["source"]) {
  return source === "google" ? "Google Calendar" : source === "focus" ? "Focus" : source === "daily_plan" ? "Daily Plan" : "Local Calendar";
}

export function scheduleOverlapVersionKey(first: ScheduleItem, second: ScheduleItem) {
  return [first.id, first.starts_at, first.ends_at, second.id, second.starts_at, second.ends_at].join("|");
}

export function detectScheduleOverlaps(items: ScheduleItem[]): ScheduleOverlap[] {
  const sorted = [...items].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const conflicts: ScheduleOverlap[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    for (let candidateIndex = index + 1; candidateIndex < sorted.length; candidateIndex += 1) {
      const first = sorted[index];
      const second = sorted[candidateIndex];
      const firstStart = new Date(first.starts_at).getTime();
      const firstEnd = new Date(first.ends_at).getTime();
      const secondStart = new Date(second.starts_at).getTime();
      const secondEnd = new Date(second.ends_at).getTime();
      if (secondStart >= firstEnd) break;
      if (firstStart >= secondEnd || first.source !== "google" && second.source !== "google" && first.source !== "local" && second.source !== "local") continue;
      const versionKey = scheduleOverlapVersionKey(first, second);
      conflicts.push({ id: versionKey, firstId: first.id, secondId: second.id, first, second, overlapMinutes: Math.round((Math.min(firstEnd, secondEnd) - Math.max(firstStart, secondStart)) / 60_000), versionKey });
    }
  }
  return conflicts;
}

export function nearTermCalendarConflict<T extends { local_event?: Record<string, unknown> | null; conflict_detected_at?: string | null }>(conflicts: T[], now: Date, hours = 24) {
  const horizon = now.getTime() + hours * 60 * 60 * 1000;
  return conflicts.find((conflict) => {
    const startsAt = conflict.local_event?.starts_at;
    if (!startsAt) return false;
    const start = new Date(String(startsAt)).getTime();
    return start >= now.getTime() - 60 * 60 * 1000 && start <= horizon;
  }) ?? null;
}

export function planBlockConflicts(blocks: Array<{ startsAt: string; endsAt: string; title: string; kind: string }>, existing: ScheduleItem[]) {
  const proposed = blocks.filter((block) => block.kind !== "meeting").map((block, index): ScheduleItem => ({ id: `proposed:${index}:${block.startsAt}`, title: block.title, starts_at: block.startsAt, ends_at: block.endsAt, source: "daily_plan" }));
  const proposedIds = new Set(proposed.map((item) => item.id));
  return detectScheduleOverlaps([...existing, ...proposed]).filter((conflict) => proposedIds.has(conflict.firstId) || proposedIds.has(conflict.secondId));
}
