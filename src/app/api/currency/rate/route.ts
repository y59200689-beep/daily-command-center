import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { madToUsd } from '@/lib/currency/rates';
export async function GET(request:Request){try{await requireUser();const date=new URL(request.url).searchParams.get('date')??new Date().toISOString().slice(0,10);return NextResponse.json({...await madToUsd(date),requestedDate:date,source:'Frankfurter',sourceUrl:'https://frankfurter.dev/'},{headers:{'Cache-Control':'private, max-age=300'}});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Exchange rate unavailable'},{status:503});}}
