import { test } from "node:test";
import assert from "node:assert/strict";
import {
  experimentSignals,
  forecastSignals,
  forecastCalibration,
  contentSignals,
  assetSignals,
  energyAndAttentionSignals,
  crossDomainSynthesis,
  extractActionsFromCommunication,
  tier3MeaningfulFacts,
} from "../src/lib/founder-os/tier3";

const today = "2026-09-24";

// ─── Experiment signals ───────────────────────────────────────────────────────

test("overdue experiment review emits EXPERIMENT_REVIEW_DUE", () => {
  const signals = experimentSignals(
    { experiments: [{ id: "e1", name: "Referral Loop Test", status: "running", hypothesis: "Referral links increase signups by 20%", end_date: "2026-09-10", company_id: null, baseline: null, target_value: null, actual_value: null, outcome_result: null, target_metric: null }] },
    today
  );
  assert.equal(signals.length >= 1, true);
  assert.ok(signals.some((s) => s.type === "EXPERIMENT_REVIEW_DUE"));
  assert.ok(signals.some((s) => s.type === "EXPERIMENT_MEASUREMENT_MISSING"));
});

test("completed inconclusive experiment emits EXPERIMENT_INCONCLUSIVE", () => {
  const signals = experimentSignals(
    { experiments: [{ id: "e2", name: "Pricing Test", status: "completed", hypothesis: "H", end_date: "2026-09-01", outcome_result: "INCONCLUSIVE", actual_value: null, baseline: null, target_value: null, company_id: null, target_metric: null }] },
    today
  );
  assert.ok(signals.some((s) => s.type === "EXPERIMENT_INCONCLUSIVE"));
});

test("repeated NOT_SUPPORTED results trigger REPEATED_ASSUMPTION_FAILURE", () => {
  const company_id = "biz-1";
  const signals = experimentSignals(
    { experiments: [{ id: "a", name: "Exp A", status: "completed", outcome_result: "NOT_SUPPORTED", company_id }, { id: "b", name: "Exp B", status: "completed", outcome_result: "NOT_SUPPORTED", company_id }], companies: [{ id: company_id, name: "ACME" }] },
    today
  );
  assert.ok(signals.some((s) => s.type === "REPEATED_ASSUMPTION_FAILURE"));
  assert.ok(signals.some((s) => s.companyId === company_id));
});

test("well-measured running experiment with future end date produces no signal", () => {
  const signals = experimentSignals(
    { experiments: [{ id: "ok", name: "Good Experiment", status: "running", end_date: "2026-12-01", baseline: 100, target_value: 130, outcome_result: null, company_id: null, hypothesis: "something" }] },
    today
  );
  assert.equal(signals.length, 0);
});

// ─── Forecast signals ─────────────────────────────────────────────────────────

test("unresolved forecast past due date emits FORECAST_DUE", () => {
  const signals = forecastSignals(
    { forecasts: [{ id: "f1", prediction: "Revenue will double by end of Q3", domain: "revenue", resolution_date: "2026-09-01", resolution: "unresolved", confidence: "medium", company_id: null, predicted_outcome: "Revenue > 200k", calibration_notes: null }] },
    today
  );
  assert.ok(signals.some((s) => s.type === "FORECAST_DUE"));
});

test("high-confidence forecast resolved incorrect emits HIGH_CONFIDENCE_FORECAST_MISSED", () => {
  const signals = forecastSignals(
    { forecasts: [{ id: "f2", prediction: "Team will close 5 deals", domain: "growth", resolution_date: "2026-09-01", resolution: "incorrect", confidence: "high", predicted_outcome: "5 closed deals", company_id: null, calibration_notes: null }] },
    today
  );
  assert.ok(signals.some((s) => s.type === "HIGH_CONFIDENCE_FORECAST_MISSED"));
  assert.ok(signals.some((s) => s.severity === "high"));
});

