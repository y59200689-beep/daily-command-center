import test from "node:test";
import assert from "node:assert/strict";
import { filterPipeline, pipelineSnapshot, pipelineDistribution, pipelineActions, readPipelineCollection, type PipelineFilters } from "../src/lib/pipeline-dashboard";
import type { BusinessRecord } from "../src/lib/business-dashboard";
const today="2026-09-27";
const rows:BusinessRecord[]=[
 {id:"a",title:"Website",stage:"new",client_id:"client-a",currency:"MAD",estimated_value:1000,probability:0,next_action:"Call client",next_action_date:"2026-09-26",expected_close_date:"2026-10-10",updated_at:"2026-09-26T10:00:00Z"},
 {id:"b",title:"Brand",stage:"qualified",currency:"MAD",estimated_value:2000,expected_close_date:null,updated_at:"2026-08-01T10:00:00Z"},
 {id:"c",title:"Won",stage:"won",currency:"MAD",estimated_value:3000,updated_at:"2026-09-01T10:00:00Z"},
 {id:"d",title:"Lost",stage:"lost",currency:"MAD",estimated_value:4000},
 {id:"e",title:"Euro",stage:"proposal",currency:"EUR",estimated_value:5000,next_action:"Send proposal",next_action_date:"2026-10-05"},
 {id:"f",title:"Unknown value",stage:"meeting",currency:"MAD",estimated_value:null,next_action:"Discovery",next_action_date:"2026-09-29"},
];
const defaults:PipelineFilters={query:"",client:"",owner:"",stage:"",currency:"MAD",sort:"close"};
test("pipeline totals isolate currency, exclude closed deals, and preserve explicit zero probability",()=>{const result=pipelineSnapshot(rows,"MAD",today);assert.equal(result.open.length,3);assert.equal(result.value,3000);assert.equal(result.weighted,500);assert.equal(result.winRate,50);assert.equal(pipelineSnapshot(rows,"EUR",today).winRate,null);});
test("board excludes lost deals by default and can explicitly show them",()=>{assert.equal(filterPipeline(rows,defaults,[],{}).length,4);assert.deepEqual(filterPipeline(rows,{...defaults,stage:"lost"},[],{}).map(row=>row.id),["d"]);});
test("client, owner, stage and text filters combine",()=>{const clients=[{id:"client-a",name:"Acme"}];const owners={a:{id:"person-a",name:"Sarah Chen"}};assert.deepEqual(filterPipeline(rows,{...defaults,query:"ACME",client:"client-a",owner:"person-a",stage:"new"},clients,owners).map(row=>row.id),["a"]);assert.equal(filterPipeline(rows,{...defaults,query:"Sarah"},clients,owners).length,1);assert.equal(filterPipeline(rows,{...defaults,client:"unlinked",owner:"person-a"},clients,owners).length,0);});
test("undated deals sort after dated close dates without changing the input",()=>{const visible=filterPipeline(rows,defaults,[],{});assert.equal(visible[0].id,"a");assert.equal(rows[0].id,"a");assert.deepEqual(filterPipeline(rows,{...defaults,sort:"value"},[],{}).map(row=>row.id),["c","b","a","f"]);});
test("distribution uses update month, counts won, and excludes lost",()=>{const result=pipelineDistribution(rows,"this_month",today);assert.equal(result.reduce((n,row)=>n+row.count,0),2);assert.equal(result.find(row=>row.stage==="won")?.count,1);assert.equal(result.find(row=>row.stage==="qualified")?.count,0);});
test("next actions include only open deals and prioritize overdue actions",()=>{assert.deepEqual(pipelineActions(rows,today).map(row=>row.id).sort(),["a","e","f"]);assert.equal(pipelineActions(rows,today)[0].id,"a");});
test("collection reader continues through all API pages",async()=>{const original=globalThis.fetch;const pages:string[]=[];globalThis.fetch=async input=>{pages.push(String(input));return new Response(JSON.stringify({records:pages.length===1?[rows[0]]:[rows[1]],total:2}));};try{assert.equal((await readPipelineCollection("/api/business/opportunities",new AbortController().signal)).length,2);assert.match(pages[1],/page=2$/);}finally{globalThis.fetch=original;}});
test("collection failures reject instead of masquerading as an empty pipeline",async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({error:"Read failed"}),{status:500});try{await assert.rejects(()=>readPipelineCollection("/api/business/opportunities",new AbortController().signal),/Read failed/);}finally{globalThis.fetch=original;}});
