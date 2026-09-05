import type { Capacity, Risk, WorkspaceRow, WorkspaceSnapshot } from "@/lib/intelligence/types";
import { asNumber, asString, daysBetween, severityFromScore, startOfWeek } from "@/lib/intelligence/time";

function risk(input: Omit<Risk, "severity"> & { score: number }): Risk {
  const { score, ...rest } = input;
  return { ...rest, severity: severityFromScore(score) };
}

function openTask(row: WorkspaceRow) {
  return !["completed", "cancelled"].includes(asString(row.status));
}

export function detectRisks(snapshot: WorkspaceSnapshot, capacity?: Capacity): Risk[] {
  const risks: Risk[] = [];
  for (const project of snapshot.projects.filter((row) => asString(row.status) === "active")) {
    const tasks = snapshot.tasks.filter((row) => row.project_id === project.id && openTask(row));
    const overdue = tasks.filter((row) => row.due_date && asString(row.due_date) < snapshot.today);
    const blocked = tasks.filter((row) => row.status === "blocked");
    const milestones = snapshot.milestones.filter((row) => row.project_id === project.id && asString(row.status) !== "completed" && asNumber(row.progress) < 100);
    const missed = milestones.filter((row) => row.target_date && asString(row.target_date) < snapshot.today);
    const dueIn = project.target_date ? daysBetween(snapshot.today, asString(project.target_date)) : null;
    const focus = snapshot.focusSessions.filter((row) => row.project_id === project.id).sort((a, b) => asString(b.started_at).localeCompare(asString(a.started_at)))[0];
    const idleDays = focus ? daysBetween(asString(focus.started_at), snapshot.today) : 30;
    const reasons = [
      ...blocked.map(() => "Blocked task"),
      ...overdue.map(() => "Overdue task"),
      ...missed.map(() => "Missed milestone"),
      ...(idleDays >= 5 ? [`No focus time in ${idleDays} days`] : []),
      ...(dueIn !== null && dueIn <= 7 && asNumber(project.progress) < 70 ? [`Target is ${dueIn < 0 ? `${Math.abs(dueIn)} days overdue` : `${dueIn} days away`} at ${asNumber(project.progress)}% progress`] : []),
    ];
    if (!reasons.length) continue;
    const score = blocked.length * 22 + overdue.length * 12 + missed.length * 18 + (idleDays >= 5 ? 12 : 0) + (dueIn !== null && dueIn <= 7 ? 15 : 0);
    risks.push(risk({ key: `project:${project.id}:delivery`, entityType: "project", entityId: project.id, score, title: `${asString(project.name)} needs attention`, reason: reasons.slice(0, 3).join("; "), evidence: [{ label: `${overdue.length} overdue tasks`, sourceEntityType: "project", sourceEntityId: project.id }, { label: `${blocked.length} blocked tasks`, sourceEntityType: "project", sourceEntityId: project.id }, { label: `${missed.length} missed milestones`, sourceEntityType: "project", sourceEntityId: project.id }], recommendedAction: blocked[0] ? `Unblock ${asString(blocked[0].title)}` : overdue[0] ? `Finish ${asString(overdue[0].title)}` : "Review the next milestone", route: `/projects/${project.id}` }));
  }

  for (const client of snapshot.clients.filter((row) => asString(row.status, "active") === "active")) {
    const waiting = snapshot.waiting.filter((row) => row.client_id === client.id && row.status === "waiting");
    const invoices = snapshot.invoices.filter((row) => row.client_id === client.id && !["paid", "cancelled"].includes(asString(row.status)) && row.due_date && asString(row.due_date) < snapshot.today);
    const followups = snapshot.followups.filter((row) => row.client_id === client.id && row.status === "open" && row.due_at && asString(row.due_at).slice(0, 10) <= snapshot.today);
    const overdueAmount = invoices.reduce((sum, row) => sum + asNumber(row.amount_remaining), 0);
    if (!waiting.length && !invoices.length && !followups.length) continue;
    const score = waiting.length * 8 + invoices.length * 18 + followups.length * 10 + Math.min(20, Math.floor(overdueAmount / 1000));
    risks.push(risk({ key: `client:${client.id}:relationship`, entityType: "client", entityId: client.id, score, title: `${asString(client.name)} has unresolved commitments`, reason: `${waiting.length} waiting, ${followups.length} due follow-up${followups.length === 1 ? "" : "s"}, and ${overdueAmount.toLocaleString("en")} MAD overdue`, evidence: [{ label: `${waiting.length} waiting items`, sourceEntityType: "client", sourceEntityId: client.id }, { label: `${invoices.length} overdue invoices`, sourceEntityType: "client", sourceEntityId: client.id }], recommendedAction: followups[0] ? asString(followups[0].title) : invoices[0] ? "Send a payment reminder" : "Follow up on the oldest waiting item", route: `/clients/${client.id}` }));
  }

  const earlyStages = new Set(["idea", "brief", "copy", "designing"]);
  for (const item of snapshot.content.filter((row) => !["published", "archived"].includes(asString(row.status)) && row.due_date)) {
    const dueIn = daysBetween(snapshot.today, asString(item.due_date));
    const reviewAge = daysBetween(asString(item.updated_at ?? item.created_at), snapshot.today);
    const stuck = asString(item.status) === "review" && reviewAge >= 3;
    const behind = dueIn <= 3 && earlyStages.has(asString(item.status));
    if (!stuck && !behind) continue;
    risks.push(risk({ key: `content:${item.id}:workflow`, entityType: "content", entityId: item.id, score: stuck ? 58 + reviewAge * 3 : 65 + Math.max(0, 3 - dueIn) * 6, title: stuck ? `${asString(item.title)} is waiting in Review` : `${asString(item.title)} is behind its deadline`, reason: stuck ? `No workflow movement for ${reviewAge} days` : `Due in ${Math.max(0, dueIn)} days while still in ${asString(item.status)}`, evidence: [{ label: `Stage: ${asString(item.status)}`, sourceEntityType: "content", sourceEntityId: item.id }, { label: `Due ${asString(item.due_date)}`, sourceEntityType: "content", sourceEntityId: item.id }], recommendedAction: stuck ? "Request or resolve approval" : "Advance the next workflow step", route: `/content/${item.id}` }));
  }

  for (const campaign of snapshot.campaigns.filter((row) => ["planning", "active"].includes(asString(row.status)) && row.end_date)) {
    const dueIn = daysBetween(snapshot.today, asString(campaign.end_date));
    const items = snapshot.content.filter((row) => row.campaign_id === campaign.id);
    const approved = items.filter((row) => ["approved", "scheduled", "published"].includes(asString(row.status))).length;
    if (dueIn > 7 || items.length < 2 || approved / items.length >= 0.6) continue;
    risks.push(risk({ key: `campaign:${campaign.id}:pace`, entityType: "campaign", entityId: campaign.id, score: 60 + Math.max(0, 7 - dueIn) * 4, title: `${asString(campaign.name)} is behind its timeline`, reason: `${Math.round((approved / items.length) * 100)}% approved with ${Math.max(0, dueIn)} days remaining`, evidence: [{ label: `${approved} of ${items.length} pieces approved`, sourceEntityType: "campaign", sourceEntityId: campaign.id }], recommendedAction: "Resolve the highest-priority approval blocker", route: "/campaigns" }));
  }

  if (capacity && capacity.overcommittedMinutes > 0) risks.push(risk({ key: `personal:${snapshot.today}:capacity`, entityType: "task", entityId: snapshot.today, score: 52 + Math.min(35, Math.floor(capacity.overcommittedMinutes / 10)), title: "Today is overcommitted", reason: capacity.insight, evidence: [{ label: `${capacity.highPriorityMinutes} minutes of high-priority work` }, { label: `${capacity.availableFocusMinutes} focus minutes available` }], recommendedAction: "Defer one lower-impact task", route: "/plan" }));

  const weekday = new Date(`${snapshot.today}T12:00:00Z`).getUTCDay();
  if (weekday >= 5) for (const target of snapshot.fitnessTargets.filter((row) => row.active !== false)) {
    const weekStart = startOfWeek(snapshot.today, asNumber(snapshot.profile?.week_starts_on, 1));
    const activities = snapshot.fitnessActivities.filter((row) => row.activity_type === target.activity_type && asString(row.date ?? row.activity_date) >= weekStart);
    const actual = asString(target.target_type) === "sessions" ? activities.length : activities.reduce((sum, row) => sum + asNumber(row[asString(target.target_type)]), 0);
    const remaining = Math.max(0, asNumber(target.target_value) - actual);
    if (!remaining) continue;
    risks.push(risk({ key: `fitness:${target.id}:target`, entityType: "fitness", entityId: target.id, score: weekday === 0 ? 72 : 52, title: `${asString(target.activity_type)} target needs attention`, reason: `${remaining} ${asString(target.target_type).replaceAll("_", " ")} remaining near the end of the week`, evidence: [{ label: `${actual} of ${asNumber(target.target_value)} completed`, sourceEntityType: "fitness", sourceEntityId: target.id }], recommendedAction: "Protect a realistic training window", route: "/fitness" }));
  }

  return risks.sort((a, b) => ({ critical: 4, high: 3, medium: 2, low: 1 })[b.severity] - ({ critical: 4, high: 3, medium: 2, low: 1 })[a.severity] || a.title.localeCompare(b.title));
}
