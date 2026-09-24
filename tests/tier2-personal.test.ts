import test from 'node:test';
import assert from 'node:assert/strict';
import { wealthTimeline,personalSignals } from '../src/lib/founder-os/personal';
import { mobilityState,buildFounderState } from '../src/lib/founder-os/intelligence';
const today='2026-09-24';
test('wealth carries valuations forward without currency mixing or fabricated old liquidity',()=>{
 const history=[{id:'a',entry_id:'a',valued_on:'2026-09-01',kind:'asset',amount:100,currency:'USD',liquid:true},{id:'b',entry_id:'b',valued_on:'2026-09-01',kind:'liability',amount:20,currency:'MAD',liquid:false},{id:'c',entry_id:'a',valued_on:today,kind:'asset',amount:70,currency:'USD',liquid:true}];
 const result=wealthTimeline(history);assert.equal(result[1].currencies.USD.net,70);assert.equal(result[1].currencies.MAD.net,-20);assert.equal(personalSignals({wealthHistory:history},today)[0].type,'WEALTH_LIQUIDITY_CHANGE');
 assert.equal(wealthTimeline([{...history[0],liquid:undefined}])[0].liquidityKnown,false);
});
test('departed stay stops its clock and pending travel requires document evidence',()=>{
 const trip={id:'t',title:'Stay',start_date:'2026-09-01',actual_departure:'2026-09-10',allowed_stay_days:30,status:'in_progress',passport_required:true};
 assert.equal(mobilityState(trip,today).used,10);assert.deepEqual(personalSignals({trips:[trip]},today),[]);
 assert.equal(personalSignals({trips:[{...trip,actual_departure:null}]},today)[0].type,'DOCUMENT_REQUIRED');
});
test('major obligations and chosen document reminder policy enter founder state',()=>{
 const state=buildFounderState({wealth:[{id:'w',name:'Tax',kind:'liability',amount:200,currency:'MAD',material:true,due_date:'2026-10-01'}],documents:[{id:'d',label:'Passport',expires_at:'2026-12-01',reminder_days:90}]},today);
 assert.ok(state.signals.some(s=>s.type==='LARGE_OBLIGATION_SOON'));assert.ok(state.signals.some(s=>s.type==='DOCUMENT_EXPIRING'));
});
