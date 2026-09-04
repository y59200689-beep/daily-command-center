import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
const schema=z.object({invoice_id:z.uuid(),amount:z.coerce.number().positive(),payment_date:z.iso.date(),payment_method:z.string().trim().max(120).optional().nullable(),reference:z.string().trim().max(240).optional().nullable(),notes:z.string().max(5000).optional().nullable()}).strict();
export async function POST(request:Request){try{const input=schema.parse(await request.json());const{supabase}=await requireUser();const{data,error}=await supabase.rpc("record_invoice_payment",{payment_invoice_id:input.invoice_id,payment_amount:input.amount,payment_date_value:input.payment_date,payment_method_value:input.payment_method??null,payment_reference:input.reference??null,payment_notes:input.notes??null});if(error)throw error;return NextResponse.json({payment:data},{status:201})}catch(error){return apiError(error,"Payment could not be recorded.")}}
