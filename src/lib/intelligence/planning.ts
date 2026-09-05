import type { Capacity, DailyPlan, FocusWindow, Recommendation, WorkspaceSnapshot } from "@/lib/intelligence/types";
import { asNumber, asString, clamp, minutesBetween, startOfWeek } from "@/lib/intelligence/time";

function zonedTime(day: string, time: string, timezone: string) {
  const probe = new Date(`${day}T12:00:00Z`);
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "longOffset", hour: "2-digit" }).formatToParts(probe).find((part) => part.type === "timeZoneName")?.value.replace("GMT", "") || "+00:00";
  return new Date(`${day}T${time.slice(0, 8)}${zone}`);
}

function relevantEvents(snapshot: WorkspaceSnapshot, start: Date, end: Date) {
  return snapshot.calendar.filter((event) => event.status !== "cancelled" && new Date(asString(event.ends_at)) > start && new Date(asString(event.starts_at)) < end).sort((a, b) => asString(a.starts_at).localeCompare(asString(b.starts_at)));
}

export function getAvailableFocusWindows(snapshot: WorkspaceSnapshot, minimumMinutes = 25): FocusWindow[] {
  const workStart = zonedTime(snapshot.today, asString(snapshot.profile?.workday_start, "09:00:00"), snapshot.timezone);
  const workEnd = zonedTime(snapshot.today, asString(snapshot.profile?.workday_end, "18:00:00"), snapshot.timezone);
  const now = new Date(snapshot.now);
  let cursor = now > workStart ? now : workStart;
  const windows: FocusWindow[] = [];
  for (const event of relevantEvents(snapshot, workStart, workEnd)) {
    const eventStart = new Date(asString(event.starts_at));
    const eventEnd = new Date(asString(event.ends_at));
    if (eventStart > cursor && minutesBetween(cursor.toISOString(), eventStart.toISOString()) >= minimumMinutes) {
      const minutes = minutesBetween(cursor.toISOString(), eventStart.toISOString());
      windows.push({ startsAt: cursor.toISOString(), endsAt: eventStart.toISOString(), minutes, label: `${formatTime(cursor, snapshot.timezone)}–${formatTime(eventStart, snapshot.timezone)}` });
    }
    if (eventEnd > cursor) cursor = eventEnd;
  }
  if (workEnd > cursor && minutesBetween(cursor.toISOString(), workEnd.toISOString()) >= minimumMinutes) {
    const minutes = minutesBetween(cursor.toISOString(), workEnd.toISOString());
    windows.push({ startsAt: cursor.toISOString(), endsAt: workEnd.toISOString(), minutes, label: `${formatTime(cursor, snapshot.timezone)}–${formatTime(workEnd, snapshot.timezone)}` });
  }
  return windows;
}

export function calculateCapacity(snapshot: WorkspaceSnapshot): Capacity {
  const workStart = zonedTime(snapshot.today, asString(snapshot.profile?.workday_start, "09:00:00"), snapshot.timezone);
  const workEnd = zonedTime(snapshot.today, asString(snapshot.profile?.workday_end, "18:00:00"), snapshot.timezone);
  const now = new Date(snapshot.now);
  const effectiveStart = now > workStart ? now : workStart;
  const capacityMinutes = minutesBetween(effectiveStart.toISOString(), workEnd.toISOString());
  const meetingMinutes = relevantEvents(snapshot, effectiveStart, workEnd).reduce((sum, event) => sum + minutesBetween(asString(event.starts_at), asString(event.ends_at)), 0);
  const availableFocusMinutes = Math.max(0, capacityMinutes - meetingMinutes);
  const highPriorityMinutes = snapshot.tasks.filter((task) => !["completed", "cancelled"].includes(asString(task.status)) && (["urgent", "high"].includes(asString(task.priority)) || (task.due_date && asString(task.due_date) <= snapshot.today))).reduce((sum, task) => sum + asNumber(task.estimated_minutes, 30), 0);
  const overcommittedMinutes = Math.max(0, highPriorityMinutes - availableFocusMinutes);
  const insight = overcommittedMinutes > 0 ? `You are overcommitted by approximately ${duration(overcommittedMinutes)}.` : `Your high-priority work fits inside today's estimated focus capacity with ${duration(availableFocusMinutes - highPriorityMinutes)} to spare.`;
  return { capacityMinutes, meetingMinutes, availableFocusMinutes, highPriorityMinutes, overcommittedMinutes, insight };
}

