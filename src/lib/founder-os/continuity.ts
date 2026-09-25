import type { Row } from "./repository";
import { daysUntil, expiryWindow, type Sources, type Signal } from "./intelligence";
export function administratorCoverage(systemId:string,access:Row[]) {
 const rows=access.filter(r=>r.system_id===systemId&&["owner","admin"].includes(String(r.access_level)));
 const identities=new Map<string,Row[]>();
 const known=new Map(rows.filter(r=>r.person_id).map(r=>[String(r.person_label).trim().toLowerCase(),String(r.person_id)]));
 for(const r of rows){const label=String(r.person_label).trim().toLowerCase();const key=String(r.person_id??known.get(label)??label);identities.set(key,[...(identities.get(key)??[]),r]);}
 return {count:identities.size,backup:identities.size>=2&&[...identities.values()].some(records=>records.some(r=>r.backup_admin)),admins:rows};
}
export function continuitySignals(data:Sources,today:string):Signal[] {
 const result:Signal[]=[];
 const add=(r:Row,type:string,severity:Signal['severity'],reasons:string[],impact:string,action:string,route:string,deadline?:string)=>result.push({id:`continuity:${r.id}:${type}`,sourceId:r.id,companyId:r.company_id?String(r.company_id):undefined,title:String(r.name??r.person_label),type,domain:"technical",severity,reasons,impact,action,route,deadline,detectedAt:today});
 for(const system of (data.systems??[]).filter(r=>r.status!=="deprecated")) {
  const critical=["high","critical"].includes(String(system.criticality)), path=`/infrastructure?record=${system.id}`, access=administratorCoverage(system.id,data.access??[]);
  const days=daysUntil(system.renewal_date,today),band=expiryWindow(system.renewal_date,today),window=critical?90:system.criticality==="medium"?30:14;
  if(days!==null&&days<=window)add(system,system.system_type==="domain"?"DOMAIN_EXPIRY_SOON":"INFRA_RENEWAL_SOON",days<=7&&critical?"high":"medium",[`Renewal band: ${band}`,`Recorded expiry ${system.renewal_date}`,system.auto_renew?"Auto-renew enabled; verify payment and registrar confirmation.":"Auto-renew is not enabled."],system.production_dependency?"Production depends on this service; expiry can interrupt delivery.":"Continuity or access may be affected by expiry.","Review renewal and billing",path,String(system.renewal_date));
  if(critical&&!system.owner_label)add(system,"UNOWNED_CRITICAL_SYSTEM","high",["No accountable owner is recorded."],"Renewals, incidents and recovery may go unhandled.","Assign an accountable owner",path);
  if(critical&&access.count<=1)add(system,"SINGLE_OWNER_CRITICAL_SYSTEM","high",[`${access.count} distinct administrators recorded.`],"Loss of the sole administrator can block recovery.","Review administrator coverage",`/infrastructure/access?system=${system.id}`);
  if(critical&&!access.backup)add(system,"NO_BACKUP_ADMIN","high",["No distinct backup administrator is recorded."],"Recovery depends on the primary administrator.","Record and verify backup access","/infrastructure/access");
  for(const a of access.admins){
   if(critical&&a.two_factor_enabled!==true)add({...a,name:`${system.name}: ${a.person_label}`,company_id:system.company_id},"NO_2FA_ON_CRITICAL_SYSTEM","high",["Administrator 2FA is disabled or unverified."],"Privileged access is less protected.","Verify 2FA and update metadata",`/infrastructure/access?record=${a.id}`);
   const age=daysUntil(a.last_audit_date,today);
   if(critical&&(age===null||age< -90))add({...a,name:`${system.name}: access review`,company_id:system.company_id},"ACCESS_REVIEW_OVERDUE","medium",[`Last audit: ${a.last_audit_date??"never recorded"}`,"Review policy: 90 days."],"Stale access can outlast the person's responsibilities.","Audit access and recovery",`/infrastructure/access?record=${a.id}`);
  }
  if(critical&&system.migration_status==="blocked")add(system,"MIGRATION_BLOCKED","high",["Migration status is explicitly blocked."],"Required schema changes or release readiness may be blocked.","Review migration evidence",path);
  const latest=new Map<string,Row>();for(const c of [...(data.healthChecks??[])].filter(r=>r.system_id===system.id&&String(r.checked_on)<=today).sort((a,b)=>String(b.checked_on).localeCompare(String(a.checked_on))||String(b.created_at).localeCompare(String(a.created_at)))){const key=`${c.component}:${c.name}`;if(!latest.has(key))latest.set(key,c);}
  for(const check of latest.values())if(["attention","failed"].includes(String(check.status)))add({...check,company_id:system.company_id,name:`${system.name}: ${check.name}`},"TECHNICAL_HEALTH_ATTENTION",critical&&check.status==="failed"?"high":"medium",[`${check.component}: ${check.status}; checked ${check.checked_on}`,String(check.reason),`Source: ${check.source}; recorded evidence, not live monitoring.`],`The ${check.component} component may affect this system's operation.`,"Investigate and record a new observation",`/infrastructure/health?record=${check.id}`);
 }
 return result;
}
export type TechnicalSystem = Row & {renewalBand:string|number;coverage:ReturnType<typeof administratorCoverage>;checks:(Row&{stale:boolean})[];latestSuccessful:Row|null;latestFailed:Row|null;incidents:Row[]};
export function technicalSystems(data:Sources,today:string):TechnicalSystem[]{
 return (data.systems??[]).filter(r=>r.status!=="deprecated").map(s=>{
  const history=(data.healthChecks??[]).filter(c=>c.system_id===s.id&&String(c.checked_on)<=today).sort((a,b)=>String(b.checked_on).localeCompare(String(a.checked_on))||String(b.created_at).localeCompare(String(a.created_at)));
  const seen=new Set<string>(),checks=history.filter(c=>{const key=`${c.component}:${c.name}`;if(seen.has(key))return false;seen.add(key);return true;}).map(c=>({...c,stale:(daysUntil(c.checked_on,today)??-999)<-30}));
  const deployments=(data.deployments??[]).filter(d=>d.company_id===s.company_id&&(!s.project_id||d.project_id===s.project_id)&&d.environment==="production").sort((a,b)=>String(b.completed_at??b.created_at).localeCompare(String(a.completed_at??a.created_at)));
  return {...s,renewalBand:expiryWindow(s.renewal_date,today),coverage:administratorCoverage(s.id,data.access??[]),checks,latestSuccessful:deployments.find(d=>d.status==="ready")??null,latestFailed:deployments.find(d=>d.status==="failed")??null,incidents:(data.incidents??[]).filter(i=>i.company_id===s.company_id&&i.status!=="resolved")};
 });
}
