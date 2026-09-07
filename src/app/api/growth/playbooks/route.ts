import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const playbookSchema = z.object({
  name: z.string().trim().min(1).max(240),
  purpose: z.string().trim().max(1000).optional().nullable(),
  target_type: z.enum(["lead", "opportunity", "client"]),
  steps: z.array(z.object({
    day: z.number().int().min(0),
    title: z.string().trim().min(1).max(240),
    channel: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
  })).min(1).max(20),
  default_delays: z.array(z.number().int().min(0)).optional().default([]),
  suggested_channel: z.enum(["email", "whatsapp", "call", "meeting", "linkedin", "other"]).optional().nullable(),
  template_ref: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();

    const [playbooksRes, runsRes] = await Promise.all([
      supabase.from("sales_playbooks").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("playbook_runs").select("*,sales_playbooks(name)").eq("user_id", userId).order("started_at", { ascending: false }).limit(50),
    ]);

    if (playbooksRes.error) throw playbooksRes.error;
    if (runsRes.error) throw runsRes.error;

    return NextResponse.json({
      playbooks: playbooksRes.data ?? [],
      runs: runsRes.data ?? [],
    });
  } catch (error) {
    return apiError(error, "Sales playbooks could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const input = playbookSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    const { data, error } = await supabase
      .from("sales_playbooks")
      .insert({
        user_id: userId,
        name: input.name,
        purpose: input.purpose,
        target_type: input.target_type,
        steps: input.steps,
        default_delays: input.default_delays,
        suggested_channel: input.suggested_channel,
        template_ref: input.template_ref,
        status: "active",
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ playbook: data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Playbook could not be created.");
  }
}
