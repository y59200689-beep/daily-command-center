"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Users, Target, BarChart3, Percent, Plus, Columns3, List, CalendarDays, Building2, MoreHorizontal, FileText, Handshake, Trophy, ListFilter, CircleCheck, RefreshCw, Info, ArrowRight, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import { StyledSelect } from "@/components/ui/styled-select";
import { useToast } from "@/components/toast-provider";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import { opportunityStages, type OpportunityStage } from "@/lib/business";
import { recordCurrency, type BusinessRecord } from "@/lib/business-dashboard";
import { filterPipeline, pipelineActions, pipelineBoardStages, pipelineDistribution, pipelineScore, pipelineSnapshot, type PipelineOwners, type PipelineFilters } from "@/lib/pipeline-dashboard";
import "./business-dashboard.css";
import "./pipeline-dashboard.css";

type Props = {
  records: BusinessRecord[]; clients: BusinessRecord[]; loading: boolean; error: string; view: "opportunities" | "health";
  onRetry: () => void; onOpen: (row?: BusinessRecord) => void; onCreate: (stage: OpportunityStage, currency: string) => void;
  onStage: (row: BusinessRecord, stage: OpportunityStage) => Promise<void>; onConvert: (row: BusinessRecord) => void;
  onAction: (row: BusinessRecord, completed: boolean) => Promise<void>;
};
const stageMeta: Record<OpportunityStage, { label: string; color: string; icon: ReactNode; hint: string }> = {
  new: { label: "New", color: "#b5bad7", icon: <ListFilter size={17}/>, hint: "Capture new demand" },
  qualified: { label: "Qualified", color: "#a17bff", icon: <FileText size={17}/>, hint: "Confirm fit and scope" },
  meeting: { label: "Meeting", color: "#80b7ff", icon: <Users size={17}/>, hint: "Start the conversation" },
  proposal: { label: "Proposal", color: "#ffbd91", icon: <Handshake size={17}/>, hint: "Shape a clear offer" },
  negotiation: { label: "Negotiation", color: "#65d89b", icon: <Trophy size={17}/>, hint: "Agree the next step" },
  won: { label: "Won", color: "#6ce2ac", icon: <CircleCheck size={17}/>, hint: "Turn promises into work" },
  lost: { label: "Lost", color: "#ee91a7", icon: <X size={17}/>, hint: "Keep the learning" },
};
const money = (value: unknown, currency: string) => value == null ? "Value not set" : `${currency} ${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(Number(value))}`;
const dateLabel = (value: unknown, today: string) => {
  if (!value) return "No date set";
  const day = String(value).slice(0,10);
  if (day === today) return "Today";
  const tomorrow = new Date(`${today}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
  if (day === tomorrow.toISOString().slice(0,10)) return "Tomorrow";
  return new Date(`${day}T12:00:00`).toLocaleDateString("en",{month:"short",day:"numeric",year:day.slice(0,4)===today.slice(0,4)?undefined:"numeric"});
};
const initials = (name: string) => name.split(" ").map(part=>part[0]).slice(0,2).join("").toUpperCase();

export function PipelineDashboard({ records, clients, loading, error, view, onRetry, onOpen, onCreate, onStage, onConvert, onAction }: Props) {
  const { showToast } = useToast();
  const [today] = useState(()=>new Date().toISOString().slice(0,10));
  const [filters,setFilters] = useState<PipelineFilters>({query:"",client:"",owner:"",stage:"",currency:"MAD",sort:"close"});
  const [layout,setLayout] = useState<"board"|"list">("board");
  const [owners,setOwners] = useState<PipelineOwners>({});
  const [ownershipError,setOwnershipError] = useState("");
  const [ownershipRetry,setOwnershipRetry] = useState(0);
  const [distributionPeriod,setDistributionPeriod] = useState<"all"|"this_month">("all");
  const [actionAll,setActionAll] = useState(false);
  const [menu,setMenu] = useState<BusinessRecord|null>(null);
  const [menuStage,setMenuStage] = useState<OpportunityStage>("new");
  const [mutationError,setMutationError] = useState("");
  const [pending,setPending] = useState<string|null>(null);
  const lock = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [dragging,setDragging] = useState<string|null>(null);
  const [dropStage,setDropStage] = useState<string|null>(null);
  const [undo,setUndo] = useState<BusinessRecord|null>(null);
  const [detail,setDetail] = useState<{title:string;description:string;rows:BusinessRecord[]}|null>(null);

  useDeferredEffect(useCallback(()=>{
    const controller=new AbortController();
    if(ownershipRetry)setOwnershipError("");
    void fetch("/api/team/ownership",{signal:controller.signal,cache:"no-store"}).then(async response=>{
      const body=await response.json(); if(!response.ok)throw new Error("Ownership could not be loaded.");
      if(!controller.signal.aborted){
        const map:PipelineOwners={};
        for(const item of body.items ?? []) if(item.entity_type==="opportunity")map[item.entity_id]=item.primary_owner ?? null;
        setOwners(map);
        setOwnershipError(body.schemaStatus==="unavailable"?"Team ownership is not available yet.":"");
      }
    }).catch(()=>{if(!controller.signal.aborted)setOwnershipError("Ownership could not be loaded. Deal records are still available.");});
    return()=>controller.abort();
  },[ownershipRetry]));

  const currencyRows=records.filter(row=>recordCurrency(row)===filters.currency);
  const snapshot=useMemo(()=>pipelineSnapshot(records,filters.currency,today),[records,filters.currency,today]);
  const rows=useMemo(()=>filterPipeline(records,filters,clients,owners),[records,filters,clients,owners]);
  const actions=pipelineActions(rows,today);
  const upcoming=actions.filter(row=>row.next_action_date&&String(row.next_action_date)>=today).sort((a,b)=>String(a.next_action_date).localeCompare(String(b.next_action_date)));
  const distribution=pipelineDistribution(currencyRows,distributionPeriod,today);
  const distributionCount=distribution.reduce((total,item)=>total+item.count,0);
  const hasFilters=Boolean(filters.query||filters.client||filters.owner||filters.stage);
  const clientName=(row:BusinessRecord)=>String(clients.find(client=>client.id===row.client_id)?.name??(row.client_id?"Linked client":"No linked client"));
  const update=<K extends keyof PipelineFilters>(field:K,value:PipelineFilters[K])=>setFilters(current=>({...current,[field]:value}));
  const ownerOptions=[...new Map(Object.values(owners).filter((person):person is NonNullable<typeof person>=>Boolean(person)).map(person=>[person.id,person])).values()];
  const openActions=(row:BusinessRecord)=>{setMenu(row);setMenuStage(row.stage as OpportunityStage);setMutationError("");};
  const move=async(row:BusinessRecord,stage:OpportunityStage)=>{
    if(lock.current||stage===row.stage)return;
    lock.current=true;setPending(row.id);setMutationError("");
    try{await onStage(row,stage);setMenu(null);window.requestAnimationFrame(()=>document.getElementById(`pipeline-actions-${row.id}`)?.focus());}catch(reason){setMutationError(reason instanceof Error?reason.message:"Stage could not be changed. Retry the move.");}
    finally{lock.current=false;setPending(null);setDragging(null);setDropStage(null);}
  };
  const complete=async(row:BusinessRecord,completed:boolean)=>{
    if(lock.current)return; lock.current=true;setPending(row.id);
    try{await onAction(row,completed);setUndo(completed?row:null);}catch(reason){showToast(reason instanceof Error?reason.message:"Sales action could not be saved.","error");}
    finally{lock.current=false;setPending(null);}
  };
  const disclose=(title:string,description:string,selected:BusinessRecord[])=>setDetail({title,description,rows:selected});
  const signal=error?"Unavailable":snapshot.open.length?snapshot.quality.qualitySignals[0]:"Empty";

  return <div className="business-dashboard pipeline-dashboard">
    <div className="pipeline-dashboard__grid">
      <div className="pipeline-dashboard__main">
        <header className="business-dashboard__header"><div><nav aria-label="Breadcrumb"><Link href="/business">Business</Link><span>/</span><span>Pipeline</span></nav><h1>Pipeline</h1><p>Move qualified work forward with a next action, not a vague feeling.</p></div><Button intent="brand" onClick={()=>onCreate("new",filters.currency)}><Plus size={17}/>New opportunity</Button></header>
        <div className="pipeline-dashboard__navigation"><nav className="pipeline-dashboard__tabs" aria-label="Pipeline sections"><Link href="/pipeline?view=opportunities" aria-current={view==="opportunities"?"page":undefined}>Opportunities</Link><Link href="/pipeline?view=health" aria-current={view==="health"?"page":undefined}>Deal health</Link></nav><div className="pipeline-dashboard__scope"><span>{loading?"Updating pipeline…":`${rows.length} ${rows.length===1?"opportunity":"opportunities"}`} · {filters.currency} snapshot</span><div>{hasFilters&&<button onClick={()=>{setFilters(current=>({...current,query:"",client:"",owner:"",stage:""}));searchRef.current?.focus();}}>Clear filters</button>}<label htmlFor="pipeline-currency" className="pipeline-dashboard__currency">Currency<select id="pipeline-currency" value={filters.currency} onChange={event=>update("currency",event.target.value)}>{[...new Set(["MAD",filters.currency,...records.map(recordCurrency)])].sort().map(currency=><option key={currency} value={currency}>{currency}</option>)}</select></label><button className="pipeline-dashboard__icon-button" aria-label="Refresh pipeline" disabled={loading||Boolean(pending)} onClick={onRetry}><RefreshCw size={14}/></button></div></div></div>
        {error&&<div className="pipeline-dashboard__error" role="alert"><span>{error}</span><Button emphasis="outline" onClick={onRetry}>Retry</Button></div>}
        <div className="business-dashboard__metrics" aria-busy={loading}>
          <Metric title="Open opportunities" value={String(snapshot.open.length)} note="Current open deals" icon={<Users/>} tone="purple" loading={loading||Boolean(error)} onClick={()=>disclose("Open opportunities",`Current open deals in ${filters.currency}; won and lost deals are excluded.`,snapshot.open)}/>
          <Metric title="Pipeline value" value={money(snapshot.value,filters.currency)} note="Open deal value" icon={<Target/>} tone="orange" loading={loading||Boolean(error)} onClick={()=>disclose("Pipeline value",`Total estimated value of open deals in ${filters.currency}. Deals without a value contribute zero.`,snapshot.open)}/>
          <Metric title="Weighted forecast" value={money(snapshot.weighted,filters.currency)} note="Value × probability" icon={<BarChart3/>} tone="blue" loading={loading||Boolean(error)} onClick={()=>disclose("Weighted forecast",`Open deal value multiplied by probability in ${filters.currency}; stage defaults apply where probability is not set.`,snapshot.open)}/>
          <Metric title="Win rate" value={snapshot.winRate==null?"—":`${snapshot.winRate}%`} note="Won ÷ closed deals" icon={<Percent/>} tone="blue" loading={loading||Boolean(error)} onClick={()=>disclose("Win rate",`All-time won ÷ (won + lost) for ${filters.currency}. ${snapshot.won.length} won, ${snapshot.lost.length} lost.`,[...snapshot.won,...snapshot.lost])} ring={snapshot.winRate}/>
        </div>
        <section className="business-dashboard__panel pipeline-dashboard__workspace" aria-label={view==="health"?"Deal health workspace":"Opportunity workspace"}>
          <div className="pipeline-dashboard__toolbar">
            <SearchInput ref={searchRef} label="Search opportunities" placeholder="Search opportunities…" value={filters.query} onChange={event=>update("query",event.target.value)} onClear={()=>update("query","")}/>
            <StyledSelect label="Filter by client" value={filters.client} onChange={value=>update("client",value)} options={[{value:"",label:"All clients"},{value:"unlinked",label:"No linked client"},...clients.map(client=>({value:client.id,label:String(client.name)}))]}/>
            <StyledSelect label="Filter by owner" value={filters.owner} onChange={value=>update("owner",value)} options={[{value:"",label:"All owners"},{value:"unrecorded",label:"Not recorded"},...ownerOptions.map(person=>({value:person.id,label:person.name}))]}/>
            <StyledSelect id="pipeline-filter-stage" label="Filter by stage" value={filters.stage} onChange={value=>update("stage",value)} options={[{value:"",label:"All stages"},...opportunityStages.map(stage=>({value:stage,label:stageMeta[stage].label}))]}/>
            <div className="pipeline-dashboard__toolbar-end"><StyledSelect label="Sort opportunities" value={filters.sort} onChange={value=>update("sort",value as PipelineFilters["sort"])} options={[{value:"close",label:"Sort by: Close date"},{value:"value",label:"Sort by: Value"},{value:"updated",label:"Sort by: Recent"},{value:"title",label:"Sort by: Name"}]}/>{view==="opportunities"&&<div className="pipeline-dashboard__layout" aria-label="Opportunity layout"><button aria-label="Board view" aria-pressed={layout==="board"} onClick={()=>setLayout("board")}><Columns3 size={18}/></button><button aria-label="List view" aria-pressed={layout==="list"} onClick={()=>setLayout("list")}><List size={18}/></button></div>}</div>
          </div>

          {view==="health"?<div className="pipeline-dashboard__health-list"><header><span className="business-dashboard__icon"><Target size={21}/></span><div><h2>Deal health</h2><p>Review risks and choose the next action for each open deal.</p></div></header>{rows.filter(row=>!["won","lost"].includes(String(row.stage))).length?rows.filter(row=>!["won","lost"].includes(String(row.stage))).map(row=>{const score=pipelineScore(row,today);return <article key={row.id}><div><button className="pipeline-dashboard__deal-title" onClick={()=>onOpen(row)}>{String(row.title)}</button><p>{clientName(row)} · {stageMeta[row.stage as OpportunityStage]?.label} · {money(row.estimated_value,filters.currency)}</p></div><span className={`pipeline-dashboard__badge health-${score.health.toLowerCase().replaceAll(" ","-")}`}>{score.health}</span><ul>{(score.risks.length?score.risks:score.reasons).map(reason=><li key={reason}>{reason}</li>)}</ul><footer><p><ArrowRight size={14}/>{score.nextAction}</p><Button emphasis="outline" onClick={()=>onOpen(row)}>Update deal</Button></footer></article>;}):<Empty icon={<Target size={29}/>} title={loading?"Reading deal health…":"No open deals to review"} copy="Add an opportunity or clear your filters to review its next action and risks."/>}</div>
          :layout==="list"?<div className="pipeline-dashboard__list-wrap"><table><thead><tr>{["Opportunity","Client","Value","Stage","Owner","Expected close","Next action","Actions"].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><button className="pipeline-dashboard__deal-title" onClick={()=>onOpen(row)}>{String(row.title)}</button></td><td>{clientName(row)}</td><td>{money(row.estimated_value,filters.currency)}</td><td><span className={`pipeline-dashboard__badge stage-${row.stage}`}>{stageMeta[row.stage as OpportunityStage]?.label}</span></td><td>{owners[row.id]?.name||"Not recorded"}</td><td>{dateLabel(row.expected_close_date,today)}</td><td><button onClick={()=>onOpen(row)}>{String(row.next_action||"Set next action")}</button></td><td><button className="pipeline-dashboard__icon-button" id={`pipeline-actions-${row.id}`} aria-label={`Actions for ${row.title}`} onClick={()=>openActions(row)} disabled={Boolean(pending)}><MoreHorizontal size={17}/></button></td></tr>)}</tbody></table>{!rows.length&&<Empty icon={<List size={29}/>} title={loading?"Reading opportunities…":"No opportunities to show"} copy="Create an opportunity or adjust the filters to see your pipeline."/>}</div>
          :<div className="pipeline-dashboard__board-scroll"><div className={`pipeline-dashboard__board ${filters.stage?"has-stage-filter":""}`} aria-label="Opportunities by stage">{(filters.stage?[filters.stage as OpportunityStage]:pipelineBoardStages).map(stage=>{const stageRows=rows.filter(row=>row.stage===stage);const meta=stageMeta[stage];return <section key={stage} className={`pipeline-dashboard__column stage-${stage} ${dropStage===stage?"is-drop-target":""}`} aria-label={`${meta.label} stage`} onDragOver={event=>{if(dragging){event.preventDefault();setDropStage(stage);}}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDropStage(null);}} onDrop={event=>{event.preventDefault();const row=records.find(item=>item.id===event.dataTransfer.getData("text/plain"));if(row)void move(row,stage);setDropStage(null);setDragging(null);}}><header><span>{meta.icon}<strong>{meta.label}</strong><small>{loading||error?"—":stageRows.length}</small></span><b>{loading||error?"—":money(stageRows.reduce((total,row)=>total+Number(row.estimated_value??0),0),filters.currency)}</b></header><div className="pipeline-dashboard__cards">{stageRows.length?stageRows.map(row=>{const score=pipelineScore(row,today);const owner=owners[row.id];return <article className={`pipeline-dashboard__card ${pending===row.id?"is-pending":""}`} key={row.id} draggable={!pending&&!loading} onDragStart={event=>{event.dataTransfer.setData("text/plain",row.id);event.dataTransfer.effectAllowed="move";setDragging(row.id);}} onDragEnd={()=>{setDragging(null);setDropStage(null);}}><button className="pipeline-dashboard__card-main" onClick={()=>onOpen(row)} disabled={pending===row.id}><strong>{String(row.title)}</strong><b>{money(row.estimated_value,filters.currency)}</b><span><Building2 size={14}/>{clientName(row)}</span><em className={`pipeline-dashboard__badge ${stage==="won"?"priority-won":`priority-${score.priority.toLowerCase()}`}`} title={stage==="won"?"Won opportunity":"Suggested priority based on deal health"}>{stage==="won"?"Won":score.priority}</em><time dateTime={row.expected_close_date?String(row.expected_close_date):undefined}><CalendarDays size={14}/>{dateLabel(row.expected_close_date,today)}</time></button><footer><button onClick={()=>onOpen(row)} className="pipeline-dashboard__next-step" title={`${owner?.name||"Owner not recorded"} · ${String(row.next_action||"Set next action")}`}><span className={`pipeline-dashboard__avatar ${owner?"":"is-unassigned"}`}>{owner?initials(owner.name):<Users size={13}/>}</span><span>{String(row.next_action||"Set next action")}</span></button><button className="pipeline-dashboard__icon-button" id={`pipeline-actions-${row.id}`} aria-label={`Actions for ${row.title}`} onClick={()=>openActions(row)} disabled={Boolean(pending)}><MoreHorizontal size={15}/></button></footer></article>;}):<div className="pipeline-dashboard__empty-column"><span aria-hidden="true">{meta.icon}</span><p>{loading?"Loading…":error?"Could not load":hasFilters?"No matching deals":"No opportunities"}</p><small>{meta.hint}</small></div>}</div><button className="pipeline-dashboard__add" onClick={()=>onCreate(stage,filters.currency)}><Plus size={14}/>Add opportunity</button></section>;})}</div></div>}
          <footer className="pipeline-dashboard__board-note"><span>{view==="health"?"Health is based on recorded activity and next actions.":layout==="board"?"Drag a deal to move it, or use its actions menu.":"Open a deal or use its actions menu to change stage."}</span>{!filters.stage&&<button onClick={()=>{update("stage","lost");document.getElementById("pipeline-filter-stage")?.focus();}}>View lost deals</button>}</footer>
        </section>
      </div>
      <aside className="pipeline-dashboard__sidebar" aria-label="Pipeline insights">
        <section className="business-dashboard__panel pipeline-dashboard__health"><header><h2>Pipeline health</h2><button aria-label="Explain pipeline health" className="pipeline-dashboard__icon-button" onClick={()=>disclose("Pipeline health",snapshot.quality.explanation,snapshot.open)}><Info size={14}/></button><span className={`pipeline-dashboard__signal signal-${String(signal).toLowerCase()}`}><i/>{loading?"Updating":signal}</span></header><p>{loading?"Reading the current pipeline…":error?"Pipeline insights could not be loaded. Use Retry to read your deals again.":!snapshot.open.length?"Add your first opportunity to start tracking momentum and deal health.":snapshot.quality.explanation}</p>{snapshot.open.length>0&&<small>{snapshot.open.length} active opportunities · {filters.currency}</small>}</section>
        <section className="business-dashboard__panel pipeline-dashboard__distribution"><header><h2>Stage distribution</h2><StyledSelect label="Stage distribution period" value={distributionPeriod} onChange={value=>setDistributionPeriod(value as "all"|"this_month")} options={[{value:"all",label:"All time"},{value:"this_month",label:"This month"}]}/></header><div className="pipeline-dashboard__distribution-body"><div className="pipeline-dashboard__donut" role="img" aria-label={loading?"Loading stage distribution":error?"Stage distribution unavailable":`${distributionCount} opportunities; stage counts listed beside chart`}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distributionCount?distribution:[{stage:"empty",count:1}]} dataKey="count" nameKey="stage" innerRadius="64%" outerRadius="94%" startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>{(distributionCount?distribution:[{stage:"empty",count:1}]).map(item=><Cell key={item.stage} fill={item.stage==="empty"?"var(--business-line)":stageMeta[item.stage as OpportunityStage].color}/>)}</Pie>{distributionCount>0&&<Tooltip formatter={(value,name)=>[`${value} opportunities`,stageMeta[String(name) as OpportunityStage]?.label??String(name)]}/>}</PieChart></ResponsiveContainer><div><strong>{loading||error?"—":distributionCount}</strong><small>opportunities</small></div></div><ul>{distribution.map(item=><li key={item.stage}><button disabled={loading||Boolean(error)} onClick={()=>{update("stage",filters.stage===item.stage?"":item.stage);}} aria-pressed={filters.stage===item.stage}><i style={{background:stageMeta[item.stage].color}}/><span>{stageMeta[item.stage].label}</span><b>{loading||error?"—":item.count}</b><small>{loading||error?"—":`${item.share}%`}</small></button></li>)}</ul></div><p className="pipeline-dashboard__chart-note">{distributionPeriod==="this_month"?"Updated this month":"Current snapshot"} · excludes lost deals</p></section>
        <section className="business-dashboard__panel pipeline-dashboard__actions"><header><h2>Next actions</h2><button onClick={()=>setActionAll(!actionAll)} disabled={!actions.length}>{actionAll?"Show less":"View all"}</button></header>{actions.length?<ul>{actions.slice(0,actionAll?undefined:4).map(row=>{const priority=pipelineScore(row,today).priority;return <li key={row.id}><button className="pipeline-dashboard__complete" aria-label={`Complete ${row.next_action}`} disabled={loading||Boolean(pending)} onClick={()=>void complete(row,true)}>{pending===row.id?<RefreshCw size={15}/>:<span/>}</button><button className="pipeline-dashboard__action-copy" onClick={()=>onOpen(row)}><strong>{String(row.next_action)}</strong><small>{String(row.title)} · {money(row.estimated_value,filters.currency)}</small></button><span className={`pipeline-dashboard__badge priority-${priority.toLowerCase()}`}>{priority}</span><time dateTime={row.next_action_date?String(row.next_action_date):undefined}><CalendarDays size={13}/>{dateLabel(row.next_action_date,today)}</time></li>;})}</ul>:<Empty icon={<CircleCheck size={25}/>} title={loading?"Reading next actions…":error?"Actions unavailable":"No next actions yet"} copy={error?"Retry loading the pipeline to see next steps.":"Give each open deal a clear next step."}/>}{undo&&<div className="pipeline-dashboard__undo"><span>Action completed</span><button disabled={Boolean(pending)} onClick={()=>void complete(undo,false)}><RotateCcw size={12}/>Undo</button></div>}</section>
        <section className="business-dashboard__panel pipeline-dashboard__followups"><header><h2>Upcoming follow-ups</h2><Link href="/calendar">See calendar</Link></header>{upcoming.length?<ul>{upcoming.slice(0,4).map(row=><li key={row.id}><CalendarDays size={15}/><time dateTime={String(row.next_action_date)}>{dateLabel(row.next_action_date,today)}</time><button onClick={()=>onOpen(row)}><strong>{String(row.title)}</strong><small>{String(row.next_action)} · {clientName(row)}</small></button>{owners[row.id]&&<span className="pipeline-dashboard__avatar" title={owners[row.id]!.name}>{initials(owners[row.id]!.name)}</span>}</li>)}</ul>:<Empty icon={<CalendarDays size={25}/>} title={loading?"Reading follow-ups…":error?"Follow-ups unavailable":"Nothing scheduled yet"} copy={error?"Retry loading the pipeline to see dates.":"Set a next action date to see follow-ups here."}/>}</section>
        {ownershipError&&<div className="pipeline-dashboard__ownership-note"><span>{ownershipError}</span><button onClick={()=>setOwnershipRetry(ownershipRetry+1)}>Retry ownership</button></div>}
        <Link className="pipeline-dashboard__ownership-link" href="/team/ownership">Manage deal ownership<ArrowRight size={13}/></Link>
      </aside>
    </div>
    <Modal open={Boolean(menu)} onClose={()=>{if(!lock.current)setMenu(null);}} title={String(menu?.title??"Opportunity actions")} description="Move this opportunity forward or update its details.">{menu&&<div className="pipeline-dashboard__deal-actions"><Button emphasis="outline" disabled={Boolean(pending)} onClick={()=>{setMenu(null);onOpen(menu);}}>Edit opportunity</Button><label htmlFor="pipeline-move-stage">Move to stage<select id="pipeline-move-stage" value={menuStage} onChange={event=>setMenuStage(event.target.value as OpportunityStage)} disabled={Boolean(pending)}>{opportunityStages.map(stage=><option key={stage} value={stage}>{stageMeta[stage].label}</option>)}</select></label>{mutationError&&<p className="field-error" role="alert">{mutationError}</p>}<Button intent="brand" disabled={Boolean(pending)||menuStage===menu.stage} onClick={()=>void move(menu,menuStage)}>{pending?"Moving…":"Move opportunity"}</Button>{menu.stage==="won"&&<Button emphasis="outline" disabled={Boolean(pending)} onClick={()=>{setMenu(null);onConvert(menu);}}>Create project<ArrowRight size={15}/></Button>}</div>}</Modal>
    <Modal open={Boolean(detail)} onClose={()=>setDetail(null)} title={detail?.title??"Pipeline details"} description={detail?.description}>{detail&&<div className="pipeline-dashboard__detail-records">{detail.rows.length?detail.rows.map(row=><button key={row.id} onClick={()=>{setDetail(null);onOpen(row);}}><span><strong>{String(row.title)}</strong><small>{stageMeta[row.stage as OpportunityStage]?.label} · {clientName(row)}</small></span><b>{money(row.estimated_value,filters.currency)}</b><ArrowRight size={15}/></button>):<p>No matching opportunities yet.</p>}</div>}</Modal>
  </div>;
}
function Metric({title,value,note,icon,tone,loading,onClick,ring}:{title:string;value:string;note:string;icon:ReactNode;tone:string;loading:boolean;onClick:()=>void;ring?:number|null}) {
  return <button className={`business-dashboard__metric tone-${tone}`} onClick={onClick} disabled={loading}><span className="business-dashboard__metric-icon">{icon}</span><span className="business-dashboard__metric-copy"><span>{title}</span><strong>{loading?"—":value}</strong><small>{note}</small></span>{ring!==undefined?<span className="pipeline-dashboard__metric-ring" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{value:ring??0},{value:100-(ring??0)}]} dataKey="value" innerRadius="74%" outerRadius="96%" startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}><Cell fill="var(--business-accent)"/><Cell fill="var(--business-accent-soft)"/></Pie></PieChart></ResponsiveContainer><b>{ring==null?"—":`${ring}%`}</b></span>:<span className="pipeline-dashboard__metric-decoration" aria-hidden="true">{icon}</span>}</button>;
}
function Empty({icon,title,copy}:{icon:ReactNode;title:string;copy:string}){return <div className="pipeline-dashboard__empty"><span>{icon}</span><strong>{title}</strong><p>{copy}</p></div>;}
