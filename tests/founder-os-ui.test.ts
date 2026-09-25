import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FounderStatePanel, SignalRow } from "../src/features/founder-os/state-view";
import { buildFounderState } from "../src/lib/founder-os/intelligence";
const today = "2026-09-22";
test("Founder State renders the no-intervention state without placeholder data", () => { const html = renderToStaticMarkup(createElement(FounderStatePanel, { state: buildFounderState({}, today) })); assert.match(html, /No critical intervention required/); assert.doesNotMatch(html, /Risk =|Paraonline|82/); });
test("critical issue, waiting, expired document, renewal, and decision review render with evidence", () => {
 const state = buildFounderState({ issues: [{ id: "i", title: "Production blocked", status: "open", severity: "critical", urgency: "immediate" }], waiting: [{ id: "w", title: "Awaiting supplier", status: "waiting", importance: "high", expected_by: "2026-09-20" }], documents: [{ id: "p", label: "Expired document", expires_at: "2026-09-21" }], systems: [{ id: "s", name: "Domain renewal", status: "active", criticality: "critical", owner_label: "Owner", renewal_date: "2026-09-24" }], decisions: [{ id: "d", title: "Decision review", status: "active", review_date: today }] }, today);
 const html = renderToStaticMarkup(createElement(FounderStatePanel, { state }));
 for (const label of ["Production blocked", "Awaiting supplier", "Expired document", "Domain renewal", "Decision review", "Why am I seeing this?"]) assert.ok(html.includes(label));
 assert.match(html, /<summary>/); assert.match(html, /href="\/issues\?record=i"/);
});
test("KPI row renders its measured threshold explanation", () => { const s = buildFounderState({ kpis: [{ id: "k", name: "Orders", current_value: 8, critical_threshold: 10, direction: "higher", source: "commerce_orders", frequency: "monthly" }] }, today); const html = renderToStaticMarkup(createElement(SignalRow, { signal: s.signals[0] })); assert.match(html, /Orders/); assert.match(html, /critical threshold 10/); });
test("missing sources render incomplete monitoring instead of a green status", () => { const html = renderToStaticMarkup(createElement(FounderStatePanel, { state: buildFounderState({}, today, [{ source: "documents", status: "unavailable", count: 0 }]) })); assert.match(html, /Monitoring is incomplete/); assert.match(html, /documents \(unavailable\)/); assert.doesNotMatch(html, /No critical intervention required/); });
