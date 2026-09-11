import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, isMissingOptionalSchema } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { validateForeignOwnership } from "@/lib/team";

const relationshipTypes = [
  "team_member",
  "contractor",
  "freelancer",
  "partner",
  "advisor",
  "client_contact",
  "supplier_contact",
  "collaborator",
  "other",
] as const;

const personStatuses = ["active", "inactive", "external", "archived"] as const;

const createSchema = z.object({
  name: z.string().trim().min(1).max(240),
  display_name: z.string().trim().max(240).optional().nullable(),
  role_title: z.string().trim().max(240).optional().nullable(),
  role_id: z.string().uuid().optional().nullable(),
  company_team: z.string().trim().max(240).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable(),
  relationship_type: z.enum(relationshipTypes).default("team_member"),
  status: z.enum(personStatuses).default("active"),
  timezone: z.string().max(100).optional().nullable(),
  working_hours: z.string().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  avatar_url: z.string().url().optional().nullable().or(z.literal("")),
  linked_contact_id: z.string().uuid().optional().nullable(),
  linked_user_id: z.string().uuid().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const relationship = url.searchParams.get("relationship_type");
    const query = url.searchParams.get("q");

    let queryBuilder = supabase
      .from("team_people")
      .select("*, role:team_roles(id, name)")
      .eq("user_id", userId)
      .order("name", { ascending: true });

    if (status && status !== "all") {
      queryBuilder = queryBuilder.eq("status", status);
    } else {
      queryBuilder = queryBuilder.neq("status", "archived");
    }

    if (relationship && relationship !== "all") {
      queryBuilder = queryBuilder.eq("relationship_type", relationship);
    }

    if (query && query.trim()) {
      queryBuilder = queryBuilder.or(`name.ilike.%${query.trim()}%,role_title.ilike.%${query.trim()}%,company_team.ilike.%${query.trim()}%`);
    }

    const { data, error } = await queryBuilder;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    if (isMissingOptionalSchema(error)) return NextResponse.json({ data: [], schemaStatus: "unavailable", schemaDependency: "V12 Team Coordination schema" });
    return apiError(error, "People directory could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    const parsed = createSchema.parse(body);

    if (parsed.linked_contact_id) {
      const validContact = await validateForeignOwnership(supabase, userId, "contact", parsed.linked_contact_id);
      if (!validContact) {
        return NextResponse.json({ error: "Linked contact does not exist or does not belong to you." }, { status: 400 });
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
      .insert({
        user_id: userId,
        name: parsed.name,
        display_name: parsed.display_name || null,
        role_title: parsed.role_title || null,
        role_id: parsed.role_id || null,
        company_team: parsed.company_team || null,
        email: parsed.email || null,
        phone: parsed.phone || null,
        relationship_type: parsed.relationship_type,
        status: parsed.status,
        timezone: parsed.timezone || null,
        working_hours: parsed.working_hours || null,
        notes: parsed.notes || null,
        avatar_url: parsed.avatar_url || null,
        linked_contact_id: parsed.linked_contact_id || null,
        linked_user_id: parsed.linked_user_id || null,
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Person could not be created.");
  }
}
