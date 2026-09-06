import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { pricingHistory, trackedProjectSeconds } from "@/lib/business";
import { requireUser } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const { supabase, userId } = await requireUser();
    const { data: service, error: serviceError } = await supabase.from("services").select("*").eq("id", id).eq("user_id", userId).is("archived_at", null).maybeSingle();
    if (serviceError) throw serviceError; if (!service) return NextResponse.json({ error: "Service not found." }, { status: 404 });
    const { data: items, error: itemsError } = await supabase.from("proposal_items").select("id,proposal_id,title,total,estimated_hours,proposals(id,title,status,currency,client_id,updated_at)").eq("service_id", id).eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
    if (itemsError) throw itemsError;
    const accepted = (items ?? []).filter((item) => (item.proposals as { status?: string } | null)?.status === "accepted");
    const proposalIds = (items ?? []).map((item) => item.proposal_id); const projectRows = proposalIds.length ? await supabase.from("projects").select("id,name,status,proposal_id,updated_at").eq("user_id", userId).in("proposal_id", proposalIds).is("deleted_at", null) : { data: [], error: null };
    if (projectRows.error) throw projectRows.error;
    const serviceScope = await supabase.from("scope_items").select("id,project_id").eq("user_id", userId).eq("service_id", id).neq("status", "removed");
    if (serviceScope.error) throw serviceScope.error;
    const serviceProjectIds = [...new Set((serviceScope.data ?? []).map((item) => item.project_id))];
    const [tasks, focus] = serviceProjectIds.length ? await Promise.all([
      supabase.from("tasks").select("id,project_id,scope_item_id").eq("user_id", userId).in("project_id", serviceProjectIds).is("deleted_at", null),
      supabase.from("focus_sessions").select("id,project_id,task_id,duration_seconds").eq("user_id", userId).in("project_id", serviceProjectIds),
    ]) : [{ data: [], error: null }, { data: [], error: null }];
    if (tasks.error) throw tasks.error; if (focus.error) throw focus.error;
    const trackedByProject = new Map(serviceProjectIds.map((projectId) => [projectId, trackedProjectSeconds(projectId, focus.data ?? [], (tasks.data ?? []).filter((task) => task.project_id === projectId))]));
    const trackedByProposal = new Map((projectRows.data ?? []).map((project) => [project.proposal_id, trackedByProject.get(project.id) ?? 0]));
    const currencyGroups: Record<string, ReturnType<typeof pricingHistory>> = {};
    for (const currency of new Set((accepted).map((item) => String((item.proposals as { currency?: string } | null)?.currency ?? service.currency ?? "MAD")))) {
      const rows = accepted.filter((item) => String((item.proposals as { currency?: string } | null)?.currency ?? service.currency ?? "MAD") === currency).map((item) => ({ amount: item.total, trackedSeconds: trackedByProposal.get(item.proposal_id) || null, status: "accepted" }));
      currencyGroups[currency] = pricingHistory(rows);
    }
    return NextResponse.json({ service, proposalCount: (items ?? []).length, acceptedCount: accepted.length, winRate: (items ?? []).length ? accepted.length / (items ?? []).length : null, pricing: currencyGroups, recentProposals: (items ?? []).slice(0, 5).map((item) => ({ id: item.proposal_id, title: (item.proposals as { title?: string } | null)?.title ?? item.title, status: (item.proposals as { status?: string } | null)?.status, currency: (item.proposals as { currency?: string } | null)?.currency, total: item.total })), recentProjects: projectRows.data ?? [] });
  } catch (error) { return apiError(error, "Service performance could not be loaded."); }
}
