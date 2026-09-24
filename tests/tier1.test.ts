import test from "node:test";
import assert from "node:assert/strict";
import { decisionWorkflow, postmortemSchema, decisionReviewStatus, reviewVariance } from "../src/lib/founder-os/workflows";
import { founderBottlenecks, waitingPerspectives, projectMomentum, strategicAlignment, meaningfulFacts, compareFacts, weeklyBriefing } from "../src/lib/founder-os/tier1";
import { buildFounderState, dependencyImpact } from "../src/lib/founder-os/intelligence";
import { resourceDefinition, resourceSchema, isResource } from "../src/lib/founder-os/resources";
import { founderNotificationCandidates } from "../src/lib/founder-os/notifications";
const today = "2026-09-23";
test("structured decision options validate one selected choice and reject unknown fields", () => {
 const option = { label: "Ship", selected: true };
 assert.equal(decisionWorkflow.parse({ options: [option] }).options[0].label, "Ship");
 assert.equal(decisionWorkflow.safeParse({ options: [option, option] }).success, false);
 assert.equal(decisionWorkflow.safeParse({ user_id: "other" }).success, false);
});
test("review requires a substantive actual outcome and preserves zero metric values", () => {
 assert.equal(decisionWorkflow.safeParse({ review: { actual_outcome: "", disposition: "remain", reviewed_on: today } }).success, false);
 const data = decisionWorkflow.parse({ expected_value: 0, review: { actual_outcome: "No measurable improvement", actual_metric: 0, disposition: "reverse", reviewed_on: today } });
 assert.equal(reviewVariance(data.expected_value, data.review!.actual_metric), 0);
 assert.equal(reviewVariance(null, 4), null);
});
test("postmortem draft can be incomplete but completion requires cause resolution prevention and learning", () => {
 assert.equal(postmortemSchema.parse({}).status, "draft");
 assert.equal(postmortemSchema.safeParse({ status: "completed" }).success, false);
 assert.equal(postmortemSchema.parse({ status: "completed", summary: "Failure", underlying_cause: "Mismatch", resolution: "Rollback", prevention: "Contract test", lesson: "Test contracts" }).status, "completed");
});
test("decision views distinguish needs decision, review due and terminal validation", () => {
 assert.equal(decisionReviewStatus({ status: "proposed" }, today), "needs_decision");
 assert.equal(decisionReviewStatus({ status: "decided", review_date: today }, today), "review_due");
 assert.equal(decisionReviewStatus({ status: "validated", review_date: today }, today), "validated");
});
test("waiting perspectives deduplicate linked commitments, retain standalone promises and overdue states", () => {
 const data = waitingPerspectives({ waiting: [{ id: "a", status: "waiting", expected_by: "2026-09-22", blocking_revenue: true }, { id: "b", direction: "owed_by_me", status: "waiting" }], commitments: [{ id: "c", waiting_id: "a", status: "open" }, { id: "d", direction: "owed_by_me", status: "open", due_date: "2026-09-20" }] }, today);
 assert.equal(data.others.active, 1); assert.equal(data.others.overdue, 1); assert.equal(data.others.revenue, 1); assert.equal(data.me.active, 2); assert.equal(data.me.overdue, 1);
});
test("bottlenecks require explicit founder decision and approval evidence", () => {
 const data = { decisions: [{ id: "a", project_id: "p", status: "proposed", founder_required: true }, { id: "b", project_id: "q", status: "under_review", founder_required: true }], delegations: [{ id: "d", status: "blocked", founder_approval_required: true, delegated_to_person_id: "person" }] };
 assert.deepEqual(founderBottlenecks(data, today).map(b => b.id), ["decisions", "approvals"]);
 assert.equal(founderBottlenecks({ decisions: data.decisions.map(d => ({ ...d, founder_required: false })) }, today).length, 0);
});
test("system bottlenecks disclose single recorded administrator without assuming founder identity", () => {
 const output = founderBottlenecks({ systems: [{ id: "s", name: "API", criticality: "critical" }], access: [{ id: "a", system_id: "s", person_label: "Operator", access_level: "admin" }] }, today);
 assert.equal(output.length, 2); assert.match(output[0].reasons[0], /Operator/); assert.ok(!output[0].title.includes("founder"));
});
test("high-impact unowned responsibilities create an evidence-backed owner bottleneck", () => {
 const output = founderBottlenecks({ responsibilities: [
  { id: "critical", name: "Production access", criticality: "critical", status: "needs_owner", primary_owner_id: null },
  { id: "high", name: "Customer escalations", criticality: "high", status: "active", primary_owner_id: null },
  { id: "owned", name: "Owned process", criticality: "critical", status: "active", primary_owner_id: "person-1" },
  { id: "low", name: "Office supplies", criticality: "low", status: "needs_owner", primary_owner_id: null },
  { id: "archived", name: "Old system", criticality: "critical", status: "archived", primary_owner_id: null },
 ] }, today);
 assert.deepEqual(output.map(item => item.id), ["responsibility:critical", "responsibility:high"]);
 assert.match(output[0].reasons.join(" "), /criticality responsibility has no primary owner/);
 assert.match(output[0].reasons.join(" "), /explicitly marked as needing an owner/);
 assert.equal(output[0].route, "/team/responsibilities");
});
test("momentum distinguishes healthy completion, stalled work, blockers and near milestones", () => {
 const project = { id: "p", name: "Project" };
 assert.equal(projectMomentum(project, {}, today).status, "stalled");
 const tasks = [{ id: "t", project_id: "p", status: "completed", completed_at: today, updated_at: today }];
 assert.equal(projectMomentum(project, { tasks }, today).status, "healthy");
 assert.equal(projectMomentum(project, { tasks: [{ ...tasks[0], status: "blocked" }] }, today).status, "attention");
 assert.equal(projectMomentum(project, { tasks, milestones: [{ id: "m", source_type: "project", source_id: "p", status: "upcoming", milestone_date: "2026-09-26" }] }, today).status, "attention");
});
test("alignment inherits project objective and identifies high effort unlinked work for review", () => {
 const result = strategicAlignment({ projects: [{ id: "p", goal_id: "g" }], tasks: [{ id: "a", project_id: "p", estimated_minutes: 180 }, { id: "b", estimated_minutes: 180 }] });
 assert.equal(result.find(r => r.id === "a")!.aligned, true); assert.equal(result.find(r => r.id === "b")!.review, true);
});
test("meaningful comparisons ignore mutations and daily overdue aging, detect real transition", () => {
 const waiting = [{ id: "w", title: "Shipment", expected_by: "2026-09-20", status: "waiting" }];
 const prior = meaningfulFacts({ waiting }, "2026-09-21");
 assert.deepEqual(compareFacts(meaningfulFacts({ waiting: waiting.map(r => ({ ...r, updated_at: today, notes: "typo fixed" })) }, today), prior), []);
 const decisions = [{ id: "d", status: "decided", review_date: today }];
 assert.equal(compareFacts(meaningfulFacts({ decisions }, today), meaningfulFacts({ decisions }, "2026-09-22"))!.length, 1);
 assert.equal(compareFacts([], null), null);
});
test("weekly review assembles canonical issues risks decisions waiting lessons and outcomes", () => {
 const data = weeklyBriefing({ tasks: [{ id: "t", status: "completed", completed_at: today }], decisions: [{ id: "d", status: "proposed" }], issues: [{ id: "i", status: "open" }], risks: [{ id: "r", status: "materialized", updated_at: today }], waiting: [{ id: "w", status: "waiting", expected_by: "2026-09-20" }], lessons: [{ id: "l", created_at: today, statement: "Test assumptions" }] }, today);
 for (const key of ["Outcomes", "Decisions", "Problems", "Risks", "Waiting For", "Lessons"] as const) assert.equal(data[key].length, 1);
});
test("relationship follow-up propagates to Founder State and the weekly briefing", () => {
 const relation = { id: "rel", name: "Synthetic contact", status: "attention", importance: "critical", next_followup: "2026-09-22" };
 const state = buildFounderState({ relationships: [relation] }, today);
 assert.ok(state.signals.some(signal => signal.sourceId === "rel" && signal.type === "RELATIONSHIP_FOLLOWUP_DUE" && signal.severity === "high"));
 assert.equal(weeklyBriefing({ relationships: [relation] }, today)["Relationships & commitments"][0].id, "rel");
});
test("commitment reminders honor materiality, direction, follow-up date and waiting deduplication", () => {
 const data = { commitments: [
  { id: "important", title: "Supplier promise", person_label: "Supplier", direction: "owed_by_me", importance: "critical", status: "open", due_date: "2026-09-29", follow_up_date: "2026-09-22" },
  { id: "low", title: "Minor promise", person_label: "Peer", direction: "owed_to_me", importance: "low", status: "open", due_date: "2026-09-22" },
  { id: "linked", title: "Tracked wait", person_label: "Peer", direction: "owed_to_me", importance: "critical", status: "open", due_date: "2026-09-22", waiting_id: "wait" },
 ], waiting: [{ id: "wait", title: "Tracked wait", status: "waiting", direction: "owed_to_me", expected_by: "2026-09-22" }] };
 const signals = buildFounderState(data, today).signals;
 const overdue = signals.find(signal => signal.sourceId === "important");
 assert.equal(overdue?.type, "COMMITMENT_OVERDUE");assert.ok(overdue?.reasons.some(reason => reason.includes("You owe")));
 assert.equal(signals.some(signal => signal.sourceId === "low"), false);
 assert.equal(signals.some(signal => signal.sourceId === "linked"), false);
 assert.ok(founderNotificationCandidates([overdue!]).some(candidate => candidate.metadata.signal === "COMMITMENT_OVERDUE"));
});
test("delegation review counts only completed, measured founder-only focus sessions", () => {
 const task = { id: "task", title: "Recurring founder work", work_classification: "founder_only", recurrence_frequency: "weekly", priority: "high", status: "open" };
 const sessions = Array.from({ length: 5 }, (_, index) => ({ id: String(index), task_id: task.id, started_at: `${today}T10:00:00Z`, ended_at: `${today}T11:00:00Z`, duration_seconds: 3600 }));
 const result = founderBottlenecks({ tasks: [task], sessions }, today);
 assert.match(result[0].reasons.join(" "), /5 completed focus sessions totaling 5.0 recorded hours/);
 assert.equal(founderBottlenecks({ tasks: [task], sessions: sessions.map(session => ({ ...session, ended_at: null, duration_seconds: null })) }, today).length, 0);
 assert.ok(buildFounderState({ tasks: [task], sessions }, today).signals.some(signal => signal.type === "FOUNDER_BOTTLENECK" && signal.title.includes(String(task.title))));
});
test("Founder State includes explicit decision bottleneck and strategic deadline signals", () => {
 const state = buildFounderState({ decisions: [{ id: "a", status: "proposed", founder_required: true, project_id: "p" }, { id: "b", status: "proposed", founder_required: true, project_id: "q" }], strategicCommitments: [{ id: "c", status: "committed", target_date: today }] }, today);
 assert.ok(state.signals.some(s => s.type === "FOUNDER_BOTTLENECK")); assert.ok(state.signals.some(s => s.type === "STRATEGIC_COMMITMENT"));
 assert.ok(state.signals.every(s => s.reasons.length)); assert.ok(state.attention.length <= 5);
});
test("dependency traversal visits cycles once and excludes healthy edges", () => {
 const edge = (id: string, source: string, target: string, state = "blocked") => ({ id, source_type: "task", source_id: source, dependency_type: "task", dependency_id: target, state });
 assert.deepEqual(dependencyImpact([edge("a", "b", "a"), edge("b", "a", "b"), edge("c", "c", "b", "ready")], "task", "a"), ["task:b"]);
});
test("resource registry keeps dangerous table names inaccessible and defines removal policies", () => {
 assert.equal(isResource("auth.users"), false); assert.equal(resourceDefinition("dependencies").removeMode, "delete"); assert.equal(resourceDefinition("issues").removeMode, "archive"); assert.equal(resourceDefinition("wealth").removeMode, null);
 assert.equal(resourceSchema("decisions", true).safeParse({ user_id: "other" }).success, false);
});

