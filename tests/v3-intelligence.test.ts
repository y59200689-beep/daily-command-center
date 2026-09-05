import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scoreAttention } from "../src/lib/intelligence/attention-score";
import { assessProjectHealth } from "../src/lib/intelligence/health";
import { buildMeetingBrief } from "../src/lib/intelligence/meeting";
import { detectPatterns, generatePredictions, MIN_PATTERN_SAMPLE, MIN_PREDICTION_SAMPLE } from "../src/lib/intelligence/patterns";
import { calculateCapacity } from "../src/lib/intelligence/planning";
import { applyInsightFeedback, generateRecommendations } from "../src/lib/intelligence/recommendations";
import { detectRisks } from "../src/lib/intelligence/risk-engine";
import type { WorkspaceSnapshot } from "../src/lib/intelligence/types";
import { assistantTools, executeAssistantTool } from "../src/lib/ai-tools";

const projectId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const clientId = "33333333-3333-4333-8333-333333333333";
const eventId = "44444444-4444-4444-8444-444444444444";

function snapshot(overrides: Partial<WorkspaceSnapshot> = {}): WorkspaceSnapshot {
  return {
    now: "2026-09-07T09:00:00.000Z", today: "2026-09-07", timezone: "UTC",
    profile: { id: "owner", workday_start: "09:00:00", workday_end: "18:00:00", week_starts_on: 1 },
    tasks: [], projects: [], clients: [], followups: [], waiting: [], notes: [], milestones: [], calendar: [], focusSessions: [], invoices: [], payments: [], expenses: [], subscriptions: [], content: [], campaigns: [], decisions: [], goals: [], fitnessActivities: [], fitnessTargets: [], activity: [], feedback: [], notificationPreferences: [],
    ...overrides,
  };
}

test("attention scoring is weighted, bounded, and explainable", () => {
  const result = scoreAttention({ overdueDays: 3, priority: "urgent", blocked: true, postponements: 2, goalRelevant: true });
  assert.equal(result.score, 79);
  assert.deepEqual(result.reasons.slice(0, 3).map((item) => item.key), ["overdue", "priority", "blocked"]);
  assert.ok(result.reasons.every((item) => item.reason.length > 0));
  assert.equal(scoreAttention({ overdueDays: 100, priority: "urgent", blocked: true, missedMilestones: 5, paymentDelayDays: 20 }).score, 100);
});

test("next-best-action ranking keeps urgent overdue work first with evidence", () => {
  const data = snapshot({ projects: [{ id: projectId, name: "Launch", status: "active", priority: "high", updated_at: "2026-09-07" }], tasks: [
    { id: taskId, title: "Unblock checkout", status: "blocked", priority: "urgent", due_date: "2026-09-05", project_id: projectId },
    { id: "55555555-5555-4555-8555-555555555555", title: "Clean up", status: "planned", priority: "low", due_date: null },
  ] });
  const recommendations = generateRecommendations(data);
  assert.equal(recommendations[0].label, "Unblock checkout");
  assert.ok(recommendations[0].reason.includes("overdue"));
  assert.ok(recommendations[0].evidence.some((item) => item.label.includes("Blocked")));
});

test("capacity detects overcommitment from work hours, meetings, and estimates", () => {
  const data = snapshot({ calendar: [{ id: eventId, title: "Review", starts_at: "2026-09-07T12:00:00Z", ends_at: "2026-09-07T13:00:00Z", status: "confirmed" }], tasks: [{ id: taskId, title: "Large delivery", status: "planned", priority: "high", estimated_minutes: 600 }] });
  const capacity = calculateCapacity(data);
  assert.equal(capacity.meetingMinutes, 60);
  assert.equal(capacity.availableFocusMinutes, 480);
  assert.equal(capacity.overcommittedMinutes, 120);
  assert.match(capacity.insight, /overcommitted/);
});

test("project health and risk detection surface blockers without fake precision", () => {
  const data = snapshot({ projects: [{ id: projectId, name: "Launch", status: "active", progress: 20, target_date: "2026-09-10", updated_at: "2026-09-01" }], tasks: [{ id: taskId, title: "Checkout", status: "blocked", priority: "high", due_date: "2026-09-06", project_id: projectId }], milestones: [{ id: "66666666-6666-4666-8666-666666666666", name: "Payments", project_id: projectId, status: "active", progress: 20, target_date: "2026-09-06" }] });
  const recommendations = generateRecommendations(data);
  const health = assessProjectHealth(data, recommendations)[0];
  assert.equal(health.state, "Blocked");
  assert.ok(health.reasons.some((reason) => reason.includes("blocked")));
  const risks = detectRisks(data, calculateCapacity(data));
  assert.ok(risks.some((risk) => risk.entityId === projectId && risk.evidence.length > 0 && risk.recommendedAction.length > 0));
});

