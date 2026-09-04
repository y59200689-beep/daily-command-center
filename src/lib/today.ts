import type { SupabaseClient } from "@supabase/supabase-js";
export async function setDailyPriority(client:SupabaseClient,userId:string,taskId:string,position:number|null){
  if(position!==null&&![1,2,3].includes(position))throw new Error("Daily win position must be 1, 2, or 3.");
  const today=new Date().toISOString().slice(0,10);
  const owned=await client.from("tasks").select("id").eq("id",taskId).eq("user_id",userId).is("deleted_at",null).maybeSingle();
  if(owned.error)throw owned.error;
  if(!owned.data)throw new Error("Task not found.");
  if(position===null){
    const plan=await client.from("daily_plans").select("id").eq("user_id",userId).eq("plan_date",today).maybeSingle();
    if(plan.error)throw plan.error;
    if(!plan.data)return null;
    const removed=await client.from("daily_priorities").delete().eq("plan_id",plan.data.id).eq("task_id",taskId);
    if(removed.error)throw removed.error;
    return null;
  }
  const plan=await client.from("daily_plans").upsert({user_id:userId,plan_date:today},{onConflict:"user_id,plan_date"}).select("id").single();
  if(plan.error)throw plan.error;
  const removed=await client.from("daily_priorities").delete().eq("plan_id",plan.data.id).eq("task_id",taskId);
  if(removed.error)throw removed.error;
  const saved=await client.from("daily_priorities").upsert({user_id:userId,plan_id:plan.data.id,task_id:taskId,position},{onConflict:"plan_id,position"});
  if(saved.error)throw saved.error;
  return saved.data;
}
