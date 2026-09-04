import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assistantTools, executeAssistantTool } from "../src/lib/ai-tools";
import { parseDomainInput } from "../src/lib/domains";
import { decisionReviewState, promptVariables, rankInsights, renderPrompt, targetProgress, type Insight } from "../src/lib/v2";

test("content workflow accepts canonical stages and rejects unknown stages", () => {
  assert.equal(parseDomainInput("content", { title: "Launch", status: "review" }).success, true);
  assert.equal(parseDomainInput("content", { title: "Launch", status: "almost_done" }).success, false);
});

test("prompt variables are deduplicated and missing values stay explicit", () => {
  const template = "Write for {client_name} about {topic}. Sign for {client_name}.";
  assert.deepEqual(promptVariables(template), ["client_name", "topic"]);
  assert.deepEqual(renderPrompt(template, { client_name: "Acme" }).missing, ["topic"]);
  assert.equal(renderPrompt(template, { client_name: "Acme", topic: "launches" }).text, "Write for Acme about launches. Sign for Acme.");
});

test("fitness target progress supports sessions and measured targets", () => {
  const activities = [{ activity_type: "Running", distance_km: 5 }, { activity_type: "Running", distance_km: 3 }, { activity_type: "Gym", duration_minutes: 40 }];
  assert.deepEqual(targetProgress({ activity_type: "Running", target_type: "distance_km", target_value: 10 }, activities), { actual: 8, target: 10, remaining: 2, complete: false });
  assert.equal(targetProgress({ activity_type: "Running", target_type: "sessions", target_value: 2 }, activities).complete, true);
});

test("decision review dates distinguish due, overdue, and later reviews", () => {
  assert.equal(decisionReviewState("2026-09-05", "2026-09-04"), "due_soon");
  assert.equal(decisionReviewState("2026-09-03", "2026-09-04"), "overdue");
  assert.equal(decisionReviewState("2026-10-01", "2026-09-04"), "later");
  assert.equal(decisionReviewState(null, "2026-09-04"), "none");
});

test("insight ranking removes expired and duplicate entity signals", () => {
  const base: Insight = { id: "a", type: "invoice_due", priority: 10, severity: "medium", title: "Due", message: "Due", entity_type: "invoice", entity_id: "one", action_label: "Open", action_route: "/", expires_at: null, generated_at: "2026-09-04T00:00:00Z" };
  const ranked = rankInsights([{ ...base, id: "expired", priority: 99, expires_at: "2026-09-03T23:00:00Z" }, base, { ...base, id: "duplicate", priority: 5 }, { ...base, id: "critical", entity_id: "two", severity: "critical", priority: 20 }], new Date("2026-09-04T00:00:00Z"));
  assert.deepEqual(ranked.map((item) => item.id), ["critical", "a"]);
});

test("AI tool declarations never accept user_id and writes require confirmation before database access", async () => {
  for (const definition of assistantTools) assert.equal(Object.hasOwn(definition.parameters.properties, "user_id"), false);
  const result = await executeAssistantTool({ client: {} as SupabaseClient, userId: "owner" }, "create_invoice", { title: "INV", client_id: null, project_id: null, subtotal: 100, tax_amount: 0, discount_amount: 0, currency: "MAD", due_date: null, confirmed: false });
  assert.deepEqual(result, { confirmation_required: true, message: "Ask the user to confirm this change before executing it." });
});
