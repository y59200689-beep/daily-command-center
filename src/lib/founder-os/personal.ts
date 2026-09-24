import type { Row } from "./repository";
import { daysUntil, wealthSummary, type Sources, type Signal } from "./intelligence";
// Carry each recorded valuation forward; currencies remain independent. Missing older
// liquidity metadata stays unknown instead of becoming a fabricated historical balance.
export function wealthTimeline(history: Row[]) {
 const dates=[...new Set(history.map(r=>String(r.valued_on)))].sort();
 return dates.map(date=>{const latest=new Map<string,Row>();for(const row of history.filter(r=>String(r.valued_on)<=date).sort((a,b)=>String(a.valued_on).localeCompare(String(b.valued_on))))latest.set(String(row.entry_id),row);const rows=[...latest.values()];return {date,currencies:wealthSummary(rows),liquidityKnown:rows.every(r=>typeof r.liquid==='boolean')};});
}
export function personalSignals(data:Sources,today:string):Signal[]{
 const result:Signal[]=[];
 const add=(r:Row,type:string,reasons:string[],impact:string,action:string,route:string,deadline?:string)=>result.push({id:`personal:${r.id}:${type}`,sourceId:r.id,title:String(r.title??r.name??r.label),type,domain:'personal',severity:'high',reasons,impact,action,route,deadline,detectedAt:today});
 for(const r of data.wealth??[]){const days=daysUntil(r.due_date,today);if(r.kind==='liability'&&r.material===true&&Number(r.amount)>0&&days!==null&&days<=30)add(r,'LARGE_OBLIGATION_SOON',[`${r.amount} ${r.currency} outstanding; due ${r.due_date}`,'Explicitly marked as a major personal obligation.'],'Personal liquidity may be needed for this payment.','Review balance and payment plan',`/life/wealth?record=${r.id}`,String(r.due_date));}
 const timeline=wealthTimeline((data.wealthHistory??[]).filter(r=>String(r.valued_on)<=today));const current=timeline.at(-1),previous=timeline.at(-2);
 if(current?.liquidityKnown&&previous?.liquidityKnown)for(const [currency,now] of Object.entries(current.currencies)){const before=previous.currencies[currency];if(before?.liquid>0&&now.liquid<=before.liquid*.8)add({id:`liquidity-${currency}`,name:`Personal liquidity: ${currency}`},'WEALTH_LIQUIDITY_CHANGE',[`Recorded liquid assets fell from ${before.liquid} to ${now.liquid} ${currency}.`,`Valuation dates: ${previous.date} → ${current.date}; no exchange conversion.`],'Less immediately available wealth may affect personal payment capacity.','Review valuation changes','/life/wealth');}
 for(const trip of (data.trips??[]).filter(r=>!r.archived_at&&!['completed','canceled'].includes(String(r.status))&&!r.actual_departure)){
  for(const [field,type] of [['insurance_expiry','INSURANCE_EXPIRY'],['administrative_deadline','TRAVEL_DEADLINE_SOON'],['end_date','DEPARTURE_REQUIRED_SOON']] as const){const days=daysUntil(trip[field],today);if(days!==null&&days<=14)add(trip,type,[`${field.replaceAll('_',' ')}: ${trip[field]}`,`Based on entered dates: ${days} days remaining.`],'Travel readiness or a recorded administrative deadline needs attention.','Review entered travel requirements',`/travel/mobility?record=${trip.id}`,String(trip[field]));}
  const start=daysUntil(trip.start_date,today),passport=(data.documents??[]).find(r=>r.id===trip.passport_document_id);if(trip.passport_required&&start!==null&&start<=30&&(!passport||passport.verification_status!=='verified'||(daysUntil(passport.expires_at,today)??1)<0))add(trip,'DOCUMENT_REQUIRED',['Passport required; an unexpired verified passport has not been linked.'],'Travel preparation lacks verified document evidence.','Link and verify the required passport',`/travel/mobility?record=${trip.id}`);
 }
 return result;
}