test("domain with 2+ incorrect forecasts triggers bias signal", () => {
  const signals = forecastSignals(
    { forecasts: [{ id: "g1", prediction: "Sprint A", domain: "delivery", resolution: "incorrect", resolution_date: "2026-08-01", confidence: "medium", predicted_outcome: "Done" }, { id: "g2", prediction: "Sprint B", domain: "delivery", resolution: "incorrect", resolution_date: "2026-08-15", confidence: "medium", predicted_outcome: "Done" }] },
    today
  );
  assert.ok(signals.some((s) => s.type === "REPEATED_ASSUMPTION_FAILURE"));
  assert.ok(signals.some((s) => s.sourceId === "delivery"));
});

// ─── Forecast calibration ─────────────────────────────────────────────────────

test("forecast calibration returns correct accuracy rate and domain breakdown", () => {
  const forecasts = [
    { id: "1", domain: "revenue", resolution: "correct", confidence: "high" },
    { id: "2", domain: "revenue", resolution: "incorrect", confidence: "high" },
    { id: "3", domain: "delivery", resolution: "partially_correct", confidence: "medium" },
    { id: "4", domain: "revenue", resolution: "unresolved", confidence: "low" },
  ];
  const cal = forecastCalibration(forecasts);
  assert.equal(cal.total, 3);
  assert.equal(cal.correct, 1);
  assert.equal(cal.partial, 1);
  assert.equal(cal.incorrect, 1);
  assert.ok(cal.accuracyRate !== null && Math.abs(cal.accuracyRate - 50) < 0.01);
  assert.equal(cal.byDomain["revenue"]?.total, 2);
  assert.equal(cal.byDomain["delivery"]?.total, 1);
});

test("forecastCalibration returns null accuracy for zero resolved forecasts", () => {
  const cal = forecastCalibration([{ id: "x", domain: "general", resolution: "unresolved", confidence: "medium" }]);
  assert.equal(cal.total, 0);
  assert.equal(cal.accuracyRate, null);
});

// ─── Content pipeline signals ─────────────────────────────────────────────────

test("idea stuck for 15+ days emits CONTENT_PIPELINE_STALLED", () => {
  const signals = contentSignals(
    { content: [{ id: "c1", title: "LinkedIn post idea", status: "idea", created_at: "2026-09-01", deleted_at: null, company_id: null, content_pillar: "thought-leadership", due_date: null }] },
    today
  );
  assert.ok(signals.some((s) => s.type === "CONTENT_PIPELINE_STALLED"));
});

test("draft in review for 6 days emits CONTENT_PIPELINE_STALLED (high severity)", () => {
  const signals = contentSignals(
    { content: [{ id: "c2", title: "Case study", status: "review", created_at: "2026-09-16", deleted_at: null, company_id: null, content_pillar: null, due_date: null }] },
    today
  );
  const stalled = signals.find((s) => s.type === "CONTENT_PIPELINE_STALLED");
  assert.ok(stalled);
  assert.equal(stalled.severity, "high");
});

test("content idea from yesterday is not stalled", () => {
  const signals = contentSignals(
    { content: [{ id: "c3", title: "Fresh idea", status: "idea", created_at: "2026-09-23", deleted_at: null }] },
    today
  );
  assert.equal(signals.length, 0);
});

// ─── Asset intelligence signals ───────────────────────────────────────────────

test("core asset not used in 70 days emits UNDERUSED_ASSET", () => {
  const signals = assetSignals(
    { assets: [{ id: "a1", name: "Flagship Deck", status: "active", value_category: "core", last_used_date: "2026-07-01", reuse_potential: "high", maintenance_due_date: null, maintenance_requirement: null, expiry_date: null, review_date: null, type: "document", company_id: null }] },
    today
  );
  assert.ok(signals.some((s) => s.type === "UNDERUSED_ASSET"));
});

test("asset with maintenance due tomorrow emits ASSET_MAINTENANCE_DUE", () => {
  const signals = assetSignals(
    { assets: [{ id: "a2", name: "Domain Renewal", status: "active", value_category: "core", maintenance_due_date: "2026-09-25", last_used_date: today, expiry_date: null, review_date: null, reuse_potential: null, maintenance_requirement: "Annual renewal", type: "domain", company_id: null }] },
    today
  );
  assert.ok(signals.some((s) => s.type === "ASSET_MAINTENANCE_DUE"));
});

