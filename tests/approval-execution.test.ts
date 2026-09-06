import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { approvalKind, calendarApprovalPreview, paymentApprovalPreview, planApprovalPreview } from "../src/lib/approval-execution";

const calendar = { operation: "update" as const, eventId: "11111111-1111-4111-8111-111111111111", before: { title: "Before", starts_at: "2026-09-06T09:00:00+00:00" }, after: { title: "After", starts_at: "2026-09-06T10:00:00+00:00" } };
const payment = { invoiceId: "11111111-1111-4111-8111-111111111111", amount: 1200, currency: "MAD", paymentDate: "2026-09-06", preparedOutstanding: 1200 };
const plan = { planDate: "2026-09-06", selectedTaskIds: ["11111111-1111-4111-8111-111111111111"], blocks: [] };

test("calendar approvals expose exact before and after preview", () => assert.deepEqual(calendarApprovalPreview(calendar), { operation: "update", before: calendar.before, after: calendar.after }));
test("calendar create, update, and delete operations are validated", () => { assert.equal(calendarApprovalPreview({ ...calendar, operation: "create" }).operation, "create"); assert.equal(calendarApprovalPreview({ ...calendar, operation: "delete" }).operation, "delete"); });
test("payment approval preview requires a positive owned-invoice payment", () => assert.equal(paymentApprovalPreview(payment).amount, 1200));
test("payment preview retains a partial-payment amount", () => assert.equal(paymentApprovalPreview({ ...payment, amount: 400 }).amount, 400));
test("payment preview rejects an overpayment-shaped negative amount", () => assert.throws(() => paymentApprovalPreview({ ...payment, amount: -1 })));
test("payment preview rejects an invalid invoice identifier", () => assert.throws(() => paymentApprovalPreview({ ...payment, invoiceId: "not-a-uuid" })));
test("payment preview retains editable date, method, and reference", () => { const value = paymentApprovalPreview({ ...payment, paymentMethod: "Bank", reference: "REF-1" }); assert.equal(value.paymentMethod, "Bank"); assert.equal(value.reference, "REF-1"); });
test("daily plan preview validates selected task IDs and blocks", () => assert.equal(planApprovalPreview(plan).selectedTaskIds.length, 1));
test("daily plan preview prevents more than three wins", () => assert.throws(() => planApprovalPreview({ ...plan, selectedTaskIds: Array(4).fill("11111111-1111-4111-8111-111111111111") })));
test("approval dispatcher identifies the supported calendar executor", () => assert.equal(approvalKind("reschedule_calendar_event"), "calendar"));
test("approval dispatcher identifies payment and plan executors", () => { assert.equal(approvalKind("record_payment"), "payment"); assert.equal(approvalKind("accept_daily_plan"), "plan"); });
test("approval dispatcher leaves unrelated actions outside these executors", () => assert.equal(approvalKind("send_email"), "other"));

test("approval migration adds executing and needs-review states", async () => { const migration = await readFile(new URL("../supabase/migrations/20260906031004_approval_executor_states.sql", import.meta.url), "utf8"); assert.match(migration, /'executing'/); assert.match(migration, /'needs_review'/); });
test("approval execution is claimed under an owner-scoped row lock", async () => { const migration = await readFile(new URL("../supabase/migrations/20260906031004_approval_executor_states.sql", import.meta.url), "utf8"); assert.match(migration, /where id = approval_id and user_id = auth\.uid\(\)/); assert.match(migration, /for update/); });
test("expired approvals cannot be claimed for execution", async () => { const migration = await readFile(new URL("../supabase/migrations/20260906031004_approval_executor_states.sql", import.meta.url), "utf8"); assert.match(migration, /status = 'expired'/); });
test("duplicate execution returns the prior executed state", async () => { const migration = await readFile(new URL("../supabase/migrations/20260906031004_approval_executor_states.sql", import.meta.url), "utf8"); assert.match(migration, /approval\.status = 'executed'/); });
test("calendar executor calls conflict-safe production Calendar functions", async () => { const source = await readFile(new URL("../src/lib/approval-execution.ts", import.meta.url), "utf8"); assert.match(source, /pushGoogleEvent/); assert.match(source, /deleteGoogleEvent/); assert.match(source, /calendar_event_sync_state/); });
test("calendar executor returns needs review instead of forcing an existing conflict", async () => { const source = await readFile(new URL("../src/lib/approval-execution.ts", import.meta.url), "utf8"); assert.match(source, /needs conflict review/); assert.match(source, /needsReview: true/); });
test("calendar executor revalidates expected local content before mutation", async () => { const source = await readFile(new URL("../src/lib/approval-execution.ts", import.meta.url), "utf8"); assert.match(source, /expectedUpdatedAt/); assert.match(source, /equalExpected/); });
test("payment executor records through the immutable payment RPC", async () => { const source = await readFile(new URL("../src/lib/approval-execution.ts", import.meta.url), "utf8"); assert.match(source, /rpc\("record_invoice_payment"/); assert.match(source, /amount_remaining/); });
test("payment executor detects a changed outstanding balance", async () => { const source = await readFile(new URL("../src/lib/approval-execution.ts", import.meta.url), "utf8"); assert.match(source, /preparedOutstanding/); assert.match(source, /Invoice balance changed/); });
test("plan executor revalidates task state and Calendar conflicts", async () => { const source = await readFile(new URL("../src/lib/approval-execution.ts", import.meta.url), "utf8"); assert.match(source, /getIntelligence/); assert.match(source, /planBlockConflicts/); assert.match(source, /accept_daily_plan/); });
test("plan executor rejects completed or changed tasks as stale", async () => { const source = await readFile(new URL("../src/lib/approval-execution.ts", import.meta.url), "utf8"); assert.match(source, /completed/); assert.match(source, /expectedTaskUpdatedAt/); });
test("approval route supports immediate execution and rejection audit", async () => { const source = await readFile(new URL("../src/app/api/approvals/route.ts", import.meta.url), "utf8"); assert.match(source, /executeApproval/); assert.match(source, /approval_rejected/); });
test("approval UI renders exact Calendar, payment, and plan previews", async () => { const source = await readFile(new URL("../src/features/v4/action-centers.tsx", import.meta.url), "utf8"); for (const text of ["Calendar change", "Before", "After", "Payment", "Today", "Edit payment"]) assert.match(source, new RegExp(text)); });
test("approval UI refreshes its owner-scoped queue after execution", async () => { const source = await readFile(new URL("../src/features/v4/action-centers.tsx", import.meta.url), "utf8"); assert.match(source, /await load\(\)/); assert.match(source, /cache: "no-store"/); });
