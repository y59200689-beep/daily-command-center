export type LeadRow = Record<string, unknown> & { id: string; created_at?: string; updated_at?: string };
export const leadStatuses = ['new','contacted','qualified','unqualified','converted','lost'] as const;
export const leadSources = ['referral','instagram','website','email','whatsapp_manual','networking','existing_client','other'] as const;
export const leadLabel = (value: unknown) => String(value ?? 'Not recorded').replaceAll('_',' ').replace(/^./, char => char.toUpperCase());
export function leadSummary(rows: LeadRow[], now = new Date()) {
 const today = new Date(now.getFullYear(),now.getMonth(),now.getDate()); const tomorrow = new Date(today);tomorrow.setDate(today.getDate()+1);const week = new Date(now);week.setDate(now.getDate()-7);
 const recent=rows.filter(row=>row.created_at&&new Date(row.created_at)>=week&&new Date(row.created_at)<=now);
 const due=rows.filter(row=>row.next_follow_up_at&&new Date(String(row.next_follow_up_at))<tomorrow&&!['converted','lost','unqualified'].includes(String(row.status)));
 const converted=rows.filter(row=>row.status==='converted');
 return {total:rows.length,recent,due,converted,rate:rows.length?Math.round(converted.length/rows.length*100):null};
}
export function filterLeads(rows: LeadRow[], opportunities: LeadRow[], filters: {query:string;source:string[];status:string;stage:string;due:boolean;recent:boolean;sort:string}, now = new Date()) {
 const summary=leadSummary(rows,now),due=new Set(summary.due.map(row=>row.id)),recent=new Set(summary.recent.map(row=>row.id));const query=filters.query.trim().toLowerCase();
 return rows.filter(row=>(!query||[row.name,row.company,row.email,row.phone].some(value=>String(value??'').toLowerCase().includes(query)))&&(!filters.source.length||filters.source.includes(String(row.source)))&&(!filters.status||row.status===filters.status)&&(!filters.stage||opportunities.some(opportunity=>opportunity.lead_id===row.id&&opportunity.stage===filters.stage))&&(!filters.due||due.has(row.id))&&(!filters.recent||recent.has(row.id))).sort((a,b)=>filters.sort==='name'?String(a.name).localeCompare(String(b.name)):filters.sort==='followup'?String(a.next_follow_up_at||'9999').localeCompare(String(b.next_follow_up_at||'9999')):String(b.updated_at??'').localeCompare(String(a.updated_at??'')));
}
export function followUpLabel(value: unknown, now = new Date()) { if(!value)return 'Not scheduled';const date=new Date(String(value));const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());const target=new Date(date.getFullYear(),date.getMonth(),date.getDate());const days=Math.round((target.getTime()-start.getTime())/86400000);return days<0?`${Math.abs(days)} days overdue`:days===0?'Today':days===1?'Tomorrow':`In ${days} days`; }
