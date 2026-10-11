import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { boardInput } from "@/lib/brainstorm";
export async function GET(request:Request) {
 try {const {supabase,userId}=await requireUser(); const projectId=new URL(request.url).searchParams.get('projectId');
 const valid=boardInput.shape.projectId.safeParse(projectId); if(!valid.success)return Response.json({error:'Choose a project.'},{status:400});
 const {data,error}=await supabase.from('brainstorm_boards').select('id,project_id,title,task_ids,version,archived,updated_at').eq('user_id',userId).eq('project_id',valid.data).eq('archived',false).order('updated_at',{ascending:false}).limit(100);if(error)throw error;
 return Response.json({boards:data},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return apiError(error,'Boards could not be loaded.');}
}
export async function POST(request:Request) {
 try {const {supabase,userId}=await requireUser(); const raw=await request.text(); if(new TextEncoder().encode(raw).length>3500000)return Response.json({error:'Board exceeds the 3.5 MB limit. Remove large images or export a backup.'},{status:413});
 let json:unknown;try{json=JSON.parse(raw)}catch{return Response.json({error:'Invalid JSON.'},{status:400})}
 const input=boardInput.parse(json);
 const project=await supabase.from('projects').select('id').eq('id',input.projectId).eq('user_id',userId).is('deleted_at',null).maybeSingle();if(project.error)throw project.error;if(!project.data)return Response.json({error:'Project unavailable.'},{status:404});
 if(input.taskIds.length){const tasks=await supabase.from('tasks').select('id').eq('user_id',userId).eq('project_id',input.projectId).is('deleted_at',null).in('id',input.taskIds);if(tasks.error)throw tasks.error;if(tasks.data?.length!==input.taskIds.length)return Response.json({error:'Link tasks from this project only.'},{status:400});}
 const values={title:input.title,task_ids:input.taskIds,scene:input.scene,archived:input.archived,version:input.version+1,updated_at:new Date().toISOString()};
 const query=input.version===0?supabase.from('brainstorm_boards').insert({...values,id:input.id,project_id:input.projectId,user_id:userId}):supabase.from('brainstorm_boards').update(values).eq('id',input.id).eq('user_id',userId).eq('project_id',input.projectId).eq('version',input.version);
 const {data,error}=await query.select('*').maybeSingle();if(error?.code==='23505')return Response.json({error:'Board already exists. Reload before saving.'},{status:409});if(error)throw error;if(!data)return Response.json({error:'This board changed in another tab. Export your changes before reloading.'},{status:409});return Response.json({board:data},{status:input.version===0?201:200});
 }catch(error){return apiError(error,'Board could not be saved. Your changes are still in the editor.');}
}
