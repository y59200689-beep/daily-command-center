import test from 'node:test';
import assert from 'node:assert/strict';
import { filterLeads, followUpLabel, leadSummary, type LeadRow } from '../src/lib/leads-dashboard';
const now=new Date('2026-09-27T12:00:00');
const rows:LeadRow[]=[{id:'a',name:'Alpha',company:'Studio',status:'new',source:'website',created_at:'2026-09-25T12:00:00',updated_at:'2026-09-26',next_follow_up_at:'2026-09-27T18:00:00'},{id:'b',name:'Beta',status:'converted',source:'referral',created_at:'2026-09-01T12:00:00',next_follow_up_at:'2026-09-20T12:00:00'},{id:'c',name:'Gamma',status:'contacted',source:'website',created_at:'2026-09-22T12:00:00',next_follow_up_at:'2026-09-26T12:00:00'}];
const filters={query:'',source:[] as string[],status:'',stage:'',due:false,recent:false,sort:'updated'};
test('lead metrics count due today, exclude converted followups and use seven-day creation window',()=>{const result=leadSummary(rows,now);assert.equal(result.total,3);assert.equal(result.rate,33);assert.deepEqual(result.due.map(row=>row.id),['a','c']);assert.deepEqual(result.recent.map(row=>row.id),['a','c']);});
test('lead filters combine search, source and linked opportunity stage',()=>{const opportunities=[{id:'o',lead_id:'a',stage:'proposal'}];assert.deepEqual(filterLeads(rows,opportunities,{...filters,query:'studio',source:['website'],stage:'proposal'},now).map(row=>row.id),['a']);assert.equal(filterLeads(rows,opportunities,{...filters,status:'converted',stage:'proposal'},now).length,0);});
test('followup sorting puts missing dates last',()=>{const result=filterLeads([...rows,{id:'d',name:'No date'}],[],{...filters,sort:'followup'},now);assert.equal(result.at(-1)?.id,'d');assert.equal(result[0].id,'b');});
test('followup labels are calendar-day based',()=>{assert.equal(followUpLabel('2026-09-27T23:00:00',now),'Today');assert.equal(followUpLabel('2026-09-28T09:00:00',now),'Tomorrow');assert.equal(followUpLabel(null,now),'Not scheduled');});
test('empty lead metrics have no fabricated conversion rate',()=>{assert.equal(leadSummary([],now).rate,null);});

test('multiple lead sources use OR matching and can be cleared',()=>{assert.deepEqual(filterLeads(rows,[],{...filters,source:['website','referral']},now).map(row=>row.id),['a','b','c']);assert.deepEqual(filterLeads(rows,[],{...filters,source:['referral']},now).map(row=>row.id),['b']);assert.equal(filterLeads(rows,[],{...filters,source:[]},now).length,3);});
