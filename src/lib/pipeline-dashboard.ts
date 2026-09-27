import { opportunityStages, stageProbability, type OpportunityStage } from "./business";
import { isOpenOpportunity, recordCurrency, type BusinessRecord } from "./business-dashboard";
import { scoreOpportunity, evaluatePipelineQuality, type OpportunityHealthInput } from "./growth";
export const pipelineBoardStages = opportunityStages.filter(stage => stage !== "lost");
export type PipelineOwner = { id: string; name: string };
export type PipelineOwners = Record<string, PipelineOwner | null>;
export type PipelineFilters = { query: string; client: string; owner: string; stage: string; currency: string; sort: "close" | "value" | "updated" | "title" };
export function pipelineScore(row: BusinessRecord, today: string) {
  return scoreOpportunity({ ...row, title: String(row.title ?? "Untitled opportunity"), stage: String(row.stage ?? "new") } as OpportunityHealthInput, today);
}
export function pipelineSnapshot(rows: BusinessRecord[], currency: string, today: string) {
  const selected = rows.filter(row => recordCurrency(row) === currency);
  const open = selected.filter(isOpenOpportunity);
  const won = selected.filter(row => row.stage === "won");
  const lost = selected.filter(row => row.stage === "lost");
  return { open, won, lost, value: open.reduce((total,row) => total + Number(row.estimated_value ?? 0),0), weighted: open.reduce((total,row) => total + Number(row.estimated_value ?? 0) * Number(row.probability ?? stageProbability[row.stage as OpportunityStage] ?? 0) / 100,0), winRate: won.length + lost.length ? Math.round(won.length / (won.length + lost.length) * 100) : null, quality: evaluatePipelineQuality(selected.map(row => ({ ...row,title:String(row.title ?? ""),stage:String(row.stage) })) as OpportunityHealthInput[],today) };
}
export function filterPipeline(rows: BusinessRecord[], filters: PipelineFilters, clients: BusinessRecord[], owners: PipelineOwners) {
  const needle=filters.query.trim().toLowerCase();
  const clientMap=new Map(clients.map(client=>[client.id,client]));
  return rows.filter(row => recordCurrency(row)===filters.currency && (!filters.stage ? row.stage !== "lost" : row.stage===filters.stage) && (!filters.client || (filters.client==="unlinked" ? !row.client_id : row.client_id===filters.client)) && (!filters.owner || (filters.owner==="unrecorded" ? !owners[row.id] : owners[row.id]?.id===filters.owner)) && (!needle || [row.title,row.next_action,clientMap.get(String(row.client_id))?.name,owners[row.id]?.name].some(value=>String(value??"").toLowerCase().includes(needle)))).sort((a,b)=> {
    if(filters.sort==="value")return Number(b.estimated_value??0)-Number(a.estimated_value??0)||a.id.localeCompare(b.id);
    if(filters.sort==="updated")return String(b.updated_at??"").localeCompare(String(a.updated_at??""))||a.id.localeCompare(b.id);
    if(filters.sort==="title")return String(a.title??"").localeCompare(String(b.title??""));
    return String(a.expected_close_date||"9999").localeCompare(String(b.expected_close_date||"9999"))||String(a.title??"").localeCompare(String(b.title??""));
  });
}
export function pipelineDistribution(rows: BusinessRecord[], period: "all"|"this_month", today: string) {
  const visible=rows.filter(row => row.stage !== "lost" && (period==="all" || String(row.updated_at??row.created_at??"").slice(0,7)===today.slice(0,7)));
  return pipelineBoardStages.map(stage=>({stage,count:visible.filter(row=>row.stage===stage).length,share:visible.length?Math.round(visible.filter(row=>row.stage===stage).length/visible.length*100):0}));
}
export function pipelineActions(rows: BusinessRecord[], today: string) {
  return rows.filter(row=>isOpenOpportunity(row)&&String(row.next_action??"").trim()).sort((a,b)=>{
    const aOverdue=Boolean(a.next_action_date&&String(a.next_action_date)<today);const bOverdue=Boolean(b.next_action_date&&String(b.next_action_date)<today);
    const rank={Critical:0,High:1,Medium:2,Low:3};
    return Number(bOverdue)-Number(aOverdue)||rank[pipelineScore(a,today).priority]-rank[pipelineScore(b,today).priority]||String(a.next_action_date||"9999").localeCompare(String(b.next_action_date||"9999"));
  });
}
export async function readPipelineCollection(url: string, signal: AbortSignal): Promise<BusinessRecord[]> {
  const rows:BusinessRecord[]=[];let page=1;let total=0;
  do {const response=await fetch(`${url}?pageSize=100&page=${page}`,{cache:"no-store",signal});const body=await response.json();if(!response.ok)throw new Error(body.error||"Pipeline records could not be loaded.");if(!Array.isArray(body.records))throw new Error("Pipeline records could not be read. Please retry.");rows.push(...body.records);total=body.total??rows.length;page++;if(!body.records.length)break;} while(rows.length<total);
  return rows;
}
