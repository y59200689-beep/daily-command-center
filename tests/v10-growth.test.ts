import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  scoreOpportunity,
  evaluatePipelineQuality,
  identifyExpansionCandidates,
  identifyDormantClients,
  identifyLeadReactivations,
  computeOfferIntelligence,
  computeChannelPerformance,
  buildGrowthForecast,
  rankNextGrowthMove,
} from "../src/lib/growth";

test("V10 opportunity scoring is deterministic and handles deal health", () => {
  const opp = {
    id: "opp-1",
    title: "Client Redesign",
    stage: "proposal_sent",
    estimated_value: 50000,
    currency: "MAD",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-02T00:00:00Z",
    next_step_due: "2026-09-05",
  };
  const scored = scoreOpportunity(opp, "2026-09-07");
  assert.ok(typeof scored.score === "number");
  assert.ok(["Healthy", "Needs attention", "At risk", "Stalled"].includes(scored.health));
  assert.ok(Array.isArray(scored.reasons));
  assert.ok(scored.reasons.length > 0);
});

test("V10 pipeline quality evaluates coverage, concentration, and stage health", () => {
  const opps = [
    { id: "1", title: "Opp A", stage: "discovery", estimated_value: 20000, updated_at: "2026-09-05" },
    { id: "2", title: "Opp B", stage: "proposal_sent", estimated_value: 80000, updated_at: "2026-09-06" },
  ];
  const quality = evaluatePipelineQuality(opps, "2026-09-07");
  assert.equal(quality.totalOpenValue, 100000);
  assert.equal(quality.openCount, 2);
  assert.ok(Array.isArray(quality.qualitySignals));
  assert.ok(typeof quality.stageDistribution === "object");
});

test("V10 expansion and dormant client detection are rule-based and deterministic", () => {
  const clients = [{ id: "c-1", name: "Alpha Corp", status: "active", updated_at: "2026-01-01" }];
  const projects = [{ id: "p-1", client_id: "c-1", name: "Web App", status: "completed", updated_at: "2026-02-01" }];
  const invoices = [{ id: "inv-1", client_id: "c-1", total_amount: 30000, status: "paid", updated_at: "2026-02-01" }];
  const services = [{ client_id: "c-1", service_name: "Maintenance" }];

  const expansion = identifyExpansionCandidates(clients, projects, invoices, services, "2026-09-07");
  assert.ok(Array.isArray(expansion));
  assert.ok(expansion.length > 0);
  assert.equal(expansion[0].clientId, "c-1");

  const dormant = identifyDormantClients(clients, projects, invoices, "2026-09-07");
  assert.ok(Array.isArray(dormant));
  assert.ok(dormant.length > 0);
  assert.equal(dormant[0].clientId, "c-1");
});

test("V10 lead reactivations identify dormant qualified leads", () => {
  const leads = [
    {
      id: "l-1",
      name: "Samir",
      company: "Beta Tech",
      status: "contacted",
      potential_value: 40000,
      last_contact_at: "2026-05-01",
    },
  ];
  const opps: Array<{ lead_id?: string; lost_reason?: string; stage: string }> = [];
  const reactivations = identifyLeadReactivations(leads, opps, "2026-09-07");
  assert.ok(reactivations.length > 0);
  assert.equal(reactivations[0].leadId, "l-1");
});

test("V10 offer intelligence and channel performance compute correct aggregations", () => {
  const services = [{ id: "s-1", name: "SEO Audit", category: "Marketing" }];
  const proposalItems = [{ id: "pi-1", proposal_id: "pr-1", service_id: "s-1", total: 15000 }];
  const proposals = [{ id: "pr-1", status: "accepted", total: 15000, opportunity_id: "o-1" }];
  const opps = [{ id: "o-1", stage: "won", estimated_value: 15000, source: "linkedin" }];
  const leads = [{ id: "l-1", source: "linkedin", status: "qualified" }];

  const offers = computeOfferIntelligence(services, proposalItems, proposals, opps);
  assert.ok(offers.length > 0);
  assert.equal(offers[0].proposalCount, 1);
  assert.equal(offers[0].winCount, 1);
  assert.equal(offers[0].revenue, 15000);

  const perf = computeChannelPerformance(leads, opps, proposals);
  assert.ok(perf.channels.length > 0);
  const linkedin = perf.channels.find((c) => c.channel === "linkedin");
  assert.ok(linkedin);
  assert.equal(linkedin?.leadCount, 1);
  assert.equal(linkedin?.winCount, 1);
});

