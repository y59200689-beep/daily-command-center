import assert from "node:assert/strict";
import test from "node:test";
import { emptyGrowthSnapshot, growthStageSeries, growthTotals, serviceRevenueSeries } from "../src/lib/growth-dashboard";
const now = new Date("2026-09-27T12:00:00Z");
test("growth totals isolate currencies, issued invoices and actual won dates", () => {
  const snapshot = { ...emptyGrowthSnapshot, opportunities: [{id:"a",currency:"MAD",stage:"proposal",estimated_value:100},{id:"b",currency:"USD",stage:"proposal",estimated_value:900},{id:"c",currency:"MAD",stage:"won",estimated_value:250,won_at:"2026-09-02"},{id:"d",currency:"MAD",stage:"won",estimated_value:700,won_at:"2026-08-02"}], invoices: [{id:"i",currency:"MAD",status:"sent",total_amount:400},{id:"draft",currency:"MAD",status:"draft",total_amount:900},{id:"usd",currency:"USD",status:"paid",total_amount:500}], payments: [{id:"p",currency:"MAD",amount:120},{id:"u",currency:"USD",amount:900}] };
  assert.deepEqual(growthTotals(snapshot,"MAD",now),{openPipeline:100,wonThisMonth:250,invoicedTotal:400,collectedTotal:120});
});
test("stage series group discovery and meeting and use a consistent period denominator", () => {
  const rows = [{id:"a",stage:"new",currency:"MAD",estimated_value:100,updated_at:"2026-09-01"},{id:"b",stage:"meeting",currency:"MAD",estimated_value:300,updated_at:"2026-09-05"},{id:"c",stage:"won",currency:"MAD",estimated_value:500,updated_at:"2026-08-01"}];
  const result = growthStageSeries(rows,"MAD","this_month",now);
  assert.equal(result.total,400); assert.equal(result.series.find(row=>row.id==="qualified")?.share,75); assert.equal(result.series.find(row=>row.id==="new")?.value,100); assert.equal(result.series.find(row=>row.id==="won")?.value,0);
});
test("service chart sums accepted line values once without counting whole proposals per service", () => {
  const snapshot = { ...emptyGrowthSnapshot, services:[{id:"s"},{id:"s2"}], proposals:[{id:"p",status:"accepted",currency:"MAD",total:1000,accepted_at:"2026-09-04",client_id:"c"},{id:"usd",status:"accepted",currency:"USD",accepted_at:"2026-09-04"},{id:"draft",status:"draft",currency:"MAD",updated_at:"2026-09-04"}], proposalItems:[{id:"a",proposal_id:"p",service_id:"s",total:150},{id:"b",proposal_id:"p",service_id:"s2",total:200},{id:"c",proposal_id:"usd",service_id:"s",total:900},{id:"d",proposal_id:"draft",service_id:"s",total:900}] };
  const result=serviceRevenueSeries(snapshot,"MAD",6,now);
  assert.equal(result.revenue,350);assert.equal(result.clients,1);assert.equal(result.services,2);assert.equal(result.accepted,1);assert.equal(result.buckets.length,6);assert.equal(result.buckets[5].value,350);
});