test("meeting preparation returns only explicitly or contextually linked owned snapshot data", () => {
  const data = snapshot({ calendar: [{ id: eventId, title: "Radiology review", starts_at: "2026-09-07T12:00:00Z", ends_at: "2026-09-07T13:00:00Z", status: "confirmed", task_id: taskId }], tasks: [{ id: taskId, title: "Prepare deck", status: "planned", project_id: projectId, client_id: clientId }], projects: [{ id: projectId, name: "Campaign", status: "active", client_id: clientId }], clients: [{ id: clientId, name: "Radiology", status: "active" }], waiting: [{ id: "77777777-7777-4777-8777-777777777777", title: "Visual approval", status: "waiting", project_id: projectId, client_id: clientId }], notes: [{ id: "88888888-8888-4888-8888-888888888888", title: "Last call", project_id: projectId, client_id: clientId }], decisions: [{ id: "99999999-9999-4999-8999-999999999999", title: "Publish Friday", status: "active", project_id: projectId, client_id: clientId }] });
  const brief = buildMeetingBrief(data, eventId);
  assert.equal(brief?.client?.id, clientId);
  assert.equal(brief?.notes.length, 1);
  assert.equal(brief?.waiting.length, 1);
  assert.ok(brief?.questions.some((question) => question.includes("visual approval")));
});

test("dismiss and snooze feedback respect cooldown while helpful feedback improves rank", () => {
  const item = generateRecommendations(snapshot({ tasks: [{ id: taskId, title: "Ship", status: "planned", priority: "high" }] }))[0];
  const now = new Date("2026-09-07T10:00:00Z");
  assert.equal(applyInsightFeedback([item], [{ insight_key: item.key, insight_type: item.actionType, action: "dismissed", created_at: "2026-09-07T09:00:00Z" }], now).length, 0);
  assert.equal(applyInsightFeedback([item], [{ insight_key: item.key, insight_type: item.actionType, action: "snoozed", snoozed_until: "2026-09-08T09:00:00Z", created_at: "2026-09-07T09:00:00Z" }], now).length, 0);
  assert.equal(applyInsightFeedback([item], [{ insight_key: item.key, insight_type: item.actionType, action: "dismissed", created_at: "2026-09-05T09:00:00Z" }], now).length, 1);
  assert.equal(applyInsightFeedback([item], [{ insight_key: item.key, insight_type: item.actionType, action: "helpful", created_at: "2026-09-07T09:00:00Z" }], now)[0].priority, Math.min(100, item.priority + 4));
});

test("patterns and predictions stay hidden below their minimum sample sizes", () => {
  const tooLittle = snapshot({ tasks: Array.from({ length: MIN_PATTERN_SAMPLE - 1 }, (_, index) => ({ id: `task-${index}`, status: "completed", estimated_minutes: 30, actual_minutes: 60 })) });
  assert.equal(detectPatterns(tooLittle).length, 0);
  const project = { id: projectId, name: "Launch", status: "active", target_date: "2026-09-08" };
  const incompleteHistory = snapshot({ projects: [project], tasks: [...Array.from({ length: MIN_PREDICTION_SAMPLE - 1 }, (_, index) => ({ id: `done-${index}`, status: "completed", project_id: projectId, completed_at: `2026-09-0${index + 1}` })), { id: "open-a", status: "planned", project_id: projectId }, { id: "open-b", status: "planned", project_id: projectId }] });
  assert.equal(generatePredictions(incompleteHistory).length, 0);
  const enough = snapshot({ tasks: Array.from({ length: MIN_PATTERN_SAMPLE }, (_, index) => ({ id: `task-${index}`, status: "completed", estimated_minutes: 30, actual_minutes: 60 })) });
  assert.match(detectPatterns(enough)[0].statement, /100% longer/);
});

test("V3 AI tools never accept user_id and writes require confirmation before data access", async () => {
  for (const definition of assistantTools) assert.equal(Object.hasOwn(definition.parameters.properties, "user_id"), false);
  const result = await executeAssistantTool({ client: {} as SupabaseClient, userId: "owner" }, "accept_daily_plan", { task_ids: [taskId], confirmed: false });
  assert.deepEqual(result, { confirmation_required: true, message: "Ask the user to confirm this change before executing it." });
});
