import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const versionSchema = z.object({
  change_summary: z.string().trim().min(1).max(1000),
  effective_date: z.string().default(() => new Date().toISOString().slice(0, 10)),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: sopId } = await context.params;
    const input = versionSchema.parse(await request.json());
    const { supabase, userId } = await requireUser();

    // Verify SOP exists and get current version
    const { data: sop, error: sopError } = await supabase
      .from("operational_sops")
      .select("id,current_version")
      .eq("id", sopId)
      .eq("user_id", userId)
      .maybeSingle();

    if (sopError) throw sopError;
    if (!sop) return NextResponse.json({ error: "SOP not found." }, { status: 404 });

    const nextVersion = (sop.current_version ?? 1) + 1;

    // Create new version
    const { data: version, error: versionError } = await supabase
      .from("sop_versions")
      .insert({
        user_id: userId,
        sop_id: sopId,
        version_number: nextVersion,
        change_summary: input.change_summary,
        effective_date: input.effective_date,
        status: "active",
      })
      .select("*")
      .single();

    if (versionError) throw versionError;

    // Update SOP current version
    await supabase
      .from("operational_sops")
      .update({ current_version: nextVersion, updated_at: new Date().toISOString() } as never)
      .eq("id", sopId)
      .eq("user_id", userId);

    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    return apiError(error, "SOP version could not be created.");
  }
}
