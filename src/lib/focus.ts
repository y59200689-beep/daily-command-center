import type { SupabaseClient } from "@supabase/supabase-js";

/** Resolve links using owned records instead of trusting a caller's project ID. */
export async function resolveFocusProject(supabase: SupabaseClient, userId: string, input: { taskId?: string; projectId?: string }) {
    let projectId = input.projectId;
    if (input.taskId) {
      const task = await supabase.from("tasks").select("id,project_id").eq("id", input.taskId).eq("user_id", userId).is("deleted_at", null).maybeSingle();
      if (task.error) throw task.error;
      if (!task.data) throw new Error("Task not found.");
      if (projectId && task.data.project_id !== projectId) throw new Error("Choose a task from the selected project.");
      projectId = task.data.project_id ?? undefined;
    }
    if (projectId) {
      const project = await supabase.from("projects").select("id").eq("id", projectId).eq("user_id", userId).is("deleted_at", null).maybeSingle();
      if (project.error) throw project.error;
      if (!project.data) throw new Error("Project not found.");
    }
    return projectId ?? null;
}
