import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { boardInput } from "@/lib/brainstorm";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 try{const{id}=await params;const valid=boardInput.shape.id.safeParse(id);if(!valid.success)return Response.json({error:'Invalid board.'},{status:400});const{supabase,userId}=await requireUser();const{data,error}=await supabase.from('brainstorm_boards').select('*').eq('id',id).eq('user_id',userId).eq('archived',false).maybeSingle();if(error)throw error;return data?Response.json({board:data},{headers:{'Cache-Control':'private, no-store'}}):Response.json({error:'Board not found.'},{status:404});}catch(error){return apiError(error,'Board could not be loaded.');}
}