test("stale (overdue review) active asset emits STALE_ASSET", () => {
  const signals = assetSignals(
    { assets: [{ id: "a3", name: "SOP v1", status: "active", value_category: null, review_date: "2026-08-01", last_used_date: today, maintenance_due_date: null, expiry_date: null, reuse_potential: null, maintenance_requirement: null, type: "document", company_id: null }] },
    today
  );
  assert.ok(signals.some((s) => s.type === "STALE_ASSET"));
});

test("archived asset is never flagged", () => {
  const signals = assetSignals(
    { assets: [{ id: "a4", name: "Old deck", status: "archived", value_category: "core", last_used_date: "2020-01-01", maintenance_due_date: "2020-01-01", review_date: "2020-01-01", expiry_date: null, reuse_potential: null, maintenance_requirement: null, type: "document", company_id: null }] },
    today
  );
  assert.equal(signals.length, 0);
});

// ─── Energy & attention signals ───────────────────────────────────────────────

test("3+ founder-required open decisions emit FOUNDER_DECISION_LOAD_HIGH", () => {
  const decisions = Array.from({ length: 3 }, (_, i) => ({ id: `d${i}`, title: `Decision ${i}`, founder_required: true, status: "proposed", deleted_at: null }));
  const signals = energyAndAttentionSignals({ decisions }, today);
  assert.ok(signals.some((s) => s.type === "FOUNDER_DECISION_LOAD_HIGH"));
});

test("6+ focus sessions trigger FOUNDER_CONTEXT_SWITCHING_HIGH", () => {
  const sessions = Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, started_at: `${today}T10:0${i}:00Z`, ended_at: `${today}T10:3${i}:00Z`, project_id: `proj-${i}` }));
  const signals = energyAndAttentionSignals({ sessions }, today);
  assert.ok(signals.some((s) => s.type === "FOUNDER_CONTEXT_SWITCHING_HIGH"));
});

test("low energy + high stress + >=5 urgent tasks emits FOUNDER_ENERGY_LOW", () => {
  const dailyStates = [{ id: "ds1", date: today, energy: "low", focus: "poor", stress_load: "high", cognitive_notes: null }];
  const tasks = Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, title: `Task ${i}`, priority: "urgent", status: "open", deleted_at: null }));
  const signals = energyAndAttentionSignals({ dailyStates, tasks }, today);
  assert.ok(signals.some((s) => s.type === "FOUNDER_ENERGY_LOW"));
});

// ─── Communication action extraction ─────────────────────────────────────────

test("extracts owed_to_me commitment from promise language", () => {
  const actions = extractActionsFromCommunication("Ahmed said he will send supplier pricing by Friday.");
  const commitment = actions.find((a) => a.kind === "commitment" && a.direction === "owed_to_me");
  assert.ok(commitment, "Should extract owed_to_me commitment");
  assert.equal(commitment?.counterpart, "Ahmed");
  assert.ok(commitment!.confidence >= 0.85);
});

test("extracts owed_by_me commitment from first-person promise", () => {
  const actions = extractActionsFromCommunication("I promised Sarah I will review the agreement tomorrow.");
  const commitment = actions.find((a) => a.kind === "commitment" && a.direction === "owed_by_me");
  assert.ok(commitment, "Should extract owed_by_me commitment");
  assert.equal(commitment?.counterpart, "Sarah");
  assert.ok(commitment!.dueDate !== undefined);
});

test("extracts decision from 'need to decide' pattern", () => {
  const actions = extractActionsFromCommunication("Need to decide between AWS and GCP by next week.");
  assert.ok(actions.some((a) => a.kind === "decision"));
});

test("falls back to generic task for unrecognised substantial text", () => {
  const actions = extractActionsFromCommunication("Review the supplier agreement before the board meeting.");
  assert.ok(actions.length > 0);
  assert.ok(actions.some((a) => a.kind === "task"));
  assert.ok(actions[0].confidence <= 0.75);
});

test("short text does not throw", () => {
  assert.doesNotThrow(() => extractActionsFromCommunication("Call back."));
});

// ─── Tier 3 meaningful facts ──────────────────────────────────────────────────

