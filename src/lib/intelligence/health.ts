import { bestForEntity } from "@/lib/intelligence/recommendations";
import type { HealthAssessment, Recommendation, WorkspaceSnapshot } from "@/lib/intelligence/types";
import { asNumber, asString, daysBetween, startOfWeek } from "@/lib/intelligence/time";

function healthState(points: number, blocked: boolean): HealthAssessment["state"] {
  if (blocked) return "Blocked";
  if (points >= 60) return "At Risk";
  if (points >= 25) return "Needs Attention";
  return "Healthy";
}

export function assessProjectHealth(snapshot: WorkspaceSnapshot, recommendations: Recommendation[]): HealthAssessment[] {
  const weekStart = startOfWeek(snapshot.today, asNumber(snapshot.profile?.week_starts_on, 1));
  return snapshot.projects.filter((project) => asString(project.status) === "active").map((project): HealthAssessment => {
    const tasks = snapshot.tasks.filter((task) => task.project_id === project.id && !["completed", "cancelled"].includes(asString(task.status)));
    const overdue = tasks.filter((task) => task.due_date && asString(task.due_date) < snapshot.today);
    const blocked = tasks.filter((task) => task.status === "blocked");
    const milestones = snapshot.milestones.filter((milestone) => milestone.project_id === project.id && milestone.status !== "completed" && asNumber(milestone.progress) < 100);
    const missed = milestones.filter((milestone) => milestone.target_date && asString(milestone.target_date) < snapshot.today);
    const focusSessions = snapshot.focusSessions.filter((session) => session.project_id === project.id && asString(session.started_at).slice(0, 10) >= weekStart);
    const focusMinutes = Math.round(focusSessions.reduce((sum, session) => sum + asNumber(session.duration_seconds), 0) / 60);
    const latestActivity = [asString(project.updated_at), ...focusSessions.map((session) => asString(session.started_at))].filter(Boolean).sort().at(-1);
    const inactiveDays = latestActivity ? Math.max(0, daysBetween(latestActivity, snapshot.today)) : 30;
    const targetIn = project.target_date ? daysBetween(snapshot.today, asString(project.target_date)) : null;
    const reasons: string[] = [];
    if (blocked.length) reasons.push(`${blocked.length} blocked task${blocked.length === 1 ? "" : "s"}`);
    if (overdue.length) reasons.push(`${overdue.length} overdue task${overdue.length === 1 ? "" : "s"}`);
    if (missed.length) reasons.push(`${missed.length} missed milestone${missed.length === 1 ? "" : "s"}`);
    if (inactiveDays >= 5) reasons.push(`No meaningful activity in ${inactiveDays} days`);
    if (targetIn !== null && targetIn <= 7 && asNumber(project.progress) < 70) reasons.push(`Target is near at ${asNumber(project.progress)}% progress`);
    if (!reasons.length) reasons.push(focusMinutes > 0 ? `${focusMinutes} focus minutes logged this week` : "No current delivery risks detected");
    const points = blocked.length * 35 + overdue.length * 15 + missed.length * 22 + (inactiveDays >= 5 ? 18 : 0) + (targetIn !== null && targetIn <= 7 && asNumber(project.progress) < 70 ? 22 : 0);
    const upcomingMilestone = milestones.filter((milestone) => milestone.target_date && asString(milestone.target_date) >= snapshot.today).sort((a, b) => asString(a.target_date).localeCompare(asString(b.target_date)))[0] ?? null;
    return { entityType: "project", entityId: project.id, name: asString(project.name), state: healthState(points, blocked.length > 0), reasons, evidence: [{ label: `${overdue.length} overdue tasks`, sourceEntityType: "project", sourceEntityId: project.id }, { label: `${blocked.length} blocked tasks`, sourceEntityType: "project", sourceEntityId: project.id }, { label: `${focusMinutes} focus minutes this week`, sourceEntityType: "project", sourceEntityId: project.id }], nextAction: bestForEntity(recommendations, "project", project.id), focusMinutesThisWeek: focusMinutes, upcomingMilestone };
  }).sort((a, b) => ({ Blocked: 4, "At Risk": 3, "Needs Attention": 2, Healthy: 1 })[b.state] - ({ Blocked: 4, "At Risk": 3, "Needs Attention": 2, Healthy: 1 })[a.state]);
}

export function assessClientHealth(snapshot: WorkspaceSnapshot, recommendations: Recommendation[]): HealthAssessment[] {
  return snapshot.clients.filter((client) => asString(client.status, "active") === "active").map((client): HealthAssessment => {
    const projects = snapshot.projects.filter((project) => project.client_id === client.id && project.status === "active");
    const waiting = snapshot.waiting.filter((item) => item.client_id === client.id && item.status === "waiting");
    const followups = snapshot.followups.filter((item) => item.client_id === client.id && item.status === "open");
    const overdue = snapshot.invoices.filter((invoice) => invoice.client_id === client.id && !["paid", "cancelled"].includes(asString(invoice.status)) && invoice.due_date && asString(invoice.due_date) < snapshot.today);
    const outstanding = overdue.reduce((sum, invoice) => sum + asNumber(invoice.amount_remaining), 0);
    const lastContact = asString(client.last_contact_at);
    const contactGap = lastContact ? Math.max(0, daysBetween(lastContact, snapshot.today)) : null;
    const reasons: string[] = [];
    if (overdue.length) reasons.push(`${outstanding.toLocaleString("en")} MAD overdue`);
    if (waiting.length) reasons.push(`${waiting.length} waiting item${waiting.length === 1 ? "" : "s"}`);
    if (followups.length) reasons.push(`${followups.length} open follow-up${followups.length === 1 ? "" : "s"}`);
    if (contactGap === null) reasons.push("No contact date recorded");
    else if (contactGap >= 7) reasons.push(`Last contact ${contactGap} days ago`);
    if (!reasons.length) reasons.push(`${projects.length} active project${projects.length === 1 ? "" : "s"} with no current relationship risk`);
    const points = overdue.length * 30 + waiting.length * 12 + followups.length * 10 + (contactGap === null ? 10 : contactGap >= 14 ? 20 : contactGap >= 7 ? 10 : 0);
    return { entityType: "client", entityId: client.id, name: asString(client.name), state: healthState(points, false), reasons, evidence: [{ label: `${projects.length} active projects`, sourceEntityType: "client", sourceEntityId: client.id }, { label: `${waiting.length} waiting items`, sourceEntityType: "client", sourceEntityId: client.id }, { label: `${overdue.length} overdue invoices`, sourceEntityType: "client", sourceEntityId: client.id }], nextAction: bestForEntity(recommendations, "client", client.id) };
  }).sort((a, b) => ({ Blocked: 4, "At Risk": 3, "Needs Attention": 2, Healthy: 1 })[b.state] - ({ Blocked: 4, "At Risk": 3, "Needs Attention": 2, Healthy: 1 })[a.state]);
}
