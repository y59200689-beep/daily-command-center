import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { validateForeignOwnership } from "@/lib/team";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(240).optional(),
  display_name: z.string().trim().max(240).optional().nullable(),
  role_title: z.string().trim().max(240).optional().nullable(),
  role_id: z.string().uuid().optional().nullable(),
  company_team: z.string().trim().max(240).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable(),
  relationship_type: z.enum([
    "team_member", "contractor", "freelancer", "partner", "advisor",
    "client_contact", "supplier_contact", "collaborator", "other"
  ]).optional(),
  status: z.enum(["active", "inactive", "external", "archived"]).optional(),
  timezone: z.string().max(100).optional().nullable(),
  working_hours: z.string().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  avatar_url: z.string().url().optional().nullable().or(z.literal("")),
  linked_contact_id: z.string().uuid().optional().nullable(),
  linked_user_id: z.string().uuid().optional().nullable(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await params;

    const [
      personRes,
      responsibilitiesRes,
      delegationsRes,
      commitmentsRes,
      notesRes,
      availabilityRes,
      ownershipLinksRes,
    ] = await Promise.all([
      supabase.from("team_people").select("*, role:team_roles(id, name, responsibility_summary)").eq("id", id).eq("user_id", userId).maybeSingle(),
      supabase.from("team_responsibilities").select("*").eq("user_id", userId).or(`primary_owner_id.eq.${id},backup_owner_id.eq.${id}`).neq("status", "archived"),
      supabase.from("team_delegations").select("*").eq("user_id", userId).eq("delegated_to_person_id", id).order("created_at", { ascending: false }),
      supabase.from("team_commitments").select("*").eq("user_id", userId).or(`from_person_id.eq.${id},to_person_id.eq.${id}`).order("created_at", { ascending: false }),
      supabase.from("team_one_on_one_notes").select("*, note:notes(id, title, content)").eq("user_id", userId).eq("person_id", id).order("meeting_date", { ascending: false }),
      supabase.from("team_availability").select("*").eq("user_id", userId).eq("person_id", id).order("start_at", { ascending: false }),
      supabase.from("team_entity_ownership").select("*").eq("user_id", userId).eq("person_id", id),
    ]);

    if (personRes.error) throw personRes.error;
    if (!personRes.data) {
      return NextResponse.json({ error: "Person not found." }, { status: 404 });
    }

    return NextResponse.json({
      person: personRes.data,
      responsibilities: responsibilitiesRes.data ?? [],
      delegations: delegationsRes.data ?? [],
      commitments: commitmentsRes.data ?? [],
      oneOnOneNotes: notesRes.data ?? [],
      availability: availabilityRes.data ?? [],
      ownershipLinks: ownershipLinksRes.data ?? [],
    });
  } catch (error) {
    return apiError(error, "Person could not be loaded.");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.parse(body);

    if (parsed.linked_contact_id) {
      const validContact = await validateForeignOwnership(supabase, userId, "contact", parsed.linked_contact_id);
      if (!validContact) {
        return NextResponse.json({ error: "Linked contact does not belong to you." }, { status: 400 });
      }
    }

    if (parsed.role_id) {
      const { data: role } = await supabase
        .from("team_roles")
        .select("id")
        .eq("id", parsed.role_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!role) {
        return NextResponse.json({ error: "Linked role does not belong to you." }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from("team_people")
      .update(parsed)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error, "Person could not be updated.");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await params;

    const { error } = await supabase
      .from("team_people")
      .update({ status: "archived" })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Person could not be archived.");
  }
}
