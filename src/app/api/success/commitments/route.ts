import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");
    const direction = searchParams.get("direction");
    const status = searchParams.get("status");

    let query = supabase
      .from("client_commitments")
      .select("*, client:clients(id, name, company)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (clientId) query = query.eq("client_id", clientId);
    if (direction) query = query.eq("direction", direction);
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return apiError(error, "Commitments could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();

    const schema = z.object({
      client_id: z.string().uuid(),
      direction: z.enum(["we_owe_client", "client_owes_us"]),
      statement: z.string().min(1).max(500),
      due_at: z.string().nullable().optional(),
      status: z.enum(["open", "completed", "cancelled", "unclear"]).default("open"),
      source_entity_type: z.string().nullable().optional(),
      source_entity_id: z.string().uuid().nullable().optional(),
      notes: z.string().nullable().optional(),
    });

    const parsed = schema.parse(body);

    const clientCheck = await supabase
      .from("clients")
      .select("id")
      .eq("id", parsed.client_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (clientCheck.error) throw clientCheck.error;
    if (!clientCheck.data) {
      return NextResponse.json({ error: "Client not found or unowned." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("client_commitments")
      .insert({
        user_id: userId,
        ...parsed,
      } as never)
      .select("*, client:clients(id, name)")
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Commitment could not be created.");
  }
}
