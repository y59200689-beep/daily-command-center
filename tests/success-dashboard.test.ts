import test from 'node:test';
import assert from 'node:assert/strict';
import {filterSuccessAccounts,nextRenewal,nextCheckIn,latestSignal,type SuccessAccount} from '../src/lib/success-dashboard';
const account={client:{id:'a',name:'Acme',company:'Studio',status:'active'},owners:[{id:'owner',name:'Sarah'}],health:{state:'healthy',summary:''},engagement:{state:'active'},checkIns:[],renewals:[],signals:[],issues:[],commitments:[],counts:{openIssues:0,openRisks:0,openCommitments:0}} satisfies SuccessAccount;
test('portfolio filters combine name/company, health, and actual ownership',()=>{
 assert.equal(filterSuccessAccounts([account],' studio ','healthy','owner').length,1);
 assert.equal(filterSuccessAccounts([account],'sarah','all','all').length,1);
 assert.equal(filterSuccessAccounts([account],'','critical','owner').length,0);
 assert.equal(filterSuccessAccounts([account],'','all','unassigned').length,0);
 assert.equal(filterSuccessAccounts([{...account,owners:[]}],'','all','unassigned').length,1);
});
test('next renewal excludes closed renewals and does not reorder source records',()=>{
 const rows=[{id:'later',renewal_date:'2026-12-01',status:'upcoming'},{id:'closed',renewal_date:'2026-09-01',status:'renewed'},{id:'next',renewal_date:'2026-10-01',status:'discussing'}];
 const a={...account,renewals:rows.map(r=>({...r,client_id:'a',renewal_type:'retainer',forecast_category:'likely',currency:'MAD',preparation_state:'not_started'}))} as SuccessAccount;
 assert.equal(nextRenewal(a)?.id,'next'); assert.equal(a.renewals[0].id,'later');
});
test('next check-in excludes completed and undated entries',()=>{
 const a={...account,checkIns:[{id:'done',status:'completed',scheduled_at:'2026-09-01'},{id:'unknown',status:'scheduled'},{id:'next',status:'scheduled',scheduled_at:'2026-10-01'}].map(r=>({...r,client_id:'a',check_in_type:'routine',purpose:'Review'}))} as SuccessAccount;
 assert.equal(nextCheckIn(a)?.id,'next');
});
test('latest satisfaction signal is chosen chronologically without mutating data',()=>{
 const a={...account,signals:[{id:'old',recorded_at:'2026-08-01'},{id:'new',recorded_at:'2026-09-01'}].map(r=>({...r,client_id:'a',signal_type:'positive_feedback',source:'call',summary:'Feedback'}))} as SuccessAccount;
 assert.equal(latestSignal(a)?.id,'new');assert.equal(a.signals[0].id,'old'); assert.equal(latestSignal(account),undefined);
});
