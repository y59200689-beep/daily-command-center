import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const blank = (value: unknown) => typeof value === "string" && value.trim() === "" ? null : value;
const profileInput = z.object({
  home_country: z.preprocess(blank, z.string().trim().min(2).max(120).nullable().optional()),
  home_city: z.preprocess(blank, z.string().trim().min(1).max(120).nullable().optional()),
  default_currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  preferred_timezone: z.preprocess(blank, z.string().trim().max(120).nullable().optional()),
  emergency_contact_reference: z.preprocess(blank, z.string().trim().max(240).nullable().optional()),
  passport_country: z.preprocess(blank, z.string().trim().min(2).max(120).nullable().optional()),
}).strict();

export async function GET() {
  try { const { supabase, userId } = await requireUser(); const { data, error } = await supabase.from("personal_profiles").select("*").eq("user_id", userId).maybeSingle(); if (error) throw error; return NextResponse.json({ profile: data }, { headers: { "Cache-Control": "private, no-store" } }); } catch (error) { return apiError(error, "Personal context could not be loaded."); }
}

export async function PATCH(request: Request) {
  try { const input = profileInput.safeParse(await request.json()); if (!input.success) return NextResponse.json({ error: "Check your personal context and try again." }, { status: 422 }); const { supabase, userId } = await requireUser(); const { data, error } = await supabase.from("personal_profiles").upsert({ ...input.data, user_id: userId }, { onConflict: "user_id" }).select("*").single(); if (error) throw error; await supabase.from("action_audit_log").insert({ user_id: userId, actor: "user", action_type: "personal_profile_updated", entity_type: "personal_profile", entity_id: userId, summary: "Updated personal life context." } as never); return NextResponse.json({ profile: data }); } catch (error) { return apiError(error, "Personal context could not be saved."); }
}
