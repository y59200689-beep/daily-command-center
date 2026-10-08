import "server-only";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { exercises } from "@/lib/exercise-catalog-server";
import { routineSchema, sessionSchema } from "@/lib/workouts";
const catalog=new Map(exercises.map(exercise=>[exercise.id,exercise.name]));
export async function workoutRead(request:Request,kind:"routines"|"workouts"){
 try{const {supabase,userId}=await requireUser();const params=new URL(request.url).searchParams;const page=Number(params.get("page")??1);if(!Number.isSafeInteger(page)||page<1)return Response.json({error:"Invalid page."},{status:400});const table=kind==="routines"?"fitness_routines":"fitness_workout_sessions";const id=params.get("id");if(id){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return Response.json({error:"Invalid record ID."},{status:400});const {data,error}=await supabase.from(table).select("*").eq("id",id).eq("user_id",userId).maybeSingle();if(error)throw error;return data?Response.json({record:data},{headers:{"Cache-Control":"private, no-store"}}):Response.json({error:"Record not found."},{status:404});}let query=supabase.from(table).select("*",{count:"exact"}).eq("user_id",userId);if(kind==="routines")query=query.eq("archived",false);else query=query.neq("status","discarded");const {data,error,count}=await query.order(kind==="routines"?"updated_at":"started_at",{ascending:false}).range((page-1)*20,page*20-1);if(error)throw error;return Response.json({records:data,total:count,page,pageSize:20},{headers:{"Cache-Control":"private, no-store"}});}catch(error){console.error("[fitness/workouts/read]",{code:error&&typeof error==="object"&&"code" in error?String(error.code):"unknown",type:error instanceof Error?error.name:"database"});return apiError(error,"Workout records could not be loaded.");}
}
export async function workoutWrite(request:Request,kind:"routines"|"workouts"){
 try{const {supabase,userId}=await requireUser();const text=await request.text();if(text.length>150000)return Response.json({error:"Workout is too large."},{status:400});let json:unknown;try{json=JSON.parse(text);}catch{return Response.json({error:"Invalid JSON."},{status:400});}
 const parsed=kind==="routines"?routineSchema.parse(json):sessionSchema.parse(json);
 for(const exercise of parsed.exercises){const name=catalog.get(exercise.exerciseId);if(!name)return Response.json({error:"Choose an exercise from the library."},{status:400});exercise.name=name;}
 const table=kind==="routines"?"fitness_routines":"fitness_workout_sessions";
 const {id,version,name,notes,exercises:items}=parsed;
 const values=kind==="routines"?{name,notes,exercises:items,archived:routineSchema.parse(parsed).archived}:{name,notes,exercises:items,routine_id:sessionSchema.parse(parsed).routineId,started_at:sessionSchema.parse(parsed).startedAt,status:sessionSchema.parse(parsed).status};
 const query=version===0?supabase.from(table).insert({...values,id,user_id:userId,version:1}):supabase.from(table).update({...values,version:version+1,updated_at:new Date().toISOString()}).eq("id",id).eq("user_id",userId).eq("version",version);
 const {data,error}=await query.select("*").maybeSingle();
 if(error?.code==="23505"&&version===0){const existing=await supabase.from(table).select("*").eq("id",id).eq("user_id",userId).maybeSingle();if(existing.data)return Response.json({record:existing.data,duplicate:true});}
 if(error)throw error;if(!data&&kind==="workouts"&&sessionSchema.parse(parsed).status==="completed"){const existing=await supabase.from(table).select("*").eq("id",id).eq("user_id",userId).eq("status","completed").maybeSingle();if(existing.data)return Response.json({record:existing.data,duplicate:true});}if(!data)return Response.json({error:"This record changed in another tab. Reload it before saving again."},{status:409});return Response.json({record:data},{status:version===0?201:200});
 }catch(error){console.error("[fitness/workouts/write]",{code:error&&typeof error==="object"&&"code" in error?String(error.code):"validation-or-request"});return apiError(error,"Workout could not be saved. Your entries have been kept.");}
}
