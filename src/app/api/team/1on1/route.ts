import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const create1on1Schema = z.object({
  person_id: z.string().uuid(),
  meeting_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
  topics_discussed: z.string().max(4000).optional().nullable(),
  action_items: z.string().max(4000).optional().nullable(),
  note_content: z.string().max(4000).optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const url = new URL(request.url);
    const personId = url.searchParams.get("person_id");

    if (!personId) {
      // List people with 1:1 note counts
      const { data: people, error } = await supabase
        .from("team_people")
        .select("id, name, role_title, status, company_team")
        .eq("user_id", userId)
        .neq("status", "archived")
        .order("name");

      if (error) throw error;
      return NextResponse.json({ people: people ?? [] });
    }

    const [
      personRes,
      delegationsRes,
      commitmentsRes,
      notesRes,
    ] = await Promise.all([
      supabase.from("team_people").select("*").eq("id", personId).eq("user_id", userId).maybeSingle(),
      supabase.from("team_delegations").select("*").eq("user_id", userId).eq("delegated_to_person_id", personId).order("created_at", { ascending: false }),
      supabase.from("team_commitments").select("*").eq("user_id", userId).or(`from_person_id.eq.${personId},to_person_id.eq.${personId}`).order("created_at", { ascending: false }),
      supabase.from("team_one_on_one_notes").select("*, note:notes(id, title, content)").eq("user_id", userId).eq("person_id", personId).order("meeting_date", { ascending: false }),
    ]);

    if (!personRes.data) {
      return NextResponse.json({ error: "Person not found." }, { status: 404 });
    }

    const person = personRes.data;
    const allDelegations = delegationsRes.data ?? [];
    const openDelegations = allDelegations.filter((d) => !["completed", "cancelled"].includes(d.status));
    const blockedDelegations = allDelegations.filter((d) => d.status === "blocked");
    const completedRecently = allDelegations.filter((d) => d.status === "completed").slice(0, 5);

    const commitments = commitmentsRes.data ?? [];
    const openCommitments = commitments.filter((c) => c.status === "open");

    // Suggest objective topics to discuss
    const suggestedTopics: string[] = [];
    if (blockedDelegations.length > 0) {
      suggestedTopics.push(`Unblock ${blockedDelegations.length} blocked delegation(s): ${blockedDelegations.map((d) => d.title).join(", ")}`);
    }
    const overdue = openDelegations.filter((d) => d.due_at && d.due_at.slice(0, 10) < new Date().toISOString().slice(0, 10));
    if (overdue.length > 0) {
      suggestedTopics.push(`Review delivery timeline for overdue work: ${overdue.map((d) => d.title).join(", ")}`);
    }
    if (openCommitments.length > 0) {
      suggestedTopics.push(`Follow through on ${openCommitments.length} open commitment(s)`);
    }
    if (suggestedTopics.length === 0) {
      suggestedTopics.push("Review progress on active responsibilities and general support needs.");
    }

    return NextResponse.json({
      person,
      openDelegations,
      blockedDelegations,
      completedRecently,
      commitments: openCommitments,
      pastNotes: notesRes.data ?? [],
      suggestedTopics,
    });
  } catch (error) {
    return apiError(error, "1:1 prep could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    const parsed = create1on1Schema.parse(body);

    const { data: person } = await supabase
      .from("team_people")
      .select("id, name")
      .eq("id", parsed.person_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!person) {
      return NextResponse.json({ error: "Person not found." }, { status: 404 });
    }

    // Create a linked note in V1 notes table to preserve single note source of truth
    let noteId: string | null = null;
    if (parsed.note_content || parsed.topics_discussed || parsed.action_items) {
      const title = `1:1 with ${person.name} (${parsed.meeting_date})`;
      const content = [
        parsed.topics_discussed ? `### Topics Discussed\n${parsed.topics_discussed}` : "",
        parsed.action_items ? `### Action Items\n${parsed.action_items}` : "",
        parsed.note_content ? `### Notes\n${parsed.note_content}` : "",
      ].filter(Boolean).join("\n\n");

      const { data: note } = await supabase
        .from("notes")
        .insert({
          user_id: userId,
          title,
          content,
        })
        .select("id")
        .single();

      if (note) noteId = note.id;
    }

    const { data, error } = await supabase
      .from("team_one_on_one_notes")
      .insert({
        user_id: userId,
        person_id: parsed.person_id,
        note_id: noteId,
        meeting_date: parsed.meeting_date,
        topics_discussed: parsed.topics_discussed || null,
        action_items: parsed.action_items || null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error, "1:1 note could not be saved.");
  }
}
