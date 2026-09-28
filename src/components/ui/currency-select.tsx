'use client';
import {useEffect,useState,type SelectHTMLAttributes} from 'react';
import type {ExchangeRate} from '@/lib/currency/conversion';
export function CurrencySelect({date,value,...props}:SelectHTMLAttributes<HTMLSelectElement>&{date?:string}){
 const [rate,setRate]=useState<(ExchangeRate & {requestedDate:string})|null>(null),[error,setError]=useState('');
 const today=new Date().toISOString().slice(0,10),day=date&&date.slice(0,10)<=today?date.slice(0,10):today;
 useEffect(()=>{if(value!=='MAD')return;const controller=new AbortController();fetch(`/api/currency/rate?date=${day}`,{signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error);setRate(body);setError('');}).catch(error=>{if(!controller.signal.aborted){setRate(null);setError(error.message||'Rate unavailable.');}});return()=>controller.abort();},[day,value]);
 return <span style={{display:'grid',gap:6}}><select {...props} value={value||'USD'}><option value="USD">$ · USD — US dollar</option><option value="MAD">MAD — Moroccan dirham</option>{value&&value!=='USD'&&value!=='MAD'?<option value={String(value)}>{String(value)}</option>:null}</select><small style={{fontSize:11,lineHeight:1.5,color:'var(--muted-foreground, #68708d)'}} aria-live="polite">{value==='MAD'?(error?'Exchange rate unavailable. Saving will retry the conversion.':rate?.requestedDate===day?`1 MAD = $${rate.rate.toFixed(5)} · Rate: ${rate.date}. Saved in USD using the transaction date (today for undated entries).`:'Loading daily exchange rate…'):'Amounts are saved and reported in US dollars ($).'}</small></span>;
}
