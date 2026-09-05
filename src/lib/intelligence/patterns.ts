import type { Pattern, Prediction, WorkspaceSnapshot } from "@/lib/intelligence/types";
import { asNumber, asString, daysBetween } from "@/lib/intelligence/time";

const MIN_PATTERN_SAMPLE = 8;
const MIN_PREDICTION_SAMPLE = 5;

function confidence(sampleSize: number) {
  return sampleSize >= 20 ? "strong" as const : sampleSize >= 12 ? "moderate" as const : "limited" as const;
}

export function detectPatterns(snapshot: WorkspaceSnapshot): Pattern[] {
  const patterns: Pattern[] = [];
  const estimated = snapshot.tasks.filter((task) => task.status === "completed" && asNumber(task.estimated_minutes) > 0 && asNumber(task.actual_minutes) > 0);
  if (estimated.length >= MIN_PATTERN_SAMPLE) {
    const estimate = estimated.reduce((sum, task) => sum + asNumber(task.estimated_minutes), 0);
    const actual = estimated.reduce((sum, task) => sum + asNumber(task.actual_minutes), 0);
    const bias = Math.round(((actual - estimate) / estimate) * 100);
    if (Math.abs(bias) >= 10) patterns.push({ key: "task_estimation_bias", title: "Task estimation", statement: bias > 0 ? `Completed work has taken ${bias}% longer than estimated.` : `Completed work has taken ${Math.abs(bias)}% less time than estimated.`, sampleSize: estimated.length, confidence: confidence(estimated.length), evidence: [{ label: `${estimate} minutes estimated` }, { label: `${actual} minutes recorded` }] });
  }

  if (snapshot.focusSessions.length >= MIN_PATTERN_SAMPLE) {
    const byHour = new Map<number, { count: number; completed: number }>();
    for (const session of snapshot.focusSessions) {
      const hour = new Date(asString(session.started_at)).getUTCHours();
      const bucket = byHour.get(hour) ?? { count: 0, completed: 0 };
      bucket.count += 1;
      if (asNumber(session.duration_seconds) >= 25 * 60) bucket.completed += 1;
      byHour.set(hour, bucket);
    }
    const best = [...byHour.entries()].filter(([, value]) => value.count >= 3).sort((a, b) => b[1].completed / b[1].count - a[1].completed / a[1].count)[0];
    if (best) patterns.push({ key: "best_focus_hour", title: "Focus rhythm", statement: `${String(best[0]).padStart(2, "0")}:00 has your strongest recorded focus-session completion rate.`, sampleSize: snapshot.focusSessions.length, confidence: confidence(snapshot.focusSessions.length), evidence: [{ label: `${best[1].completed} of ${best[1].count} sessions reached 25 minutes` }] });
  }

  const postponements = snapshot.activity.filter((event) => event.action === "task_postponed");
  if (postponements.length >= MIN_PATTERN_SAMPLE) {
    const byProject = new Map<string, number>();
    for (const event of postponements) {
      const metadata = event.metadata as Record<string, unknown> | null;
      const projectId = asString(metadata?.project_id, "unassigned");
      byProject.set(projectId, (byProject.get(projectId) ?? 0) + 1);
    }
    const [projectId, count] = [...byProject.entries()].sort((a, b) => b[1] - a[1])[0];
    const project = snapshot.projects.find((item) => item.id === projectId);
    patterns.push({ key: "repeated_postponement", title: "Repeated postponement", statement: `${project ? asString(project.name) : "Unassigned work"} accounts for ${count} recorded postponements.`, sampleSize: postponements.length, confidence: confidence(postponements.length), evidence: [{ label: `Based on ${postponements.length} postponement events` }] });
  }

  const approvalDurations = snapshot.content.filter((item) => item.approved_at && item.created_at).map((item) => (new Date(asString(item.approved_at)).getTime() - new Date(asString(item.created_at)).getTime()) / 86_400_000).filter((value) => value >= 0);
  if (approvalDurations.length >= MIN_PATTERN_SAMPLE) {
    const average = approvalDurations.reduce((sum, value) => sum + value, 0) / approvalDurations.length;
    patterns.push({ key: "content_approval_delay", title: "Content approval timing", statement: `Recorded content approval takes ${average.toFixed(1)} days on average.`, sampleSize: approvalDurations.length, confidence: confidence(approvalDurations.length), evidence: [{ label: `Based on ${approvalDurations.length} approved content items` }] });
  }
  return patterns;
}

export function generatePredictions(snapshot: WorkspaceSnapshot): Prediction[] {
  const predictions: Prediction[] = [];
  for (const project of snapshot.projects.filter((item) => item.status === "active" && item.target_date)) {
    const completed = snapshot.tasks.filter((task) => task.project_id === project.id && task.status === "completed" && task.completed_at);
    const open = snapshot.tasks.filter((task) => task.project_id === project.id && !["completed", "cancelled"].includes(asString(task.status)));
    if (completed.length < MIN_PREDICTION_SAMPLE || open.length < 2) continue;
    const daysRemaining = daysBetween(snapshot.today, asString(project.target_date));
    const historyDays = Math.max(7, daysBetween(asString(completed.sort((a, b) => asString(a.completed_at).localeCompare(asString(b.completed_at)))[0].completed_at), snapshot.today));
    const dailyVelocity = completed.length / historyDays;
    const requiredDays = open.length / Math.max(0.1, dailyVelocity);
    if (requiredDays <= daysRemaining) continue;
    const slip = Math.ceil(requiredDays - Math.max(0, daysRemaining));
    predictions.push({ key: `project:${project.id}:slip`, entityType: "project", entityId: project.id, statement: `At the recorded completion pace, ${asString(project.name)} may slip by approximately ${Math.max(1, slip - 1)}–${slip + 1} days.`, confidence: confidence(completed.length), sampleSize: completed.length, assumptions: ["Open task count is a useful proxy for remaining work", "Recent completion pace continues", "Task scope does not materially change"], evidence: [{ label: `${completed.length} tasks completed over ${historyDays} days`, sourceEntityType: "project", sourceEntityId: project.id }, { label: `${open.length} open tasks remain`, sourceEntityType: "project", sourceEntityId: project.id }] });
  }

  for (const client of snapshot.clients) {
    const paid = snapshot.invoices.filter((invoice) => invoice.client_id === client.id && invoice.paid_at && invoice.due_date);
    if (paid.length < MIN_PREDICTION_SAMPLE) continue;
    const delays = paid.map((invoice) => Math.max(0, daysBetween(asString(invoice.due_date), asString(invoice.paid_at))));
    const average = delays.reduce((sum, value) => sum + value, 0) / delays.length;
    const open = snapshot.invoices.find((invoice) => invoice.client_id === client.id && !["paid", "cancelled"].includes(asString(invoice.status)) && invoice.due_date);
    if (!open || average < 2) continue;
    predictions.push({ key: `invoice:${open.id}:payment`, entityType: "invoice", entityId: open.id, statement: `${asString(client.name)} may pay this invoice around ${Math.round(average)} days after its due date if prior timing continues.`, confidence: confidence(paid.length), sampleSize: paid.length, assumptions: ["Past payment timing remains representative", "No new payment arrangement applies"], evidence: [{ label: `Average delay ${average.toFixed(1)} days`, sourceEntityType: "client", sourceEntityId: client.id }, { label: `Based on ${paid.length} paid invoices`, sourceEntityType: "client", sourceEntityId: client.id }] });
  }
  return predictions;
}

export { MIN_PATTERN_SAMPLE, MIN_PREDICTION_SAMPLE };
