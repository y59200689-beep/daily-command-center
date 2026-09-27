import { resolveFocusProject } from "@/lib/focus";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const startSchema = z.object({ taskId: z.uuid().optional(), projectId: z.uuid().optional() }).refine(input => input.taskId || input.projectId, "Choose a task or project.");
const finishSchema = z.object({ sessionId: z.uuid(), durationSeconds: z.number().int().nonnegative(), notes: z.string().max(5000), taskStatus: z.enum(["completed", "blocked", "skipped"]) });

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    // Read every page so completed project tasks remain part of the progress total.
    async function collection(table: "tasks" | "projects") {
      const rows: Record<string, unknown>[] = [];
      for (let offset = 0; ; offset += 500) {
        const result = await supabase.from(table).select("*").eq("user_id", userId).is("deleted_at", null).order("id").range(offset, offset + 499);
        if (result.error) throw result.error;
        rows.push(...result.data);
        if (result.data.length < 500) return rows;
      }
    }
    const [tasks, projects, sessions] = await Promise.all([
      collection("tasks"), collection("projects"),
      supabase.from("focus_sessions").select("id,started_at,duration_seconds,tasks(title),projects(name)").eq("user_id", userId).not("ended_at", "is", null).order("started_at", { ascending: false }).limit(3),
    ]);
    if (sessions.error) throw sessions.error;
    return NextResponse.json({ tasks, projects, sessions: sessions.data ?? [] });
  } catch (error) { return apiError(error, "Focus workspace could not be loaded."); }
}

export async function POST(request: Request) {
  try {
    const input = startSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();
    const projectId = await resolveFocusProject(supabase, userId, input);
    const created = await supabase.from("focus_sessions").insert({ user_id: userId, task_id: input.taskId ?? null, project_id: projectId ?? null, started_at: new Date().toISOString(), mode: "count_up" }).select("id").single();
    if (created.error) throw created.error;
    return NextResponse.json({ sessionId: created.data.id }, { status: 201 });
  } catch (error) { return apiError(error, "Focus session could not be started."); }
}

export async function PATCH(request: Request) {
  try {
    const input = finishSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();
    // The session owns its task association; never accept an unrelated task from the client.
    const current = await supabase.from("focus_sessions").select("id,task_id,ended_at").eq("id", input.sessionId).eq("user_id", userId).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return NextResponse.json({ error: "Focus session not found." }, { status: 404 });
    if (current.data.ended_at) return NextResponse.json({ saved: true });
    if (current.data.task_id && input.taskStatus !== "skipped") {
      const updated = await supabase.from("tasks").update({ status: input.taskStatus, completed_at: input.taskStatus === "completed" ? new Date().toISOString() : null }).eq("id", current.data.task_id).eq("user_id", userId).is("deleted_at", null);
      if (updated.error) throw updated.error;
    }
    const session = await supabase.from("focus_sessions").update({ ended_at: new Date().toISOString(), duration_seconds: input.durationSeconds, notes: input.notes }).eq("id", input.sessionId).eq("user_id", userId).is("ended_at", null);
    if (session.error) throw session.error;
    return NextResponse.json({ saved: true });
  } catch (error) { return apiError(error, "Focus session could not be saved."); }
}
