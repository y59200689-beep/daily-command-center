'use client';
import {useEffect,useState,type SelectHTMLAttributes} from 'react';
import type {ExchangeRate} from '@/lib/currency/conversion';
import {StyledSelect} from '@/components/ui/styled-select';
export function CurrencySelect({date,value,styled=false,onValueChange,...props}:SelectHTMLAttributes<HTMLSelectElement>&{date?:string;styled?:boolean;onValueChange?:(value:string)=>void}){
 const [rate,setRate]=useState<(ExchangeRate & {requestedDate:string})|null>(null),[error,setError]=useState('');
 const today=new Date().toISOString().slice(0,10),day=date&&date.slice(0,10)<=today?date.slice(0,10):today;
 useEffect(()=>{if(value!=='MAD')return;const controller=new AbortController();fetch(`/api/currency/rate?date=${day}`,{signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error);setRate(body);setError('');}).catch(error=>{if(!controller.signal.aborted){setRate(null);setError(error.message||'Rate unavailable.');}});return()=>controller.abort();},[day,value]);
 const options=[{value:'USD',label:'$ · USD — US dollar'},{value:'MAD',label:'MAD — Moroccan dirham'},...(value&&value!=='USD'&&value!=='MAD'?[{value:String(value),label:String(value)}]:[])];
 return <span style={{display:'grid',gap:6}}>{styled?<StyledSelect id={props.id} label="Currency" value={String(value||'USD')} onChange={onValueChange??(()=>{})} options={options}/>:<select {...props} value={value||'USD'}>{options.map(option=><option value={option.value} key={option.value}>{option.label}</option>)}</select>}<small style={{fontSize:11,lineHeight:1.5,color:'var(--muted-foreground, #68708d)'}} aria-live="polite">{value==='MAD'?(error?'Exchange rate unavailable. Saving will retry the conversion.':rate?.requestedDate===day?`1 MAD = $${rate.rate.toFixed(5)} · Rate: ${rate.date}. Saved in USD using the transaction date (today for undated entries).`:'Loading daily exchange rate…'):'Amounts are saved and reported in US dollars ($).'}</small></span>;
}
