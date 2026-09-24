"use client";
import { useCallback,useEffect,useState } from "react";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import { subscribeToWorkspaceMutations } from "@/lib/workspace-mutations";
import { Button } from "@/components/ui/button";
import type { wealthSummary } from "@/lib/founder-os/intelligence";
import type { wealthTimeline } from "@/lib/founder-os/personal";
type Data={totals:ReturnType<typeof wealthSummary>;history:ReturnType<typeof wealthTimeline>;partial:boolean};
export function WealthPanel(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState("");
 const load=useCallback(async()=>{try{const res=await fetch('/api/founder-personal',{cache:'no-store'}),body=await res.json();if(!res.ok)throw new Error(body.error);setData(body);setError('');}catch(e){setError(String(e));}},[]);
 useDeferredEffect(useCallback(()=>{void load();},[load]));useEffect(()=>subscribeToWorkspaceMutations(['founder-os'],()=>void load()),[load]);
 return <section className="founder-workspace"><h2>Personal balance sheet</h2><p>Recorded valuations, separated by currency. Business equity is included as a personal holding; operating business cash is excluded.</p>{error?<p role="alert">{error} <Button onClick={()=>void load()}>Retry</Button></p>:!data?<p role="status">Loading balance history…</p>:<>{data.partial&&<p role="status">Partial totals: the record limit was reached. History may be incomplete.</p>}{Object.entries(data.totals).map(([currency,s])=><div className="founder-record" key={currency}><h3>{currency} · Net worth {s.net.toLocaleString()}</h3><p>Assets {s.assets.toLocaleString()} · Liabilities {s.liabilities.toLocaleString()} · Liquid net worth {(s.liquid-s.liabilities).toLocaleString()}</p><p>Liquid assets {s.liquid.toLocaleString()} · Business equity {s.equity.toLocaleString()} · Personal assets excluding equity {(s.assets-s.equity).toLocaleString()}</p><details><summary>Valuation history</summary><p>Each valuation is carried forward until its next recorded date. Same-day corrections replace that day’s value. These are recorded estimates, not market prices.</p>{data.history.filter(h=>h.currencies[currency]).slice(-12).map(h=><p key={h.date}>{h.date} · Net {h.currencies[currency].net.toLocaleString()} {currency} · Liquid {h.liquidityKnown?h.currencies[currency].liquid.toLocaleString():'unknown in older records'}</p>)}</details></div>)}{!Object.keys(data.totals).length&&<p>No personal valuations recorded.</p>}</>}</section>;
}
