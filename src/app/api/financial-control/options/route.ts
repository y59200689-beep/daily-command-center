import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { apiError } from '@/lib/api';
import { financialTargets } from '@/lib/financial-schema';
export async function GET(request:Request){try{const url=new URL(request.url),type=url.searchParams.get('type')??'',def=financialTargets[type];if(!def)throw new Error('Unsupported record type.');const {supabase,userId}=await requireUser();let query=supabase.from(def.table).select('*').eq('user_id',userId).limit(50);const text=(url.searchParams.get('q')??'').trim().slice(0,80);if(text)query=query.ilike(def.label,`%${text.replace(/[%_]/g,'')}%`);const r=await query;if(r.error)throw r.error;return NextResponse.json({items:(r.data??[]).map(item=>({id:item.id,label:item[def.label]??'Untitled record',route:def.route+'?record='+item.id}))},{headers:{'Cache-Control':'private, no-store'}});}catch(error){return apiError(error,'Related records could not be loaded.');}}
