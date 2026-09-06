import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();
    const { data: project, error: projectError } = await supabase.from("projects").select("id,proposal_id,currency").eq("id", id).eq("user_id", userId).is("deleted_at", null).maybeSingle();
    if (projectError) throw projectError;
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    if (!project.proposal_id) return NextResponse.json({ error: "This project has no accepted proposal to import." }, { status: 409 });
    const { data: proposal, error: proposalError } = await supabase.from("proposals").select("id,status").eq("id", project.proposal_id).eq("user_id", userId).is("archived_at", null).maybeSingle();
    if (proposalError) throw proposalError;
    if (!proposal || proposal.status !== "accepted") return NextResponse.json({ error: "Only an accepted proposal can become project scope." }, { status: 409 });
    const [{ data: items, error: itemsError }, { data: existing, error: existingError }] = await Promise.all([
      supabase.from("proposal_items").select("id,service_id,title,description,quantity,total,estimated_hours").eq("proposal_id", proposal.id).eq("user_id", userId).order("position"),
      supabase.from("scope_items").select("proposal_item_id").eq("project_id", id).eq("user_id", userId).not("proposal_item_id", "is", null),
    ]);
    if (itemsError || existingError) throw itemsError ?? existingError;
    const existingIds = new Set((existing ?? []).map((item) => item.proposal_item_id));
    const missing = (items ?? []).filter((item) => !existingIds.has(item.id));
    if (missing.length) {
      const { error } = await supabase.from("scope_items").insert(missing.map((item) => ({
        user_id: userId, project_id: id, proposal_item_id: item.id, service_id: item.service_id, title: item.title,
        description: item.description, quantity: item.quantity, agreed_value: item.total, estimated_hours: item.estimated_hours,
      })) as never);
      if (error) throw error;
    }
    await supabase.from("action_audit_log").insert({ user_id: userId, actor: "user", action_type: "proposal_scope_imported", entity_type: "project", entity_id: id, summary: missing.length ? `Imported ${missing.length} accepted proposal line item${missing.length === 1 ? "" : "s"} into project scope.` : "Accepted proposal scope was already imported." } as never);
    return NextResponse.json({ imported: missing.length, alreadyImported: (items ?? []).length - missing.length });
  } catch (error) { return apiError(error, "Proposal scope could not be imported."); }
}
