import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { apiError } from '@/lib/api';
import { financialTables,type FinancialResource } from '@/lib/financial-schema';
import { saveFinancialRecord } from '@/lib/financial-server';
export async function PATCH(request:Request,{params}:{params:Promise<{resource:string;id:string}>}){try{const p=await params;const resource=z.enum(Object.keys(financialTables) as [FinancialResource,...FinancialResource[]]).parse(p.resource),id=z.uuid().parse(p.id),{supabase,userId}=await requireUser();return NextResponse.json({item:await saveFinancialRecord(supabase,userId,resource,await request.json(),id)});}catch(error){return apiError(error,'Financial record could not be updated.');}}
export async function DELETE(_:Request,{params}:{params:Promise<{resource:string;id:string}>}){try{const p=await params;if(p.resource!=='links')throw new Error('Archive financial records to preserve their history.');const {supabase,userId}=await requireUser();const result=await supabase.from('financial_context_links').delete().eq('id',z.uuid().parse(p.id)).eq('user_id',userId).select('id').maybeSingle();if(result.error)throw result.error;if(!result.data)return NextResponse.json({error:'Link unavailable'},{status:404});return NextResponse.json({ok:true});}catch(error){return apiError(error,'Link could not be removed.');}}
