import { scoreAttention } from "@/lib/intelligence/attention-score";
import type { Evidence, InsightFeedback, Recommendation, WorkspaceSnapshot } from "@/lib/intelligence/types";
import { asNumber, asString, daysBetween } from "@/lib/intelligence/time";

const openTaskStatuses = new Set(["inbox", "planned", "in_progress", "waiting", "blocked"]);
const routeFor = (type: string, id: string) => type === "invoice" ? `/invoices/${id}` : type === "waiting" ? "/waiting" : `/${type === "content" ? "content" : `${type}s`}/${id}`;

function dateSignal(today: string, value: unknown) {
  if (!value) return { dueInDays: null, overdueDays: 0 };
  const dueInDays = daysBetween(today, asString(value));
  return { dueInDays, overdueDays: Math.max(0, -dueInDays) };
}

function postponedCount(snapshot: WorkspaceSnapshot, taskId: string) {
  return snapshot.activity.filter((event) => event.action === "task_postponed" && event.entity_id === taskId).length;
}

function projectFocusGap(snapshot: WorkspaceSnapshot, projectId: string) {
  const latest = snapshot.focusSessions.filter((session) => session.project_id === projectId).map((session) => new Date(asString(session.started_at)).getTime()).filter(Number.isFinite).sort((a, b) => b - a)[0];
  return latest ? Math.max(0, Math.floor((new Date(snapshot.now).getTime() - latest) / 86_400_000)) : 30;
}

function evidenceFromReasons(reasons: ReturnType<typeof scoreAttention>["reasons"], type: string, id: string): Evidence[] {
  return reasons.slice(0, 4).map((item) => ({ label: item.reason, sourceEntityType: type, sourceEntityId: id }));
}

function recommendation(input: Omit<Recommendation, "reason" | "evidence"> & { reasons: ReturnType<typeof scoreAttention>["reasons"]; extraEvidence?: Evidence[] }): Recommendation {
  const evidence = [...evidenceFromReasons(input.reasons, input.entityType, input.entityId), ...(input.extraEvidence ?? [])].slice(0, 5);
  return { ...input, reason: evidence.map((item) => item.label).slice(0, 2).join(" and ") || "This is the clearest available next step", evidence };
}

