import test from 'node:test';
import assert from 'node:assert/strict';
import {convertMoneyInput,conversionDate,type ExchangeRate} from '../src/lib/currency/conversion';
const today='2026-09-27';
const rate=async(date:string):Promise<ExchangeRate>=>({base:'MAD',quote:'USD',date,rate:.10416});
test('MAD expense becomes rounded USD and keeps original amount and historical rate',async()=>{
 const result=await convertMoneyInput({currency:'MAD',amount:1000,expense_date:'2026-09-04'},rate,today);
 assert.deepEqual(result.value,{currency:'USD',amount:104.16,expense_date:'2026-09-04'});
 assert.equal(result.conversions[0].original.amount,1000);assert.equal(result.conversions[0].rate.date,'2026-09-04');
});
test('USD never changes or requests a rate, including an already converted edit',async()=>{
 const input={currency:'USD',amount:104.16};const result=await convertMoneyInput(input,async()=>{throw Error('must not fetch')},today);assert.deepEqual(result.value,input);assert.equal(result.conversions.length,0);
});
test('order lines inherit currency; quantities and percentages do not convert',async()=>{
 const {value}=await convertMoneyInput({currency:'MAD',tax_amount:100,probability:50,items:[{unit_price:1000,quantity:3},{currency:'USD',unit_price:5,quantity:2}]},rate,today);
 assert.deepEqual(value,{currency:'USD',tax_amount:10.42,probability:50,items:[{unit_price:104.16,quantity:3},{currency:'USD',unit_price:5,quantity:2}]});
});
test('financial sales goals convert but lead counts and experiment metrics do not',async()=>{
 const x=await convertMoneyInput([{currency:'MAD',metric_type:'new_leads',target_value:20},{currency:'MAD',metric_type:'monthly_revenue',target_value:1000},{currency:'MAD',target_metric:'clicks',target_value:200,budget:100}],rate,today);
 assert.deepEqual(x.value,[{currency:'USD',metric_type:'new_leads',target_value:20},{currency:'USD',metric_type:'monthly_revenue',target_value:104.16},{currency:'USD',target_metric:'clicks',target_value:200,budget:10.42}]);
});
test('metric currency, negative balances, null values and zero are handled',async()=>{
 const x=await convertMoneyInput({metric_currency:'MAD',attributed_revenue:1000,production_cost:null,balance:-100,amount:0},rate,today);assert.deepEqual(x.value,{metric_currency:'USD',attributed_revenue:104.16,production_cost:null,balance:-10.42,amount:0});
});
test('unavailable or invalid rates block conversion instead of relabeling money',async()=>{
 for(const bad of [0,-1,NaN,Infinity])await assert.rejects(convertMoneyInput({currency:'MAD',amount:100},async()=>({...await rate(today),rate:bad}),today));
 await assert.rejects(convertMoneyInput({currency:'MAD',amount:100},async()=>{throw Error('offline')},today),/offline/);
 await assert.rejects(convertMoneyInput({currency:'MAD',amount:100},async()=>({...await rate(today),date:'2026-09-28'}),today));
});
test('undated and planned future entries use today, published prior-day rate remains explicit',async()=>{
 assert.equal(conversionDate({due_at:'2027-01-01'},today),today);
 assert.equal(conversionDate({expense_date:'2027-01-01'},today),today);
 const x=await convertMoneyInput({currency:'MAD',amount:100},async()=>({...await rate(today),date:'2026-09-25'}),today);assert.equal(x.conversions[0].requestedDate,today);assert.equal(x.conversions[0].rate.date,'2026-09-25');
});
