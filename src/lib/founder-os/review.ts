import type { Row } from "./repository";
import { daysUntil, numberOrNull } from "./intelligence";
export const timeCategories = ["deep_work", "meetings", "admin", "engineering", "operations", "customer", "marketing", "finance", "travel", "fitness", "reactive"] as const;
export function attentionReview(sessions: Row[], tasks: Row[], start: string, end: string) {
  const recorded = sessions.filter(s => String(s.started_at).slice(0, 10) >= start && String(s.started_at).slice(0, 10) <= end && s.ended_at && numberOrNull(s.duration_seconds) !== null);
  const categories: Record<string, number> = {};
  for (const session of recorded) { const category = String(session.category || "unclassified"); categories[category] = (categories[category] ?? 0) + Number(session.duration_seconds) / 3600; }
  const suggestions = tasks.filter(t => ["low", "none"].includes(String(t.priority)) && t.recurrence_frequency).flatMap(task => {
    const linked = recorded.filter(s => s.task_id === task.id), hours = linked.reduce((n, s) => n + Number(s.duration_seconds) / 3600, 0);
    return linked.length >= 5 && hours >= 2 ? [{ id: task.id, title: String(task.title), reason: `${hours.toFixed(1)} logged hours across ${linked.length} focus sessions on a recurring, low-priority task.`, action: "Review an SOP, delegation or automation opportunity" }] : [];
  });
  const unaligned = recorded.filter(s => tasks.some(t => t.id === s.task_id && !t.goal_id && !t.project_id)).reduce((n, s) => n + Number(s.duration_seconds) / 3600, 0);
  return { categories, recordedHours: Object.values(categories).reduce((a, b) => a + b, 0), sessions: recorded.length, unalignedHours: unaligned, suggestions, start, end };
}
export function trainingReview(activities: Row[], observations: Row[], plans: Row[], today: string) {
  const date = new Date(`${today}T00:00:00Z`), weekday = (date.getUTCDay() + 6) % 7;
  const weekStart = new Date(date); weekStart.setUTCDate(date.getUTCDate() - weekday);
  const start = weekStart.toISOString().slice(0, 10);
  const previousStart = new Date(weekStart); previousStart.setUTCDate(previousStart.getUTCDate() - 7);
  const previousEnd = new Date(date); previousEnd.setUTCDate(previousEnd.getUTCDate() - 7);
  const occurred = (r: Row) => String(r.date ?? r.activity_date).slice(0, 10);
  const current = activities.filter(r => occurred(r) >= start && occurred(r) <= today);
  const previous = activities.filter(r => occurred(r) >= previousStart.toISOString().slice(0, 10) && occurred(r) <= previousEnd.toISOString().slice(0, 10));
  const minutes = (rows: Row[]) => rows.reduce((n, r) => n + (numberOrNull(r.duration_minutes) ?? (numberOrNull(r.duration_seconds) ?? 0) / 60), 0);
  const volume = minutes(current), previousVolume = minutes(previous), change = previousVolume > 0 ? (volume - previousVolume) / previousVolume * 100 : null;
  const activePlans = plans.filter(r => r.status === "active" && (!r.start_date || String(r.start_date) <= today) && (!r.end_date || String(r.end_date) >= today));
  const plan = activePlans.length === 1 ? activePlans[0] : null;
  const flags: string[] = [];
  const threshold = plan ? numberOrNull(plan.maximum_weekly_increase) : null;
  if (threshold !== null && change !== null && change > threshold) flags.push(`Logged duration increased ${change.toFixed(1)}% over the same weekdays last week, above your ${threshold}% review threshold (${plan!.methodology}).`);
  if (activePlans.length > 1) flags.push("Multiple active plans overlap; choose one methodology before interpreting targets.");
  const latest = observations.filter(r => String(r.observed_on) <= today).sort((a, b) => String(b.observed_on).localeCompare(String(a.observed_on)))[0];
  const sleepThreshold = plan ? numberOrNull(plan.minimum_sleep_hours) : null;
  if (latest && daysUntil(latest.observed_on, today)! >= -2 && sleepThreshold !== null && numberOrNull(latest.sleep_hours) !== null && Number(latest.sleep_hours) < sleepThreshold) flags.push(`Sleep observation ${latest.sleep_hours}h on ${latest.observed_on} is below your ${sleepThreshold}h review threshold.`);
  const weighted = current.filter(r => numberOrNull(r.perceived_exertion) !== null && (numberOrNull(r.duration_minutes) !== null || numberOrNull(r.duration_seconds) !== null));
  const load = weighted.length ? weighted.reduce((n, r) => n + Number(r.perceived_exertion) * (numberOrNull(r.duration_minutes) ?? Number(r.duration_seconds) / 60), 0) : null;
  const byActivity: Record<string, number> = {};
  for (const row of current) byActivity[String(row.activity_type)] = (byActivity[String(row.activity_type)] ?? 0) + (numberOrNull(row.duration_minutes) ?? (numberOrNull(row.duration_seconds) ?? 0) / 60);
  const weights = observations.filter(r => r.body_weight != null && String(r.observed_on) <= today).sort((a, b) => String(a.observed_on).localeCompare(String(b.observed_on)));
  return { start, today, sessions: current.length, minutes: volume, previousMinutes: previousVolume, change, byActivity, plan: plan ? { name: String(plan.name), methodology: String(plan.methodology), weeklySessions: numberOrNull(plan.weekly_sessions), weeklyMinutes: numberOrNull(plan.weekly_minutes), raceDate: plan.race_date ? String(plan.race_date) : null } : null, flags, load, loadSampleSize: weighted.length, latestObservation: latest ?? null, weightChange: weights.length >= 2 ? Number(weights.at(-1)!.body_weight) - Number(weights[0].body_weight) : null, weightSampleSize: weights.length };
}
export function monthlyWealth(history: Row[]) {
  const months = [...new Set(history.map(r => String(r.valued_on).slice(0, 7)))].sort();
  return months.map(month => {
    const latest = new Map<string, Row>();
    for (const r of [...history].filter(r => String(r.valued_on).slice(0, 7) <= month).sort((a, b) => String(a.valued_on).localeCompare(String(b.valued_on)))) latest.set(String(r.entry_id), r);
    const net: Record<string, number> = {};
    for (const r of latest.values()) net[String(r.currency)] = (net[String(r.currency)] ?? 0) + (r.kind === "liability" ? -1 : 1) * Number(r.amount);
    return { month, net, entries: latest.size };
  });
}
