import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { evaluatePersonCapacity, type TeamPerson } from "@/lib/team";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await params;

    const [
      personRes,
      delegationsRes,
      commitmentsRes,
      ownershipLinksRes,
      availabilityRes,
    ] = await Promise.all([
      supabase.from("team_people").select("*").eq("id", id).eq("user_id", userId).maybeSingle(),
      supabase.from("team_delegations").select("*").eq("user_id", userId).eq("delegated_to_person_id", id),
      supabase.from("team_commitments").select("*").eq("user_id", userId).or(`from_person_id.eq.${id},to_person_id.eq.${id}`),
      supabase.from("team_entity_ownership").select("*").eq("user_id", userId).eq("person_id", id),
      supabase.from("team_availability").select("*").eq("user_id", userId).eq("person_id", id).order("start_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (!personRes.data) {
      return NextResponse.json({ error: "Person not found." }, { status: 404 });
    }

    const person = personRes.data as TeamPerson;
    const delegations = delegationsRes.data ?? [];
    const commitments = commitmentsRes.data ?? [];
    const ownershipLinks = ownershipLinksRes.data ?? [];
    const availability = availabilityRes.data ?? null;

    // Load linked tasks and process runs if ownership links exist
    const taskIds = ownershipLinks.filter((l) => l.entity_type === "task").map((l) => l.entity_id);
    const runIds = ownershipLinks.filter((l) => l.entity_type === "process_run").map((l) => l.entity_id);

    let tasks: Array<{ id: string; priority?: string; status?: string }> = [];
    let runs: Array<{ id: string; priority?: string; status?: string }> = [];

    if (taskIds.length > 0) {
      const { data } = await supabase.from("tasks").select("id,priority,status").in("id", taskIds).eq("user_id", userId);
      tasks = (data ?? []) as typeof tasks;
    }
    if (runIds.length > 0) {
      const { data } = await supabase.from("process_runs").select("id,priority,status").in("id", runIds).eq("user_id", userId);
      runs = (data ?? []) as typeof runs;
    }

    const capacity = evaluatePersonCapacity(person, tasks, runs, delegations, commitments, availability);

    return NextResponse.json({
      capacity,
      workload: {
        activeTasks: tasks,
        activeRuns: runs,
        activeDelegations: delegations.filter((d) => !["completed", "cancelled"].includes(d.status)),
        openCommitments: commitments.filter((c) => c.status === "open"),
      },
    });
  } catch (error) {
    return apiError(error, "Person workload could not be evaluated.");
  }
}
