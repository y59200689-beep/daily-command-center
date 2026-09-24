import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadFinancialControl } from '../src/lib/financial-server';

test('financial overview reads inventory using its actual captured_at timestamp', async () => {
  const reads: string[] = [];
  const client = { from(table: string) {
    reads.push(table);
    const builder = {
      select() { return builder; }, eq() { return builder; }, is() { return builder; },
      order(column: string) {
        if (table === 'inventory_snapshots') assert.equal(column, 'captured_at', 'inventory_snapshots has no created_at column');
        return builder;
      },
      limit() { return builder; },
      then(resolve: (value: { data: never[]; error: null }) => unknown) { return Promise.resolve(resolve({ data: [], error: null })); },
    };
    return builder;
  } } as unknown as SupabaseClient;
  const overview = await loadFinancialControl(client, 'owner', '2026-09-23');
  assert.ok(reads.includes('inventory_snapshots'));
  assert.deepEqual(overview.cash, []);
  assert.deepEqual(overview.runway, []);
});
