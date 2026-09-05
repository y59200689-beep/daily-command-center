import type { WorkspaceRow, WorkspaceSnapshot } from "@/lib/intelligence/types";
import { asNumber, asString } from "@/lib/intelligence/time";

function includesName(event: WorkspaceRow, row: WorkspaceRow) {
  const haystack = `${asString(event.title)} ${asString(event.description)}`.toLocaleLowerCase();
  const name = asString(row.name).trim().toLocaleLowerCase();
  return name.length >= 3 && haystack.includes(name);
}

export function buildMeetingBrief(snapshot: WorkspaceSnapshot, eventId: string) {
  const event = snapshot.calendar.find((item) => item.id === eventId);
  if (!event) return null;
  const task = event.task_id ? snapshot.tasks.find((item) => item.id === event.task_id) : undefined;
  const project = task?.project_id ? snapshot.projects.find((item) => item.id === task.project_id) : snapshot.projects.find((item) => includesName(event, item));
  const client = task?.client_id ? snapshot.clients.find((item) => item.id === task.client_id) : project?.client_id ? snapshot.clients.find((item) => item.id === project.client_id) : snapshot.clients.find((item) => includesName(event, item));
  const matches = (row: WorkspaceRow) => (!project || row.project_id === project.id) && (!client || !row.client_id || row.client_id === client.id);
  const openTasks = snapshot.tasks.filter((item) => matches(item) && !["completed", "cancelled"].includes(asString(item.status))).slice(0, 6);
  const waiting = snapshot.waiting.filter((item) => matches(item) && item.status === "waiting").slice(0, 5);
  const invoices = snapshot.invoices.filter((item) => matches(item) && !["paid", "cancelled"].includes(asString(item.status))).slice(0, 5);
  const notes = snapshot.notes.filter(matches).slice(0, 5);
  const decisions = snapshot.decisions.filter((item) => matches(item) && ["active", "review_due"].includes(asString(item.status))).slice(0, 5);
  const content = snapshot.content.filter((item) => matches(item) && !["published", "archived"].includes(asString(item.status))).slice(0, 5);
  const questions: string[] = [];
  if (waiting[0]) questions.push(`Confirm ${asString(waiting[0].title).toLowerCase()}`);
  if (content.some((item) => item.status === "review" || item.approval_status === "pending")) questions.push("Confirm pending content approval and publication timing");
  if (invoices.some((item) => item.due_date && asString(item.due_date) < snapshot.today)) questions.push("Confirm payment timing for the overdue balance");
  if (openTasks.some((item) => item.status === "blocked")) questions.push("Resolve the current project blocker");
  return {
    event,
    project: project ?? null,
    client: client ?? null,
    openTasks,
    waiting,
    invoices,
    notes,
    decisions,
    content,
    outstandingAmount: invoices.reduce((sum, item) => sum + asNumber(item.amount_remaining), 0),
    questions,
    evidenceQuality: client || project || task ? "strong" : "limited",
    caveat: client || project || task ? null : "No explicit client, project, or task relationship was found. This brief only includes the calendar event itself.",
  };
}
