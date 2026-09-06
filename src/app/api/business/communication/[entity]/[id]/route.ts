import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const entitySchema = z.enum(["lead", "opportunity"]);

export async function GET(_: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  try {
    const { entity: rawEntity, id } = await params;
    const entity = entitySchema.parse(rawEntity); const recordId = z.uuid().parse(id);
    const { supabase, userId } = await requireUser();
    const table = entity === "lead" ? "leads" : "opportunities";
    const record = await supabase.from(table).select("id").eq("id", recordId).eq("user_id", userId).maybeSingle();
    if (record.error) throw record.error;
    if (!record.data) return NextResponse.json({ error: "Business record not found." }, { status: 404 });
    const column = entity === "lead" ? "linked_lead_id" : "linked_opportunity_id";
    const threads = await supabase.from("email_threads").select("id,subject,snippet,last_message_at,reply_state,provider_url").eq("user_id", userId).eq(column, recordId).order("last_message_at", { ascending: false }).limit(5);
    if (threads.error) throw threads.error;
    return NextResponse.json({ threads: threads.data ?? [] });
  } catch (error) { return apiError(error, "Business communication could not be loaded."); }
}
