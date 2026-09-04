import test from "node:test";
import assert from "node:assert/strict";
import { effectiveInvoiceStatus, invoiceTotals } from "../src/lib/v2";

test("invoice totals preserve partial and full payment balances", () => {
  assert.deepEqual(invoiceTotals({ subtotal: 1000, taxAmount: 200, discountAmount: 50, amountPaid: 300 }), { total: 1150, remaining: 850, status: "partial" });
  assert.deepEqual(invoiceTotals({ subtotal: 1000, taxAmount: 0, discountAmount: 0, amountPaid: 1000 }), { total: 1000, remaining: 0, status: "paid" });
});

test("invoice totals reject negative balances and overpayment", () => {
  assert.throws(() => invoiceTotals({ subtotal: 100, taxAmount: 0, discountAmount: 101, amountPaid: 0 }));
  assert.throws(() => invoiceTotals({ subtotal: 100, taxAmount: 0, discountAmount: 0, amountPaid: 101 }));
});

test("effective invoice status derives overdue without mutating stored state", () => {
  assert.equal(effectiveInvoiceStatus({ status: "sent", due_date: "2026-09-01", amount_remaining: 500 }, "2026-09-04"), "overdue");
  assert.equal(effectiveInvoiceStatus({ status: "paid", due_date: "2026-09-01", amount_remaining: 0 }, "2026-09-04"), "paid");
});
