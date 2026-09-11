"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Row=Record<string,unknown>&{id:string};
type Data={invoices:Row[];payments:Row[];expenses:Row[];currency:string};
type Summary={id:string;name:string;invoiced:number;received:number;outstanding:number;overdue:number;expenses:number};

export function FinanceBreakdown({by}:{by:"clients"|"projects"}){
  const[data,setData]=useState<Data|null>(null);const[error,setError]=useState("");
  const load=useCallback(async()=>{try{const response=await fetch("/api/finance",{cache:"no-store"});const body=await response.json();if(!response.ok)throw new Error(body.error);setData(body)}catch(reason){setError(reason instanceof Error?reason.message:"Financial overview could not be loaded.")}},[]);
  useDeferredEffect(useCallback(()=>{void load()},[load]));
  const rows=useMemo(()=>{
    const map=new Map<string,Summary>();if(!data)return[];
    for(const invoice of data.invoices){if(String(invoice.currency??"MAD")!==data.currency)continue;const relation=invoice[by] as {id?:string;name?:string}|null;if(!relation?.id)continue;const item=map.get(relation.id)??{id:relation.id,name:relation.name??"Untitled",invoiced:0,received:0,outstanding:0,overdue:0,expenses:0};item.invoiced+=Number(invoice.total_amount??0);item.received+=Number(invoice.amount_paid??0);item.outstanding+=Number(invoice.amount_remaining??0);if(invoice.effective_status==="overdue")item.overdue+=Number(invoice.amount_remaining??0);map.set(item.id,item)}
    for(const expense of data.expenses){if(String(expense.currency??"MAD")!==data.currency)continue;const relation=expense[by] as {id?:string;name?:string}|null;if(!relation?.id)continue;const item=map.get(relation.id)??{id:relation.id,name:relation.name??"Untitled",invoiced:0,received:0,outstanding:0,overdue:0,expenses:0};item.expenses+=Number(expense.amount??0);map.set(item.id,item)}
    return[...map.values()].sort((a,b)=>b.outstanding-a.outstanding);
  },[by,data]);
  return <div className="domain-page"><header className="page-header"><div><p className="eyebrow">Financial overview · MAD</p><h1>{by==="clients"?"Client revenue":"Project finance"}</h1><p>{by==="clients"?"Lifetime billed, received, and overdue by relationship.":"Estimated value, direct costs, and cash collected by project."}</p></div></header><nav className="detail-tabs finance-subnav" aria-label="Finance sections"><Link href="/finance">Overview</Link><Link href="/finance/invoices">Invoices</Link><Link href="/finance/expenses">Expenses</Link><Link href="/finance/subscriptions">Subscriptions</Link><Link className={by==="clients"?"active":""} href="/finance/clients">Clients</Link><Link className={by==="projects"?"active":""} href="/finance/projects">Projects</Link></nav>{error?<div className="inline-error" role="alert"><p>{error}</p><Button emphasis="outline" onClick={()=>void load()}>Try again</Button></div>:!data?<div className="empty-state"><span>···</span><h2>Calculating relationships</h2></div>:rows.length?<div className="finance-breakdown">{rows.map((row)=><Link href={`/${by}/${row.id}`} key={row.id}><div><p className="eyebrow">{row.name}</p><strong>{row.received.toLocaleString()} {data.currency}</strong><span>received</span></div><dl><div><dt>Invoiced</dt><dd>{row.invoiced.toLocaleString()} {data.currency}</dd></div><div><dt>Outstanding</dt><dd>{row.outstanding.toLocaleString()} {data.currency}</dd></div><div><dt>Overdue</dt><dd>{row.overdue.toLocaleString()} {data.currency}</dd></div><div><dt>Direct expenses</dt><dd>{row.expenses.toLocaleString()} {data.currency}</dd></div></dl></Link>)}</div>:<div className="empty-state"><span>∅</span><h2>No linked financial records</h2><p>Link invoices and expenses to {by} to see this overview.</p></div>}</div>;
}
