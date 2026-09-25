import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { technicalSystems,continuitySignals } from "@/lib/founder-os/continuity";
import type { Sources } from "@/lib/founder-os/intelligence";
export async function GET(){try{
 const {supabase,userId}=await requireUser(),data:Sources={},coverage:string[]=[];
 await Promise.all(Object.entries({systems:"operational_systems",access:"system_access_records",healthChecks:"system_health_checks",deployments:"deployment_records",incidents:"incidents",companies:"companies"}).map(async([key,table])=>{const result=await supabase.from(table).select("*").eq("user_id",userId).order("created_at",{ascending:false}).limit(1001);if(result.error)throw result.error;data[key]=result.data.slice(0,1000);if(result.data.length>1000)coverage.push(key);}));
 const today=new Date().toISOString().slice(0,10);
 return NextResponse.json({systems:technicalSystems(data,today).map(s=>({...s,businessName:data.companies.find(c=>c.id===s.company_id)?.name??"Unassigned"})),signals:continuitySignals(data,today),coverage});
 }catch(e){return apiError(e,"Continuity evidence could not be loaded.");}}
