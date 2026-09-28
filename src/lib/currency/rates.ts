import type { ExchangeRate } from './conversion';
const cache=new Map<string,{expires:number;value:ExchangeRate}>();
export async function madToUsd(date:string):Promise<ExchangeRate>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>new Date().toISOString().slice(0,10))throw new Error('Choose today or a past exchange-rate date.');
 const saved=cache.get(date);if(saved&&saved.expires>Date.now())return saved.value;
 const response=await fetch(`https://api.frankfurter.dev/v2/rate/MAD/USD?date=${date}`,{signal:AbortSignal.timeout(10000),cache:'no-store'});
 if(!response.ok)throw new Error('The exchange-rate service is unavailable. Please try again; no conversion was saved.');
 const rate=await response.json() as ExchangeRate;
 if(rate.base!=='MAD'||rate.quote!=='USD'||!Number.isFinite(rate.rate)||rate.rate<=0||!/^\d{4}-\d{2}-\d{2}$/.test(rate.date)||rate.date>date)throw new Error('The exchange-rate service returned an invalid rate.');
 cache.set(date,{value:rate,expires:Date.now()+3600000});return rate;
}