export function generateDailyPlan(snapshot: WorkspaceSnapshot, recommendations: Recommendation[]): DailyPlan {
  const windows = getAvailableFocusWindows(snapshot);
  const taskRecommendations = recommendations.filter((item) => item.entityType === "task");
  const wins = taskRecommendations.filter((item, index, all) => all.findIndex((candidate) => candidate.entityId === item.entityId) === index).slice(0, 3);
  const blocks: DailyPlan["blocks"] = snapshot.calendar.filter((event) => asString(event.starts_at).slice(0, 10) === snapshot.today && event.status !== "cancelled").map((event) => ({ startsAt: asString(event.starts_at), endsAt: asString(event.ends_at), minutes: minutesBetween(asString(event.starts_at), asString(event.ends_at)), label: `${formatTime(new Date(asString(event.starts_at)), snapshot.timezone)}–${formatTime(new Date(asString(event.ends_at)), snapshot.timezone)}`, title: asString(event.title), kind: "meeting" as const }));
  let windowIndex = 0;
  let cursor = windows[0] ? new Date(windows[0].startsAt) : null;
  for (const win of wins) {
    while (windows[windowIndex] && cursor && cursor >= new Date(windows[windowIndex].endsAt)) { windowIndex += 1; cursor = windows[windowIndex] ? new Date(windows[windowIndex].startsAt) : null; }
    const window = windows[windowIndex];
    if (!window || !cursor) break;
    const task = snapshot.tasks.find((item) => item.id === win.entityId);
    const requested = clamp(asNumber(task?.estimated_minutes, 45), 25, 120);
    const available = minutesBetween(cursor.toISOString(), window.endsAt);
    if (available < 25) continue;
    const minutes = Math.min(requested, available);
    const ends = new Date(cursor.getTime() + minutes * 60_000);
    blocks.push({ startsAt: cursor.toISOString(), endsAt: ends.toISOString(), minutes, label: `${formatTime(cursor, snapshot.timezone)}–${formatTime(ends, snapshot.timezone)}`, taskId: win.entityId, title: win.label, kind: "focus" });
    cursor = new Date(ends.getTime() + 10 * 60_000);
  }
  const followups = recommendations.filter((item) => ["client", "waiting", "invoice"].includes(item.entityType)).slice(0, 3);
  const capacity = calculateCapacity(snapshot);
  const defer = capacity.overcommittedMinutes > 0 ? snapshot.tasks.filter((task) => !["completed", "cancelled"].includes(asString(task.status)) && ["none", "low"].includes(asString(task.priority))).sort((a, b) => asString(b.due_date, "9999").localeCompare(asString(a.due_date, "9999"))).slice(0, 3).map((task) => ({ id: task.id, title: asString(task.title), reason: "Lower priority or impact than today's available capacity" })) : [];
  const weekStart = startOfWeek(snapshot.today, asNumber(snapshot.profile?.week_starts_on, 1));
  const target = snapshot.fitnessTargets.find((item) => item.active !== false);
  const completed = target ? snapshot.fitnessActivities.filter((item) => item.activity_type === target.activity_type && asString(item.date ?? item.activity_date) >= weekStart).length : 0;
  const workout = target && asString(target.target_type) === "sessions" && completed < asNumber(target.target_value) ? { label: `${asString(target.activity_type)} session`, reason: `${asNumber(target.target_value) - completed} session${asNumber(target.target_value) - completed === 1 ? "" : "s"} remain this week` } : null;
  if (workout && windows.at(-1)?.minutes && windows.at(-1)!.minutes >= 45) {
    const window = windows.at(-1)!;
    const starts = new Date(new Date(window.endsAt).getTime() - 45 * 60_000);
    blocks.push({ startsAt: starts.toISOString(), endsAt: window.endsAt, minutes: 45, label: `${formatTime(starts, snapshot.timezone)}–${formatTime(new Date(window.endsAt), snapshot.timezone)}`, title: workout.label, kind: "fitness" });
  }
  return { date: snapshot.today, generatedAt: snapshot.now, wins, blocks: blocks.sort((a, b) => a.startsAt.localeCompare(b.startsAt)), defer, followups, workout, capacity };
}

export function duration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return hours ? `${hours}h${rest ? ` ${rest}m` : ""}` : `${rest}m`;
}

function formatTime(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(date);
}
