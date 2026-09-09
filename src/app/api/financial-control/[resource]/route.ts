import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { apiError } from '@/lib/api';
import { financialTables,type FinancialResource } from '@/lib/financial-schema';
import { saveFinancialRecord } from '@/lib/financial-server';
const resourceSchema=z.enum(Object.keys(financialTables) as [FinancialResource,...FinancialResource[]]);
export async function GET(request:Request,{params}:{params:Promise<{resource:string}>}){try{const resource=resourceSchema.parse((await params).resource),{supabase,userId}=await requireUser();const page=z.coerce.number().int().min(0).max(10000).parse(new URL(request.url).searchParams.get('page')??0);const result=await supabase.from(financialTables[resource]).select('*').eq('user_id',userId).order('created_at',{ascending:false}).range(page*50,page*50+49);if(result.error)throw result.error;return NextResponse.json({items:result.data,page},{headers:{'Cache-Control':'private, no-store'}});}catch(error){return apiError(error,'Financial records could not be loaded.');}}
export async function POST(request:Request,{params}:{params:Promise<{resource:string}>}){try{const resource=resourceSchema.parse((await params).resource),{supabase,userId}=await requireUser();const item=await saveFinancialRecord(supabase,userId,resource,await request.json());return NextResponse.json({item},{status:201});}catch(error){return apiError(error,'Financial record could not be saved.');}}
