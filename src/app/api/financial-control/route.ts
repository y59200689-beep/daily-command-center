import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { apiError } from '@/lib/api';
import { loadFinancialControl } from '@/lib/financial-server';
export async function GET(){try{const {supabase,userId}=await requireUser();return NextResponse.json(await loadFinancialControl(supabase,userId),{headers:{'Cache-Control':'private, no-store'}});}catch(error){if(isMissingFinancialSchema(error))return NextResponse.json({schemaStatus:'unavailable',schemaDependency:'V6 financial-control schema'},{headers:{'Cache-Control':'private, no-store'}});return apiError(error,'Financial Control is unavailable. Check that its schema is available before entering financial plans.');}}
function isMissingFinancialSchema(error:unknown){return Boolean(error&&typeof error==='object'&&'code' in error&&((error as {code?:unknown}).code==='PGRST205'||(error as {code?:unknown}).code==='42P01'))}
