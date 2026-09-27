import test from 'node:test';
import assert from 'node:assert/strict';
import type {Risk} from '../src/lib/intelligence/types';
import {filterRisks,riskTrend,risksCsv} from '../src/lib/intelligence/risk-dashboard';
const risk:Risk={key:'one',entityType:'client',entityId:'client',severity:'low',score:8,title:'Acme commitments',reason:'Waiting item',evidence:[],recommendedAction:'Review',route:'/clients/client',updatedAt:'2026-09-20'};
test('risk filters combine query, severity, area, and sort without mutating inputs',()=>{
 const other={...risk,key:'two',severity:'high' as const,score:70,title:'Other risk',updatedAt:'2026-09-22'};
 const rows=[risk,other];
 assert.deepEqual(filterRisks(rows,'acme','low','Client Work','newest'),[risk]);
 assert.equal(filterRisks(rows,'','critical','all','score').length,0);
 assert.equal(filterRisks(rows,'','all','all','score')[0].key,'two');
 assert.equal(rows[0].key,'one');
});
test('history deduplicates signals and does not invent zero days',()=>{
 const history=[{snapshot_date:'2026-09-27',risk_key:'a',severity:'low',entity_type:'client'},{snapshot_date:'2026-09-27',risk_key:'a',severity:'low',entity_type:'client'},{snapshot_date:'2026-09-25',risk_key:'b',severity:'low',entity_type:'client'},{snapshot_date:'2026-08-01',risk_key:'c',severity:'low',entity_type:'client'}];
 assert.deepEqual(riskTrend(history,7,'2026-09-27'),[{date:'2026-09-25',total:1},{date:'2026-09-27',total:1}]);
});
test('CSV preserves commas/quotes and neutralizes spreadsheet formulas',()=>{
 const csv=risksCsv([{...risk,title:'=SUM(1,2)',reason:'He said "review"'}]);
 assert.ok(csv.includes('"\'=SUM(1,2)"'));assert.ok(csv.includes('"He said ""review"""'));assert.ok(csv.includes('"8"'));
});
