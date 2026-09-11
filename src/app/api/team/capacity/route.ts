import { NextResponse } from "next/server";
import { apiError, isMissingOptionalSchema } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { evaluatePersonCapacity, type TeamPerson } from "@/lib/team";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();

    const [
      peopleRes,
      delegationsRes,
      commitmentsRes,
      ownershipLinksRes,
      availabilityRes,
    ] = await Promise.all([
      supabase.from("team_people").select("*").eq("user_id", userId).neq("status", "archived").order("name"),
      supabase.from("team_delegations").select("*").eq("user_id", userId).not("status", "in", "(completed,cancelled)"),
      supabase.from("team_commitments").select("*").eq("user_id", userId).eq("status", "open"),
      supabase.from("team_entity_ownership").select("*").eq("user_id", userId),
      supabase.from("team_availability").select("*").eq("user_id", userId),
    ]);
    const failed = [peopleRes, delegationsRes, commitmentsRes, ownershipLinksRes, availabilityRes].find((result) => result.error);
    if (failed?.error) throw failed.error;

    const people = (peopleRes.data ?? []) as TeamPerson[];
    const delegations = delegationsRes.data ?? [];
    const commitments = commitmentsRes.data ?? [];
    const ownershipLinks = ownershipLinksRes.data ?? [];
    const availabilities = availabilityRes.data ?? [];

    const taskIds = ownershipLinks.filter((l) => l.entity_type === "task").map((l) => l.entity_id);
    const runIds = ownershipLinks.filter((l) => l.entity_type === "process_run").map((l) => l.entity_id);

    let allTasks: Array<{ id: string; priority?: string; status?: string }> = [];
    let allRuns: Array<{ id: string; priority?: string; status?: string }> = [];

    if (taskIds.length > 0) {
      const { data } = await supabase.from("tasks").select("id,priority,status").in("id", taskIds).eq("user_id", userId);
      allTasks = (data ?? []) as typeof allTasks;
    }
    if (runIds.length > 0) {
      const { data } = await supabase.from("process_runs").select("id,priority,status").in("id", runIds).eq("user_id", userId);
      allRuns = (data ?? []) as typeof allRuns;
    }

    const capacityCards = people.map((person) => {
      const personLinks = ownershipLinks.filter((l) => l.person_id === person.id);
      const pTaskIds = new Set(personLinks.filter((l) => l.entity_type === "task").map((l) => l.entity_id));
      const pRunIds = new Set(personLinks.filter((l) => l.entity_type === "process_run").map((l) => l.entity_id));

      const personTasks = allTasks.filter((t) => pTaskIds.has(t.id));
      const personRuns = allRuns.filter((r) => pRunIds.has(r.id));
      const personDelegations = delegations.filter((d) => d.delegated_to_person_id === person.id);
      const personCommitments = commitments.filter((c) => c.from_person_id === person.id || c.to_person_id === person.id);
      const personAvail = availabilities.find((a) => a.person_id === person.id);

      return evaluatePersonCapacity(person, personTasks, personRuns, personDelegations, personCommitments, personAvail);
    });

    const overloaded = capacityCards.filter((c) => c.capacity_state === "overloaded").length;
    const busy = capacityCards.filter((c) => c.capacity_state === "busy").length;
    const available = capacityCards.filter((c) => c.capacity_state === "available").length;

    return NextResponse.json({
      capacityCards,
      summary: {
        total: people.length,
        overloaded,
        busy,
        available,
      },
    });
  } catch (error) {
    if (isMissingOptionalSchema(error)) return NextResponse.json({ capacityCards: [], summary: null, schemaStatus: "unavailable", schemaDependency: "V12 Team Coordination schema" });
    return apiError(error, "Team capacity could not be loaded.");
  }
}
