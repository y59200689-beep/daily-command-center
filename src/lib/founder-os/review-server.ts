import type { SupabaseClient } from "@supabase/supabase-js";
import type { Row } from "./repository";
import { attentionReview, trainingReview, monthlyWealth } from "./review";
export async function loadFounderReview(client: SupabaseClient, userId: string, today: string, period: "week" | "month" | "quarter" = "week") {
  const start = new Date(`${today}T00:00:00Z`);
  if (period === "week") start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  else { start.setUTCDate(1); if (period === "quarter") start.setUTCMonth(Math.floor(start.getUTCMonth() / 3) * 3); }
  const startDate = start.toISOString().slice(0, 10);
  const activityStart = new Date(`${today}T00:00:00Z`); activityStart.setUTCDate(activityStart.getUTCDate() - 35);
  const specs = {
    sessions: client.from("focus_sessions").select("id,task_id,started_at,ended_at,duration_seconds,category").eq("user_id", userId).gte("started_at", startDate).order("started_at", { ascending: false }),
    tasks: client.from("tasks").select("id,title,priority,recurrence_frequency,goal_id,project_id").eq("user_id", userId).is("deleted_at", null),
    activities: client.from("fitness_activities").select("id,activity_type,date,duration_minutes,perceived_exertion").eq("user_id", userId).is("deleted_at", null).gte("date", activityStart.toISOString().slice(0, 10)),
    observations: client.from("training_observations").select("*").eq("user_id", userId).gte("observed_on", activityStart.toISOString().slice(0, 10)),
    plans: client.from("training_plans").select("*").eq("user_id", userId).eq("status", "active"),
    wealth: client.from("personal_balance_history").select("*").eq("user_id", userId).lte("valued_on", today).order("valued_on", { ascending: false }),
    lessons: client.from("operating_lessons").select("id,title,statement,status,created_at").eq("user_id", userId).gte("created_at", startDate).in("status", ["proposed", "accepted", "needs_review"]).order("created_at", { ascending: false }),
  };
  const data: Record<string, Row[]> = {}, limitations: string[] = [];
  await Promise.all(Object.entries(specs).map(async ([key, query]) => {
    const { data: rows, error } = await query.limit(1001);
    if (error || (rows?.length ?? 0) > 1000) { limitations.push(`${key}: ${error ? "unavailable" : "more than 1,000 records; totals omitted"}`); data[key] = []; }
    else data[key] = (rows ?? []) as Row[];
  }));
  const available = (...keys: string[]) => !limitations.some(l => keys.some(k => l.startsWith(`${k}:`)));
  return { period, today, start: startDate, limitations, attention: available("sessions", "tasks") ? attentionReview(data.sessions, data.tasks, startDate, today) : null, training: available("activities", "observations", "plans") ? trainingReview(data.activities, data.observations, data.plans, today) : null, wealth: available("wealth") ? monthlyWealth(data.wealth) : null, lessons: data.lessons.slice(0, 10), sessions: data.sessions.slice(0, 30) };
}
export type FounderReview = Awaited<ReturnType<typeof loadFounderReview>>;
