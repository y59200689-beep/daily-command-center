type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number };

function zonedParts(value: Date, timezone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: read("year"), month: read("month"), day: read("day"), hour: read("hour"), minute: read("minute") };
}

function utcValue(parts: ZonedParts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

function zonedTimeToDate(parts: ZonedParts, timezone: string) {
  const desired = utcValue(parts);
  let candidate = desired;
  for (let attempt = 0; attempt < 2; attempt += 1) candidate -= utcValue(zonedParts(new Date(candidate), timezone)) - desired;
  return new Date(candidate);
}

export function nextAutomationRun(type: string, enabled: boolean, schedule: Record<string, unknown>, timezone = "Africa/Casablanca", now = new Date()) {
  if (!enabled) return "Disabled";
  if (["calendar_sync", "strava_sync", "github_sync"].includes(type)) return "Within 15 minutes";
  if (["overdue_invoice_alert", "client_followup_reminder", "subscription_renewal_warning", "content_approval_reminder", "milestone_risk_check", "blocked_commitment_check", "stale_source_check", "topic_review_reminder", "watch_check_reminder", "proposal_followup_review", "lead_reactivation_review", "client_expansion_review", "pipeline_hygiene", "experiment_review", "sop_review_check", "recurring_process_check", "blocked_runs_review", "quality_review", "process_health_review"].includes(type)) return "Based on condition";
  const time = String(schedule.time ?? "08:00");
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return "Based on schedule";
  const days = Array.isArray(schedule.days) ? schedule.days.map(Number) : ["weekly_review", "weekly_knowledge_review", "weekly_growth_review", "weekly_operations_review"].includes(type) ? [Number(schedule.day ?? 0)] : [0, 1, 2, 3, 4, 5, 6];
  if (!days.length) return "Based on schedule";
  const localNow = zonedParts(now, timezone);
  const localMidnight = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day));
  for (let offset = 0; offset < 8; offset += 1) {
    const date = new Date(localMidnight);
    date.setUTCDate(date.getUTCDate() + offset);
    if (!days.includes(date.getUTCDay())) continue;
    const candidate = zonedTimeToDate({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour, minute }, timezone);
    if (candidate > now) return new Intl.DateTimeFormat("en", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(candidate);
  }
  return "Based on schedule";
}

export function automationFields(type: string) {
  if (["morning_brief", "evening_review", "daily_sales_attention", "daily_operations_review"].includes(type)) return ["time", "days"];
  if (["weekly_review", "weekly_planning_reminder", "weekly_knowledge_review", "weekly_growth_review", "weekly_operations_review"].includes(type)) return ["time", "day"];

  if (["monthly_planning_reminder", "quarterly_planning_reminder"].includes(type)) return ["time", "day"];
  if (type === "overdue_invoice_alert") return ["minimum_overdue_days"];
  if (type === "client_followup_reminder") return ["days_without_contact"];
  if (type === "subscription_renewal_warning") return ["lead_days"];
  if (type === "content_approval_reminder") return ["days_in_review"];
  return [];
}
