import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { taskInputSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try { const { supabase } = await requireUser(); const url = new URL(request.url); const status = url.searchParams.get("status"); let query = supabase.from("tasks").select("id,title,description,status,priority,due_date,estimated_minutes,project:projects(id,name,color)").is("deleted_at", null).order("created_at", { ascending: false }).range(0, 99); if (status) query = query.eq("status", status); const { data, error } = await query; if (error) throw error; return NextResponse.json({ data }); } catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "AUTH_REQUIRED" ? "Authentication required." : "Tasks could not be loaded." }, { status: error instanceof Error && error.message === "AUTH_REQUIRED" ? 401 : 500 }); }
}
export async function POST(request: Request) {
  try { const { supabase, userId } = await requireUser(); const parsed = taskInputSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Check the task details.", fields: parsed.error.flatten().fieldErrors }, { status: 400 }); const input = parsed.data; const { data, error } = await supabase.from("tasks").insert({ user_id: userId, title: input.title, description: input.description, status: input.status, priority: input.priority, project_id: input.projectId, due_date: input.dueDate, estimated_minutes: input.estimatedMinutes, created_by: "user" }).select().single(); if (error) throw error; return NextResponse.json({ data }, { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "AUTH_REQUIRED" ? "Authentication required." : "Task could not be created." }, { status: error instanceof Error && error.message === "AUTH_REQUIRED" ? 401 : 500 }); }
}
