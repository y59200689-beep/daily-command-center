import type { IntelligenceOverview, WorkspaceSnapshot } from "@/lib/intelligence/types";
import { asNumber, asString, startOfWeek } from "@/lib/intelligence/time";

export function buildEveningReview(snapshot: WorkspaceSnapshot) {
  const todayTasks = snapshot.tasks.filter((task) => asString(task.completed_at).slice(0, 10) === snapshot.today || asString(task.due_date) === snapshot.today);
  const completed = todayTasks.filter((task) => task.status === "completed");
  const focusSeconds = snapshot.focusSessions.filter((session) => asString(session.started_at).slice(0, 10) === snapshot.today).reduce((sum, session) => sum + asNumber(session.duration_seconds), 0);
  const projectIds = new Set([...completed.map((task) => asString(task.project_id)), ...snapshot.focusSessions.filter((session) => asString(session.started_at).slice(0, 10) === snapshot.today).map((session) => asString(session.project_id))].filter(Boolean));
  return {
    date: snapshot.today,
    planned: todayTasks.length,
    completed: completed.length,
    focusMinutes: Math.round(focusSeconds / 60),
    projectsTouched: [...projectIds].map((id) => snapshot.projects.find((project) => project.id === id)).filter(Boolean),
    meetings: snapshot.calendar.filter((event) => asString(event.starts_at).slice(0, 10) === snapshot.today && event.status !== "cancelled"),
    notes: snapshot.notes.filter((note) => asString(note.created_at).slice(0, 10) === snapshot.today),
    decisions: snapshot.decisions.filter((decision) => asString(decision.created_at).slice(0, 10) === snapshot.today),
    moneyReceived: snapshot.payments.filter((payment) => asString(payment.payment_date) === snapshot.today).reduce((sum, payment) => sum + asNumber(payment.amount), 0),
    contentProgressed: snapshot.activity.filter((event) => event.action === "content_status_changed" && asString(event.created_at).slice(0, 10) === snapshot.today).length,
    fitness: snapshot.fitnessActivities.filter((activity) => asString(activity.date ?? activity.activity_date) === snapshot.today),
    carryOver: todayTasks.filter((task) => task.status !== "completed").map((task) => ({ id: task.id, title: asString(task.title) })),
  };
}

export function buildWeeklyReview(snapshot: WorkspaceSnapshot, overview: IntelligenceOverview) {
  const weekStart = startOfWeek(snapshot.today, asNumber(snapshot.profile?.week_starts_on, 1));
  const inWeek = (value: unknown) => asString(value).slice(0, 10) >= weekStart && asString(value).slice(0, 10) <= snapshot.today;
  const completed = snapshot.tasks.filter((task) => task.status === "completed" && inWeek(task.completed_at));
  const focus = snapshot.focusSessions.filter((session) => inWeek(session.started_at));
  const focusSeconds = focus.reduce((sum, session) => sum + asNumber(session.duration_seconds), 0);
  const received = snapshot.payments.filter((payment) => inWeek(payment.payment_date)).reduce((sum, payment) => sum + asNumber(payment.amount), 0);
  const published = snapshot.content.filter((item) => item.status === "published" && inWeek(item.published_at ?? item.publish_date));
  const fitness = snapshot.fitnessActivities.filter((activity) => inWeek(activity.date ?? activity.activity_date));
  const focusByProject = new Map<string, number>();
  for (const session of focus) if (session.project_id) focusByProject.set(asString(session.project_id), (focusByProject.get(asString(session.project_id)) ?? 0) + asNumber(session.duration_seconds));
  const allocation = [...focusByProject.entries()].map(([id, seconds]) => ({ id, name: asString(snapshot.projects.find((project) => project.id === id)?.name, "Unassigned"), minutes: Math.round(seconds / 60), share: focusSeconds ? Math.round(seconds / focusSeconds * 100) : 0 })).sort((a, b) => b.minutes - a.minutes);
  const insights: string[] = [];
  if (allocation[0]?.share >= 50) insights.push(`${allocation[0].name} consumed ${allocation[0].share}% of recorded focus time.`);
  const neglected = overview.projectHealth.find((project) => project.state !== "Healthy" && (project.focusMinutesThisWeek ?? 0) === 0);
  if (neglected) insights.push(`${neglected.name} received no recorded focus time and ${neglected.reasons[0]?.toLowerCase()}.`);
  if (overview.finance.overdueAmount) insights.push(`${overview.finance.overdueAmount.toLocaleString("en")} MAD remains overdue.`);
  const postponed = snapshot.activity.filter((event) => event.action === "task_postponed" && inWeek(event.created_at));
  if (postponed.length) insights.push(`${postponed.length} task postponement${postponed.length === 1 ? " was" : "s were"} recorded.`);
  return {
    periodStart: weekStart,
    periodEnd: snapshot.today,
    metrics: { tasksCompleted: completed.length, focusMinutes: Math.round(focusSeconds / 60), moneyReceived: received, overdueAmount: overview.finance.overdueAmount, contentPublished: published.length, fitnessSessions: fitness.length, fitnessDistanceKm: fitness.reduce((sum, item) => sum + asNumber(item.distance_km, asNumber(item.distance_meters) / 1000), 0) },
    allocation,
    wins: completed.slice(0, 5).map((task) => asString(task.title)),
    risks: overview.risks.slice(0, 5),
    unfinished: snapshot.tasks.filter((task) => !["completed", "cancelled"].includes(asString(task.status)) && task.due_date && asString(task.due_date) <= snapshot.today).slice(0, 8).map((task) => ({ id: task.id, title: asString(task.title), dueDate: asString(task.due_date) })),
    recommendations: overview.recommendations.slice(0, 5),
    insights,
  };
}
