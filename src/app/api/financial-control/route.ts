import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { apiError } from '@/lib/api';
import { loadFinancialControl } from '@/lib/financial-server';
export async function GET(){try{const {supabase,userId}=await requireUser();return NextResponse.json(await loadFinancialControl(supabase,userId),{headers:{'Cache-Control':'private, no-store'}});}catch(error){return apiError(error,'Financial Control is unavailable. Check that its schema is available before entering financial plans.');}}
