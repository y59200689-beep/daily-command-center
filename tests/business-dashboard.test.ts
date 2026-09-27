import test from "node:test";
import assert from "node:assert/strict";
import { businessSummary, commercialState, forecastSeries, pipelineStages, type BusinessRecord } from "../src/lib/business-dashboard";
const now = new Date(2026, 8, 15, 12);
const row = (id: string, values: Record<string, unknown>): BusinessRecord => ({ id, ...values });

test("business summary keeps currencies separate and excludes closed records", () => {
  const records = {
    leads: [row("new",{status:"new"}),row("lost",{status:"lost"}),row("converted",{status:"converted"})],
    opportunities: [row("mad",{stage:"qualified",estimated_value:1000,currency:"MAD"}),row("eur",{stage:"negotiation",estimated_value:2000,currency:"EUR",probability:50}),row("won",{stage:"won",estimated_value:9000,currency:"MAD"})],
    proposals: [row("p",{status:"accepted",total:300,currency:"MAD"}),row("p2",{status:"accepted",total:900,currency:"EUR"}),row("draft",{status:"draft",total:500,currency:"MAD"})],
  };
  const mad = businessSummary(records,"MAD");
  assert.equal(mad.leads.length,1); assert.equal(mad.active.length,2);
  assert.equal(mad.weighted,250); assert.equal(mad.committed,300);
  assert.equal(businessSummary(records,"EUR").weighted,1000);
});
test("pipeline combines meeting and qualified, preserves explicit zero probability, and excludes lost", () => {
  const stages = pipelineStages([row("q",{stage:"qualified",estimated_value:1000,currency:"MAD",probability:0}),row("m",{stage:"meeting",estimated_value:1000,currency:"MAD"}),row("lost",{stage:"lost",estimated_value:10000,currency:"MAD"})],"MAD","weighted");
  assert.equal(stages[1].count,2); assert.equal(stages[1].value,400); assert.equal(stages[1].percent,100);
  assert.equal(stages.reduce((sum,stage)=>sum+stage.count,0),2);
});
test("win rate counts closed deals and is unavailable without a closed deal", () => {
  const opportunities = [row("won",{stage:"won",updated_at:"2026-09-10T12:00:00Z"}),row("lost",{stage:"lost",updated_at:"2026-09-11T12:00:00Z"}),row("open",{stage:"qualified",updated_at:"2026-09-12T12:00:00Z"}),row("old",{stage:"won",updated_at:"2026-08-11T12:00:00Z"})];
  assert.equal(commercialState(opportunities,[],"this_month",now).winRate,50);
  assert.equal(commercialState([opportunities[2]],[],"this_month",now).winRate,null);
});
test("forecast excludes accepted opportunity duplicates, separates undated values and excludes other currencies", () => {
  const proposals = [row("accepted",{status:"accepted",opportunity_id:"duplicate",currency:"MAD",total:400,accepted_at:"2026-09-03T12:00:00Z"})];
  const opportunities = [row("duplicate",{stage:"proposal",estimated_value:1000,currency:"MAD",expected_close_date:"2026-09-03"}),row("planned",{stage:"negotiation",estimated_value:2000,currency:"MAD",probability:50,expected_close_date:"2026-09-10"}),row("undated",{stage:"qualified",estimated_value:800,currency:"MAD"}),row("eur",{stage:"negotiation",estimated_value:9000,currency:"EUR",expected_close_date:"2026-09-10"}),row("next",{stage:"negotiation",estimated_value:9000,currency:"MAD",expected_close_date:"2026-10-10"})];
  const result = forecastSeries(opportunities,proposals,"MAD","this_month",now);
  assert.equal(result.committed,400); assert.equal(result.potential,1000); assert.equal(result.unscheduled,200);
  assert.equal(result.buckets[0].committed,400); assert.equal(result.buckets[1].potential,1000);
});
test("quarter forecast creates monthly buckets without carrying out-of-period commitments", () => {
  const result = forecastSeries([row("q",{stage:"qualified",currency:"MAD",estimated_value:4000,expected_close_date:"2026-08-20"})],[row("old",{status:"accepted",currency:"MAD",total:900,accepted_at:"2026-06-30T12:00:00Z"})],"MAD","quarter",now);
  assert.deepEqual(result.buckets.map(bucket=>bucket.label),["Jul","Aug","Sep"]);
  assert.equal(result.buckets[1].potential,1000); assert.equal(result.committed,0);
});
