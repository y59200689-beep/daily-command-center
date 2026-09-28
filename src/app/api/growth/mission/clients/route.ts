import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const clientSchema = z.object({ client_id: z.uuid() });

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const [clients, links] = await Promise.all([
      supabase.from("clients").select("id,name,company").eq("user_id", userId).is("deleted_at", null).order("name"),
      supabase.from("revenue_mission_clients").select("client_id").eq("user_id", userId),
    ]);
    if (clients.error) throw clients.error;
    if (links.error) throw links.error;
    return NextResponse.json({ clients: clients.data ?? [], linked_ids: (links.data ?? []).map(row => row.client_id) });
  } catch (error) { return apiError(error, "Mission clients could not be loaded."); }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const { client_id } = clientSchema.parse(await request.json());
    const client = await supabase.from("clients").select("id").eq("id", client_id).eq("user_id", userId).is("deleted_at", null).maybeSingle();
    if (client.error) throw client.error;
    if (!client.data) return NextResponse.json({ error: "Client not found." }, { status: 404 });
    const { error } = await supabase.from("revenue_mission_clients").insert({ user_id: userId, client_id });
    if (error) throw error;
    return NextResponse.json({ linked: true });
  } catch (error) { return apiError(error, "Client could not be linked to this mission."); }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const { client_id } = clientSchema.parse(await request.json());
    const { error } = await supabase.from("revenue_mission_clients").delete().eq("user_id", userId).eq("client_id", client_id);
    if (error) throw error;
    return NextResponse.json({ linked: false });
  } catch (error) { return apiError(error, "Client could not be unlinked from this mission."); }
}
