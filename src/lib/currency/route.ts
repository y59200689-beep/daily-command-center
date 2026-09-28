import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { convertMoneyInput } from './conversion';
import { madToUsd } from './rates';
// Convert before route validation, calculations, and RPC calls. Never relabel an amount.
export function withUsdInput<C>(handler:(request:NextRequest,context:C)=>Promise<Response>){
 return async(incoming:Request,context:C):Promise<Response>=>{
  const request=incoming instanceof NextRequest?incoming:new NextRequest(incoming);
  if(!request.headers.get('content-type')?.includes('application/json'))return handler(request,context);
  let body:unknown;try{body=await request.clone().json();}catch{return handler(request,context);}
  if(!/"(?:currency|metric_currency)"\s*:\s*"\s*MAD\s*"/i.test(JSON.stringify(body)))return handler(request,context);
  try{
   const {supabase,userId}=await requireUser();
   const {value,conversions}=await convertMoneyInput(body,madToUsd);
   // Keep the submitted amounts and dated rate even if subsequent record validation fails.
   let receiptId:string|undefined;
   if(conversions.length){const receipt=await supabase.from('currency_conversion_receipts').insert({user_id:userId,route:request.nextUrl.pathname,method:request.method,original_input:body,conversions,state:'pending'}).select('id').single();if(receipt.error)throw new Error('Could not preserve the original currency entry. Please retry.');receiptId=receipt.data.id;}
   const headers=new Headers(request.headers);headers.delete('content-length');
   const rewritten=new NextRequest(request.url,{method:request.method,headers,body:JSON.stringify(value)});
   const response=await handler(rewritten,context);
   if(receiptId){const saved=await response.clone().json().catch(()=>null);const result=await supabase.from('currency_conversion_receipts').update({state:response.ok?'saved':'rejected',result:saved}).eq('id',receiptId).eq('user_id',userId);if(result.error)console.error('Currency receipt status update failed',receiptId);}
   return response;
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Currency conversion failed. Your entry was not saved.'},{status:503});}
 };
}