test("V10 forecast bucketing computes commit, likely, and possible", () => {
  const opps = [
    { id: "1", title: "Deal 1", stage: "negotiation", estimated_value: 50000 },
    { id: "2", title: "Deal 2", stage: "proposal", estimated_value: 30000 },
    { id: "3", title: "Deal 3", stage: "qualified", estimated_value: 20000 },
  ];
  const proposals: Array<{ id: string; opportunity_id?: string; status: string; total: number }> = [];
  const forecast = buildGrowthForecast(opps, proposals);
  assert.equal(forecast.totalsByBucket.Committed, 50000);
  assert.equal(forecast.totalsByBucket.Likely, 30000);
  assert.equal(forecast.totalsByBucket.Possible, 20000);
  assert.equal(forecast.totalOpenValue, 100000);
});

test("V10 rankNextGrowthMove produces actionable, prioritized suggestions", () => {
  const opps = [
    {
      id: "opp-1",
      title: "Big Deal",
      stage: "proposal_sent",
      estimated_value: 100000,
      next_step_due: "2026-09-01",
      currency: "MAD",
    },
  ];
  const move = rankNextGrowthMove(opps, [], [], "2026-09-07");
  assert.ok(move);
  assert.ok(move?.title);
  assert.ok(move?.reason);
  assert.ok(move?.route);
});

test("V10 migration is additive, indexed, owner-scoped, and private", async () => {
  const source = await readFile(
    new URL("../supabase/migrations/20260907153500_v10_sales_growth_operating_system.sql", import.meta.url),
    "utf8"
  );
  for (const table of ["sales_playbooks", "playbook_runs", "growth_experiments", "deal_reviews", "sales_targets"]) {
    assert.match(source, new RegExp(`create table if not exists ${table}`));
  }
  assert.match(source, /enable row level security/);
  assert.match(source, /user_id/);
});

test("V10 navigation, automations, and notification producers are connected", async () => {
  const [shell, automations, producers] = await Promise.all([
    readFile(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/v4.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/notification-producers.ts", import.meta.url), "utf8"),
  ]);

  assert.ok(shell.includes('["Growth", "/growth"'));
  assert.ok(automations.includes("proposal_followup_review"));
  assert.ok(automations.includes("pipeline_hygiene"));
  assert.ok(producers.includes("growth:proposal-followup:"));
  assert.ok(producers.includes("growth:lead-followup:"));
});

test("V10 global search and command palette expose growth surfaces and records", async () => {
  const [searchRoute, palette] = await Promise.all([
    readFile(new URL("../src/app/api/search/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/command-palette.tsx", import.meta.url), "utf8"),
  ]);

  assert.ok(searchRoute.includes("sales_playbooks"));
  assert.ok(searchRoute.includes("growth_experiments"));
  assert.ok(searchRoute.includes("sales_targets"));
  assert.ok(searchRoute.includes("growthRows"));

  assert.ok(palette.includes("Open Growth"));
  assert.ok(palette.includes("Open Growth Pipeline"));
  assert.ok(palette.includes("Open Sales Playbooks"));
  assert.ok(palette.includes("Open Growth Experiments"));
  assert.ok(palette.includes("Open Growth Forecast"));
  assert.ok(palette.includes("/growth/playbooks"));
  assert.ok(palette.includes("/growth/experiments"));
  assert.ok(palette.includes("/growth/reviews"));
});

test("V10 Today integration caps growth signals at max 2 and Weekly Review aggregates growth metrics", async () => {
  const [todayRoute, todayUI, weeklyRoute, weeklyUI] = await Promise.all([
    readFile(new URL("../src/app/api/today/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/today/today-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/intelligence/review/weekly/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/intelligence/intelligence-pages.tsx", import.meta.url), "utf8"),
  ]);

  assert.ok(todayRoute.includes("growthSignals"));
  assert.match(todayRoute, /slice\(0,\s*2\)/);
  assert.ok(todayUI.includes("growthSignals"));

  assert.ok(weeklyRoute.includes("withGrowthReview"));
  assert.ok(weeklyRoute.includes("dealsWon"));
  assert.ok(weeklyRoute.includes("dealsLost"));
  assert.ok(weeklyUI.includes("Sales & Growth"));
});

test("V10 AI assistant tools include read and confirmation-gated write operations", async () => {
  const [aiTools, assistantRoute] = await Promise.all([
    readFile(new URL("../src/lib/ai-tools.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/assistant/route.ts", import.meta.url), "utf8"),
  ]);

  for (const name of [
    "get_growth_overview",
    "get_growth_experiments",
    "get_expansion_candidates",
    "get_lead_reactivations",
    "create_growth_experiment",
    "create_sales_playbook",
    "create_sales_target",
    "record_deal_review",
  ]) {
    assert.ok(aiTools.includes(`"${name}"`));
  }

  // Confirmation guard must gate writes
  assert.ok(aiTools.includes("writeGuard(input.confirmed)"));

  // OpenAI key missing returns 503 calm unavailable state
  assert.ok(assistantRoute.includes('return NextResponse.json({error:"The assistant is not configured."},{status:503})'));
});

