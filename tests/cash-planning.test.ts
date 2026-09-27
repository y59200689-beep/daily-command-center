import test from 'node:test';
import assert from 'node:assert/strict';
import { cashMovementHistory, reserveCoverage } from '../src/lib/cash-planning';

test('cash history separates currencies and excludes future receipts', () => {
  const rows = [
    { id: '1', currency: 'MAD', amount: 1200, payment_date: '2026-09-02' },
    { id: '2', currency: 'USD', amount: 900, payment_date: '2026-09-03' },
    { id: '3', currency: 'MAD', amount: 300, payment_date: '2026-09-30' },
  ];
  assert.equal(cashMovementHistory(rows, [], 'MAD', '2026-09-27', 3)[2].inflow, 1200);
});
test('cash outflow uses settlement date and paid status, never due date', () => {
  const obligations = [
    { id: '1', currency: 'MAD', amount: 500, status: 'paid', paid_at: '2026-09-03T12:00:00Z', due_date: '2026-08-01' },
    { id: '2', currency: 'MAD', amount: 900, status: 'scheduled', paid_at: '2026-09-03', due_date: '2026-09-01' },
    { id: '3', currency: 'MAD', amount: 800, status: 'paid', due_date: '2026-09-01' },
    { id: '4', currency: 'USD', amount: 600, status: 'paid', paid_at: '2026-09-03' },
  ];
  assert.equal(cashMovementHistory([], obligations, 'MAD', '2026-09-27', 1)[0].outflow, 500);
});
test('monthly history crosses year boundary in chronological order', () => {
  assert.deepEqual(cashMovementHistory([], [], 'MAD', '2026-01-15', 3).map(row => row.month), ['2025-11','2025-12','2026-01']);
});
test('reserve coverage distinguishes unavailable inputs from a zero balance', () => {
  assert.equal(reserveCoverage(null, 100), null);
  assert.equal(reserveCoverage(100, null), null);
  assert.equal(reserveCoverage(100, 0), null);
  assert.equal(reserveCoverage(0, 100), 0);
  assert.equal(reserveCoverage(150, 100), 150);
  assert.equal(reserveCoverage(-10, 100), 0);
});