test("decision form empty date uses the database default on create and preserves it on edit", async () => {
 const { saveOperatingRecord } = await import("../src/lib/founder-os/repository");
 const written: Record<string, unknown>[] = [];
 const current = { id: "11111111-1111-4111-8111-111111111111", decision_date: "2026-09-01" };
 const client = { from: () => {
   const query = {
     select: () => query, eq: () => query,
     maybeSingle: async () => ({ data: current, error: null }),
     insert: (values: Record<string, unknown>) => { written.push(values); return query; },
     update: (values: Record<string, unknown>) => { written.push(values); return query; },
     single: async () => ({ data: current, error: null }),
   };
   return query;
 } };
 const input = { title: "Synthetic decision", decision: "Verify date default", decision_date: null, status: "proposed", impact: "medium", confidence: "medium", reversibility: "reversible", currency: "MAD" };
 await saveOperatingRecord(client as never, "user", "decisions", input);
 await saveOperatingRecord(client as never, "user", "decisions", { decision_date: null }, current.id);
 assert.equal(written.length, 2);
 for (const values of written) assert.equal(Object.hasOwn(values, "decision_date"), false);
 await saveOperatingRecord(client as never, "user", "decisions", { decision_date: "2026-09-23" }, current.id);
 assert.equal(written[2].decision_date, "2026-09-23");
});