test("tier3MeaningfulFacts emits one fact per experiment", () => {
  const facts = tier3MeaningfulFacts({ experiments: [{ id: "e1", name: "Referral Test", status: "completed", outcome_result: "SUPPORTED", company_id: null }], forecasts: [], assets: [], content: [], dailyStates: [] }, today);
  assert.ok(facts.some((f) => f.id === "Experiment:e1"));
  assert.ok(facts.some((f) => f.domain === "Learning"));
});

test("tier3MeaningfulFacts emits energy fact when daily state present", () => {
  const facts = tier3MeaningfulFacts({ experiments: [], forecasts: [], assets: [], content: [], dailyStates: [{ id: "ds1", date: today, energy: "high", focus: "strong", stress_load: "low", cognitive_notes: null }] }, today);
  assert.ok(facts.some((f) => f.domain === "Attention"));
});

test("deleted content items are excluded from tier3MeaningfulFacts", () => {
  const facts = tier3MeaningfulFacts({ experiments: [], forecasts: [], assets: [], content: [{ id: "del", title: "Deleted Post", status: "draft", deleted_at: "2026-09-01", due_date: null }], dailyStates: [] }, today);
  assert.ok(!facts.some((f) => f.id === "Content:del"));
});

// ─── Cross-domain synthesis ───────────────────────────────────────────────────

test("growth friction synthesis fires when KPI deteriorating + experiments failed", () => {
  const syntheses = crossDomainSynthesis(
    { kpis: [{ id: "k1", name: "Qualified leads", trend: "deteriorating", status: "attention", reason: "down 30%" }], experiments: [{ id: "e1", name: "Lead Gen Test", status: "completed", outcome_result: "NOT_SUPPORTED" }], content: [], decisions: [], projects: [], commitments: [], systems: [], forecasts: [] },
    today
  );
  assert.ok(syntheses.some((s) => s.id === "synth:growth_friction"));
});

test("estimation calibration synthesis fires with 2+ missed forecasts + unreviewed decision", () => {
  const syntheses = crossDomainSynthesis(
    { kpis: [], experiments: [], content: [], decisions: [{ id: "d1", title: "Infrastructure choice", review_date: "2026-08-01", status: "proposed", founder_required: false, deleted_at: null }], projects: [], commitments: [], systems: [], forecasts: [{ id: "f1", prediction: "Sprint done", domain: "delivery", resolution: "incorrect", resolution_date: "2026-08-01", confidence: "high", predicted_outcome: "Done" }, { id: "f2", prediction: "Revenue hit", domain: "revenue", resolution: "incorrect", resolution_date: "2026-08-15", confidence: "medium", predicted_outcome: "200k" }] },
    today
  );
  assert.ok(syntheses.some((s) => s.id === "synth:estimation_calibration"));
});

// ─── Tier 3 migration integrity ───────────────────────────────────────────────

import { readFileSync } from "node:fs";

test("Tier 3 migration includes required tables, RLS, indexes and owner guards", () => {
  const sql = readFileSync("supabase/migrations/20260924170000_tier3_learning_synthesis.sql", "utf8");
  assert.ok(sql.includes("create table if not exists public.founder_forecasts"));
  assert.ok(sql.includes("create table if not exists public.founder_daily_states"));
  assert.ok(sql.includes("alter table public.founder_forecasts enable row level security"));
  assert.ok(sql.includes("alter table public.founder_daily_states enable row level security"));
  assert.ok(sql.includes("founder_forecasts_owner_updated_idx"));
  assert.ok(sql.includes("founder_daily_states_owner_date_idx"));
  assert.ok(sql.includes("founder_forecasts_owner_all"));
  assert.ok(sql.includes("founder_daily_states_owner_all"));
  assert.doesNotMatch(sql, /drop table|disable row level security|security definer/i);
});

test("lesson proposal trigger retains caller permissions after Tier 3", () => {
  const tier3 = readFileSync("supabase/migrations/20260924170000_tier3_learning_synthesis.sql", "utf8");
  const repair = readFileSync("supabase/migrations/20260925110000_restore_lesson_trigger_invoker.sql", "utf8");
  assert.match(tier3, /founder_propose_lesson\(\) returns trigger language plpgsql security invoker/i);
  assert.match(repair, /alter function public\.founder_propose_lesson\(\) security invoker/i);
});
