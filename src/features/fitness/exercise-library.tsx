"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {ArrowRight,Check,ChevronLeft,ChevronRight,Dumbbell,Layers,SlidersHorizontal,X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {SearchInput} from "@/components/ui/search-input";
import {StyledSelect} from "@/components/ui/styled-select";
import {Modal} from "@/components/ui/modal";
import {exerciseLanguages,type ExerciseLanguage,type ExerciseSummary} from "@/lib/exercise-catalog";
import "./exercise-library.css";
type Filters={q:string;bodyPart:string;equipment:string;target:string;page:number};
type Catalog={page:number;items:ExerciseSummary[];total:number;pageSize:number;catalogCount:number;facets:{bodyParts:string[];equipment:string[];targets:string[]}};
const label=(text:string)=>text.charAt(0).toUpperCase()+text.slice(1);
const empty:Filters={q:"",bodyPart:"",equipment:"",target:"",page:1};
export function ExerciseLibrary({initial=empty}:{initial?:Filters}){
 const [filters,setFilters]=useState(initial),[catalog,setCatalog]=useState<Catalog|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[refresh,setRefresh]=useState(0),[composing,setComposing]=useState(false);
 const [selected,setSelected]=useState<ExerciseSummary|null>(null),[language,setLanguage]=useState<ExerciseLanguage>("en"),[detail,setDetail]=useState<{steps:string[];language:string}|null>(null),[detailError,setDetailError]=useState("");
 const [selection,setSelection]=useState<ExerciseSummary[]>([]),[copyMessage,setCopyMessage]=useState("");
 useEffect(()=>{
  if(composing)return;
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   setLoading(true);setError("");
   const params=new URLSearchParams();for(const [key,value] of Object.entries(filters))if(value && !(key==="page"&&value===1))params.set(key,String(value));
   window.history.replaceState(null,"",`${window.location.pathname}${params.size?`?${params}`:""}`);
   try{const response=await fetch(`/api/fitness/exercises?${params}`,{signal:controller.signal});if(!response.ok)throw new Error("The exercise library could not be loaded.");const body:Catalog=await response.json();if(!controller.signal.aborted){setCatalog(body);if(body.page!==filters.page)setFilters(current=>({...current,page:body.page}));}}
   catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"Could not load exercises.");}
   finally{if(!controller.signal.aborted)setLoading(false);}
  },filters.q?300:0);
  return()=>{clearTimeout(timer);controller.abort();};
 },[filters,refresh,composing]);
 useEffect(()=>{
  if(!selected)return;const controller=new AbortController();
  async function load(){setDetail(null);setDetailError("");try{const response=await fetch(`/api/fitness/exercises?id=${encodeURIComponent(selected!.id)}&language=${language}`,{signal:controller.signal});if(!response.ok)throw new Error("Instructions could not be loaded.");const body=await response.json();if(!controller.signal.aborted)setDetail(body.exercise);}catch{if(!controller.signal.aborted)setDetailError("Instructions could not be loaded. Close and reopen the exercise to retry.");}}
  void load();return()=>controller.abort();
 },[selected,language]);
 const update=(key: keyof Omit<Filters,"page">,value:string)=>setFilters(current=>({...current,[key]:value,page:1}));
 function toggle(exercise:ExerciseSummary){setCopyMessage("");setSelection(current=>current.some(row=>row.id===exercise.id)?current.filter(row=>row.id!==exercise.id):current.length<20?[...current,exercise]:current);}
 async function copy(){try{await navigator.clipboard.writeText(`Exercise selection\n${selection.map((row,index)=>`${index+1}. ${row.name} — ${row.equipment} · ${row.target}`).join("\n")}\n\nAdd your own sets, repetitions and progression in Training Plans.`);setCopyMessage("Copied. Paste into your training plan notes.");}catch{setCopyMessage("Clipboard access is unavailable. Your selected exercises are listed below for manual copying.");}}
 const pages=Math.max(1,Math.ceil((catalog?.total??0)/24));
 return <div className="exercise-library">
  <header className="exercise-library__hero"><div><p className="eyebrow">PERSONAL RHYTHM / FITNESS</p><h1>Exercise library</h1><p>Find your next movement. Build a thoughtful training plan.</p><div className="exercise-library__hero-links"><Link href="/fitness">← Fitness</Link><Link href="/fitness/plans">Training plans <ArrowRight size={15}/></Link></div></div><Dumbbell className="exercise-library__hero-art" size={96} aria-hidden="true"/></header>
  <div className="exercise-library__stats"><article><Dumbbell/><div><strong>{catalog?.catalogCount.toLocaleString()??"—"}</strong><span>Exercises to explore</span></div></article><article><Layers/><div><strong>{catalog?.facets.bodyParts.length??"—"}</strong><span>Body-part groups</span></div></article><article><SlidersHorizontal/><div><strong>{catalog?.facets.equipment.length??"—"}</strong><span>Equipment types</span></div></article><article><Check/><div><strong>{Object.keys(exerciseLanguages).length}</strong><span>Instruction languages</span></div></article></div>
  <section className="exercise-library__toolbar" aria-label="Filter exercises">
   <SearchInput label="Search exercises" containerClassName="search-control--full" placeholder="Search exercises, muscles or equipment…" value={filters.q} onChange={event=>update("q",event.target.value)} onClear={()=>update("q","")} onCompositionStart={()=>setComposing(true)} onCompositionEnd={()=>setComposing(false)}/>
   <StyledSelect label="Body part" value={filters.bodyPart} onChange={value=>update("bodyPart",value)} options={[{value:"",label:"All body parts"},...(catalog?.facets.bodyParts??[]).map(value=>({value,label:label(value)}))]} menuMinWidth={220}/>
   <StyledSelect label="Equipment" value={filters.equipment} onChange={value=>update("equipment",value)} searchable options={[{value:"",label:"All equipment"},...(catalog?.facets.equipment??[]).map(value=>({value,label:label(value)}))]} menuMinWidth={230}/>
   <StyledSelect label="Target muscle" value={filters.target} onChange={value=>update("target",value)} searchable options={[{value:"",label:"All target muscles"},...(catalog?.facets.targets??[]).map(value=>({value,label:label(value)}))]} menuMinWidth={230}/>
   <Button emphasis="ghost" disabled={!filters.q&&!filters.bodyPart&&!filters.equipment&&!filters.target} onClick={()=>setFilters(empty)}>Reset</Button>
  </section>
  <div className="exercise-library__result-line" role="status">{loading?"Finding exercises…":`${catalog?.total.toLocaleString()??0} matching exercises`}{selection.length>0&&<span>{selection.length} selected · up to 20</span>}</div>
  {error?<div className="data-surface exercise-library__empty"><p role="alert">{error}</p><Button onClick={()=>setRefresh(value=>value+1)}>Try again</Button></div>:!loading&&catalog?.items.length===0?<div className="data-surface exercise-library__empty"><Dumbbell size={36}/><h2>No matching exercises</h2><p>Try another muscle, equipment type or search term.</p><Button onClick={()=>setFilters(empty)}>Clear filters</Button></div>:<div className="exercise-library__grid" aria-busy={loading}>{catalog?.items.map((exercise,index)=>{const checked=selection.some(row=>row.id===exercise.id);return <article className="exercise-library__card" key={exercise.id}><div className={`exercise-library__card-top tone-${index%3}`}><span><Dumbbell size={28}/></span><small>{label(exercise.bodyPart)}</small><label className="exercise-library__choose"><input type="checkbox" aria-label={`Select ${exercise.name}`} checked={checked} disabled={!checked&&selection.length>=20} onChange={()=>toggle(exercise)}/></label></div><button className="exercise-library__name" onClick={()=>setSelected(exercise)}>{label(exercise.name)}</button><p>{label(exercise.target)}<span> · {label(exercise.equipment)}</span></p><Button emphasis="ghost" onClick={()=>setSelected(exercise)}>View instructions <ArrowRight size={14}/></Button></article>;})}</div>}
  {catalog&&catalog.total>24&&<nav className="exercise-library__pagination" aria-label="Exercise pages"><Button aria-label="Previous page" disabled={loading||filters.page<=1} onClick={()=>setFilters(current=>({...current,page:current.page-1}))}><ChevronLeft size={16}/></Button><span>Page {filters.page} of {pages}</span><Button aria-label="Next page" disabled={loading||filters.page>=pages} onClick={()=>setFilters(current=>({...current,page:current.page+1}))}><ChevronRight size={16}/></Button></nav>}
  {selection.length>0&&<section className="exercise-library__selection data-surface"><div><h2>Your exercise selection</h2><p>Copy these into a training plan and choose your own sets and repetitions.</p></div><div className="exercise-library__selection-actions"><Button intent="brand" onClick={()=>void copy()}>Copy selection</Button><Button emphasis="ghost" onClick={()=>{setSelection([]);setCopyMessage("");}}>Clear selection</Button></div><ol>{selection.map(row=><li key={row.id}><span>{row.name} · {row.equipment}</span><Button emphasis="ghost" aria-label={`Remove ${row.name}`} onClick={()=>toggle(row)}><X size={14}/></Button></li>)}</ol>{copyMessage&&<p role="status">{copyMessage}</p>}</section>}
  <footer className="exercise-library__footer">Exercise data © Hasan Emir Yıldırım · <a href="https://github.com/hasaneyldrm/exercises-dataset" target="_blank" rel="noopener noreferrer">MIT-licensed dataset</a>. Instructions are reference material; adapt movements to your ability.</footer>
  <Modal open={Boolean(selected)} onClose={()=>setSelected(null)} title={selected?label(selected.name):"Exercise"} description={selected?`${label(selected.target)} · ${label(selected.equipment)}`:undefined}>
   <div className="exercise-library__detail"><label>Instruction language<StyledSelect label="Instruction language" value={language} onChange={value=>setLanguage(value as ExerciseLanguage)} options={Object.entries(exerciseLanguages).map(([value,label])=>({value,label}))} menuMinWidth={240}/></label>
    {selected&&<p><strong>Supporting muscles:</strong> {selected.secondaryMuscles.length?selected.secondaryMuscles.map(label).join(", "):"Not specified"}</p>}
    {detailError?<p role="alert" className="field-error">{detailError}</p>:detail?<><h3>How to perform</h3><ol lang={detail.language}>{detail.steps.map((step,index)=><li key={index}>{step}</li>)}</ol></>:<p role="status">Loading instructions…</p>}
    {selected&&<Button intent="brand" disabled={!selection.some(row=>row.id===selected.id)&&selection.length>=20} onClick={()=>toggle(selected)}>{selection.some(row=>row.id===selected.id)?"Remove from selection":"Add to selection"}</Button>}
   </div>
  </Modal>
 </div>;
}
