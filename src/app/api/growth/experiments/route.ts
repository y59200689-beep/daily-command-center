import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const experimentSchema = z.object({
  name: z.string().trim().min(1).max(240),
  hypothesis: z.string().trim().min(1).max(2000),
  target_metric: z.string().trim().min(1).max(240),
  channel: z.string().trim().max(120).optional().nullable(),
  offer: z.string().trim().max(120).optional().nullable(),
  audience: z.string().trim().max(240).optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  budget: z.coerce.number().finite().nonnegative().optional().nullable(),
  currency: z.string().length(3).default("MAD"),
  status: z.enum(["idea", "planned", "running", "completed", "cancelled"]).default("idea"),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();

    const { data: experiments, error } = await supabase
      .from("growth_experiments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ experiments: experiments ?? [] });
  } catch (error) {
    return apiError(error, "Growth experiments could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const input = experimentSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    const { data, error } = await supabase
      .from("growth_experiments")
      .insert({
        user_id: userId,
        name: input.name,
        hypothesis: input.hypothesis,
        target_metric: input.target_metric,
        channel: input.channel,
        offer: input.offer,
        audience: input.audience,
        start_date: input.start_date ? input.start_date.slice(0, 10) : null,
        end_date: input.end_date ? input.end_date.slice(0, 10) : null,
        budget: input.budget,
        currency: input.currency,
        status: input.status,
        notes: input.notes,
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ experiment: data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Growth experiment could not be created.");
  }
}