export function generateRecommendations(snapshot: WorkspaceSnapshot): Recommendation[] {
  const now = snapshot.now;
  const projects = new Map(snapshot.projects.map((row) => [row.id, row]));
  const recommendations: Recommendation[] = [];

  for (const task of snapshot.tasks.filter((row) => openTaskStatuses.has(asString(row.status)))) {
    const project = task.project_id ? projects.get(asString(task.project_id)) : undefined;
    const dates = dateSignal(snapshot.today, task.due_date);
    const attention = scoreAttention({
      ...dates,
      priority: asString(task.priority, "none"),
      projectImportance: asString(project?.priority, "none"),
      blocked: task.status === "blocked",
      postponements: postponedCount(snapshot, task.id),
      daysSinceFocus: task.project_id ? projectFocusGap(snapshot, asString(task.project_id)) : null,
      goalRelevant: Boolean(task.goal_id),
    });
    recommendations.push(recommendation({ key: `task:${task.id}:work`, actionType: task.status === "blocked" ? "unblock_task" : "start_task", entityType: "task", entityId: task.id, label: asString(task.title, "Open task"), priority: attention.score, route: `/focus?task=${task.id}`, recommendedAt: now, expiresAt: task.due_date ? `${asString(task.due_date)}T23:59:59Z` : null, reasons: attention.reasons, extraEvidence: project ? [{ label: `Project: ${asString(project.name)}`, sourceEntityType: "project", sourceEntityId: project.id }] : [] }));
  }

  for (const invoice of snapshot.invoices.filter((row) => !["paid", "cancelled"].includes(asString(row.status)))) {
    const dates = dateSignal(snapshot.today, invoice.due_date);
    const attention = scoreAttention({ ...dates, financialAmount: asNumber(invoice.amount_remaining), paymentDelayDays: dates.overdueDays, priority: dates.overdueDays ? "urgent" : "medium" });
    const amount = `${asNumber(invoice.amount_remaining).toLocaleString("en")} ${asString(invoice.currency, "MAD")}`;
    recommendations.push(recommendation({ key: `invoice:${invoice.id}:followup`, actionType: dates.overdueDays ? "send_payment_reminder" : "review_invoice", entityType: "invoice", entityId: invoice.id, label: dates.overdueDays ? `Send payment reminder for ${amount}` : `Review ${amount} receivable`, priority: attention.score, route: routeFor("invoice", invoice.id), recommendedAt: now, expiresAt: invoice.due_date ? `${asString(invoice.due_date)}T23:59:59Z` : null, reasons: attention.reasons }));
  }

  const contentAction: Record<string, string> = { idea: "Finish the brief", brief: "Draft the copy", copy: "Begin design", designing: "Finish the design", review: "Request approval", approved: "Schedule publication", scheduled: "Verify publication" };
  for (const item of snapshot.content.filter((row) => !["published", "archived"].includes(asString(row.status)))) {
    const dates = dateSignal(snapshot.today, item.due_date ?? item.publish_date);
    const stageRisk = dates.dueInDays !== null && dates.dueInDays <= 2 && ["idea", "brief", "copy", "designing", "review"].includes(asString(item.status));
    const attention = scoreAttention({ ...dates, priority: asString(item.priority, "none"), contentStageRisk: stageRisk, projectImportance: item.project_id ? asString(projects.get(asString(item.project_id))?.priority, "none") : "none" });
    recommendations.push(recommendation({ key: `content:${item.id}:${asString(item.status)}`, actionType: `advance_content_${asString(item.status)}`, entityType: "content", entityId: item.id, label: `${contentAction[asString(item.status)] ?? "Advance content"}: ${asString(item.title)}`, priority: attention.score, route: routeFor("content", item.id), recommendedAt: now, expiresAt: item.due_date ? `${asString(item.due_date)}T23:59:59Z` : null, reasons: attention.reasons }));
  }

  for (const waiting of snapshot.waiting.filter((row) => asString(row.status) === "waiting")) {
    const start = asString(waiting.requested_at ?? waiting.created_at);
    const waitingDays = start ? Math.max(0, daysBetween(start, snapshot.today)) : 0;
    const due = dateSignal(snapshot.today, waiting.expected_by);
    const attention = scoreAttention({ ...due, waitingDays, priority: waitingDays >= 7 ? "high" : "medium" });
    recommendations.push(recommendation({ key: `waiting:${waiting.id}:followup`, actionType: "follow_up_waiting_item", entityType: "waiting", entityId: waiting.id, label: `Follow up: ${asString(waiting.title)}`, priority: attention.score, route: "/waiting", recommendedAt: now, expiresAt: null, reasons: attention.reasons }));
  }

  for (const decision of snapshot.decisions.filter((row) => ["active", "review_due"].includes(asString(row.status)) && row.review_date)) {
    const reviewInDays = daysBetween(snapshot.today, asString(decision.review_date));
    if (reviewInDays > 7) continue;
    const attention = scoreAttention({ decisionReviewInDays: reviewInDays, priority: asString(decision.impact) === "critical" ? "urgent" : asString(decision.impact, "medium") });
    recommendations.push(recommendation({ key: `decision:${decision.id}:review`, actionType: "review_decision", entityType: "decision", entityId: decision.id, label: `Review ${asString(decision.title)}`, priority: attention.score, route: routeFor("decision", decision.id), recommendedAt: now, expiresAt: `${asString(decision.review_date)}T23:59:59Z`, reasons: attention.reasons }));
  }

  for (const project of snapshot.projects.filter((row) => asString(row.status) === "active")) {
    const tasks = recommendations.filter((item) => item.entityType === "task" && snapshot.tasks.find((task) => task.id === item.entityId)?.project_id === project.id);
    const missedMilestones = snapshot.milestones.filter((milestone) => milestone.project_id === project.id && milestone.target_date && asString(milestone.target_date) < snapshot.today && asNumber(milestone.progress) < 100 && asString(milestone.status) !== "completed").length;
    const dates = dateSignal(snapshot.today, project.target_date);
    const attention = scoreAttention({ ...dates, priority: asString(project.priority, "none"), missedMilestones, daysSinceFocus: projectFocusGap(snapshot, project.id), blocked: snapshot.tasks.some((task) => task.project_id === project.id && task.status === "blocked") });
    const topTask = tasks.sort((a, b) => b.priority - a.priority)[0];
    recommendations.push(recommendation({ key: `project:${project.id}:next`, actionType: topTask ? "advance_project_task" : "review_project", entityType: "project", entityId: project.id, label: topTask?.label ?? `Review next milestone for ${asString(project.name)}`, priority: Math.max(attention.score, topTask?.priority ?? 0), route: topTask?.route ?? routeFor("project", project.id), recommendedAt: now, expiresAt: project.target_date ? `${asString(project.target_date)}T23:59:59Z` : null, reasons: [...attention.reasons, ...(topTask?.evidence.slice(0, 2).map((item, index) => ({ key: `task_${index}`, weight: Math.max(1, topTask.priority - index), reason: item.label })) ?? [])] }));
  }

  for (const client of snapshot.clients.filter((row) => asString(row.status, "active") === "active")) {
    const followup = snapshot.followups.find((row) => row.client_id === client.id && asString(row.status) === "open");
    const overdueInvoice = recommendations.find((item) => item.entityType === "invoice" && snapshot.invoices.find((invoice) => invoice.id === item.entityId)?.client_id === client.id && item.actionType === "send_payment_reminder");
    const waiting = recommendations.find((item) => item.entityType === "waiting" && snapshot.waiting.find((entry) => entry.id === item.entityId)?.client_id === client.id);
    const chosen = overdueInvoice ?? waiting;
    const lastContact = asString(client.last_contact_at);
    const daysSinceContact = lastContact ? Math.max(0, daysBetween(lastContact, snapshot.today)) : 30;
    const attention = scoreAttention({ unresolvedFollowups: followup ? 1 : 0, waitingDays: waiting ? daysSinceContact : 0, financialAmount: overdueInvoice ? asNumber(snapshot.invoices.find((invoice) => invoice.id === overdueInvoice.entityId)?.amount_remaining) : 0, clientImportance: asString(client.importance, "medium") });
    if (!followup && !chosen && daysSinceContact < 14) continue;
    recommendations.push(recommendation({ key: `client:${client.id}:next`, actionType: chosen?.actionType ?? "contact_client", entityType: "client", entityId: client.id, label: followup ? asString(followup.title) : chosen?.label ?? `Check in with ${asString(client.name)}`, priority: Math.max(attention.score, chosen?.priority ?? 0), route: followup ? "/followups" : chosen?.route ?? routeFor("client", client.id), recommendedAt: now, expiresAt: null, reasons: attention.reasons, extraEvidence: [{ label: lastContact ? `Last contact ${daysSinceContact} days ago` : "No contact date is recorded", sourceEntityType: "client", sourceEntityId: client.id }] }));
  }

  for (const campaign of snapshot.campaigns.filter((row) => ["planning", "active"].includes(asString(row.status)))) {
    const items = recommendations.filter((item) => item.entityType === "content" && snapshot.content.find((content) => content.id === item.entityId)?.campaign_id === campaign.id);
    const top = items.sort((a, b) => b.priority - a.priority)[0];
    if (!top) continue;
    recommendations.push({ ...top, key: `campaign:${campaign.id}:next`, entityType: "campaign", entityId: campaign.id, route: "/campaigns", label: top.label, evidence: [...top.evidence, { label: `Campaign: ${asString(campaign.name)}`, sourceEntityType: "campaign", sourceEntityId: campaign.id }].slice(0, 5) });
  }

  for (const goal of snapshot.goals.filter((row) => asString(row.status) === "active")) {
    const linked = recommendations.filter((item) => item.entityType === "task" && snapshot.tasks.find((task) => task.id === item.entityId)?.goal_id === goal.id).sort((a, b) => b.priority - a.priority)[0];
    if (!linked) continue;
    recommendations.push({ ...linked, key: `goal:${goal.id}:next`, entityType: "goal", entityId: goal.id, label: linked.label, route: linked.route, priority: Math.min(100, linked.priority + 7), evidence: [...linked.evidence, { label: `Supports goal: ${asString(goal.title)}`, sourceEntityType: "goal", sourceEntityId: goal.id }].slice(0, 5) });
  }

  return recommendations.sort((a, b) => b.priority - a.priority || a.label.localeCompare(b.label));
}

export function applyInsightFeedback(recommendations: Recommendation[], feedback: InsightFeedback[], now = new Date()) {
  const hiddenTypes = new Set(feedback.filter((item) => item.action === "hidden_type").map((item) => item.insight_type));
  const latest = new Map<string, InsightFeedback>();
  for (const item of [...feedback].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())) if (!latest.has(item.insight_key)) latest.set(item.insight_key, item);
  return recommendations.flatMap((item) => {
    if (hiddenTypes.has(item.actionType)) return [];
    const response = latest.get(item.key);
    if (!response) return [item];
    if (response.action === "irrelevant") return [];
    if (response.action === "snoozed" && response.snoozed_until && new Date(response.snoozed_until) > now) return [];
    if (response.action === "dismissed" && now.getTime() - new Date(response.created_at).getTime() < 86_400_000) return [];
    return [{ ...item, priority: response.action === "helpful" ? Math.min(100, item.priority + 4) : item.priority }];
  }).sort((a, b) => b.priority - a.priority);
}

export function bestForEntity(recommendations: Recommendation[], entityType: string, entityId: string) {
  return recommendations.find((item) => item.entityType === entityType && item.entityId === entityId) ?? null;
}
