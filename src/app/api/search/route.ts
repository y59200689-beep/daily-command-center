import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (query.length < 2) return NextResponse.json({ data: [] });
    const [workspace, products, suppliers, orders, roadmap, incidents, support, githubWork, marketing, trips, segments, reservations, documents, visas, renewals, admin, dates, routines] = await Promise.all([
      supabase.rpc("search_workspace", { search_query: query, result_limit: 30 }),
      supabase.from("product_catalog_refs").select("id,name,sku").eq("user_id", userId).ilike("name", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("supplier_records").select("id,name,contact_reference").eq("user_id", userId).ilike("name", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("supplier_orders").select("id,reference,status").eq("user_id", userId).ilike("reference", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("product_roadmap_items").select("id,title,status").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("incidents").select("id,title,severity").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("support_cases").select("id,summary,category").eq("user_id", userId).ilike("summary", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("github_work_items").select("id,title,kind,state").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("marketing_attribution_records").select("id,channel,utm_campaign,currency").eq("user_id", userId).or(`channel.ilike.%${query.replaceAll("%", "\\%")}%,utm_campaign.ilike.%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("trips").select("id,title,destination_city").eq("user_id", userId).is("archived_at", null).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("trip_segments").select("id,title,type,trip_id").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("travel_reservations").select("id,name,type,trip_id").eq("user_id", userId).ilike("name", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("personal_documents").select("id,label,type").eq("user_id", userId).is("archived_at", null).ilike("label", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("visa_applications").select("id,country,status").eq("user_id", userId).ilike("country", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("personal_renewals").select("id,title,status").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("personal_admin_items").select("id,title,status").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("important_dates").select("id,title,date").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("personal_routines").select("id,title,category").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
    ]);
    const failed = [workspace, products, suppliers, orders, roadmap, incidents, support, githubWork, marketing, trips, segments, reservations, documents, visas, renewals, admin, dates, routines].find((result) => result.error);
    if (failed?.error) throw failed.error;
    const [planningPeriods, commitments, milestones, gates, scenarios, kTopics, kSources, kFindings, kBriefs, kCollections, kWatches, gPlaybooks, gExperiments, gTargets] = await Promise.all([
      supabase.from("planning_periods").select("id,title,status").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("strategic_commitments").select("id,title,status").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("strategic_milestones").select("id,title,status").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("decision_gates").select("id,title,status").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("strategic_scenarios").select("id,title,updated_at").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("research_topics").select("id,title,domain").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("knowledge_sources").select("id,title,source_type").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("research_findings").select("id,title,status").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("research_briefs").select("id,title,status").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("knowledge_collections").select("id,title,description").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("watch_entities").select("id,name,watch_type").eq("user_id", userId).ilike("name", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("sales_playbooks").select("id,name,target_type").eq("user_id", userId).ilike("name", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("growth_experiments").select("id,name,target_metric").eq("user_id", userId).ilike("name", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("sales_targets").select("id,metric_type,target_value,currency,period").eq("user_id", userId).limit(8),
    ]);
    const strategyFailure = [planningPeriods, commitments, milestones, gates, scenarios, kTopics, kSources, kFindings, kBriefs, kCollections, kWatches, gPlaybooks, gExperiments, gTargets].find((result) => result.error);
    if (strategyFailure?.error) throw strategyFailure.error;
    const growthRows = [
      ...(gPlaybooks.data ?? []).map((row) => ({ entity_type: "sales_playbook", entity_id: row.id, title: row.name, snippet: `${row.target_type} playbook` })),
      ...(gExperiments.data ?? []).map((row) => ({ entity_type: "growth_experiment", entity_id: row.id, title: row.name, snippet: `Experiment · ${row.target_metric}` })),
      ...(gTargets.data ?? []).map((row) => ({ entity_type: "sales_target", entity_id: row.id, title: row.metric_type.replace(/_/g, " "), snippet: `${row.target_value} ${row.currency} · ${row.period}` })),
    ];
    const knowledgeRows = [
      ...(kTopics.data ?? []).map((row) => ({ entity_type: "research_topic", entity_id: row.id, title: row.title, snippet: row.domain })),
      ...(kSources.data ?? []).map((row) => ({ entity_type: "knowledge_source", entity_id: row.id, title: row.title, snippet: row.source_type })),
      ...(kFindings.data ?? []).map((row) => ({ entity_type: "research_finding", entity_id: row.id, title: row.title, snippet: row.status })),
      ...(kBriefs.data ?? []).map((row) => ({ entity_type: "research_brief", entity_id: row.id, title: row.title, snippet: row.status })),
      ...(kCollections.data ?? []).map((row) => ({ entity_type: "knowledge_collection", entity_id: row.id, title: row.title, snippet: row.description ?? "Collection" })),
      ...(kWatches.data ?? []).map((row) => ({ entity_type: "watch_entity", entity_id: row.id, title: row.name, snippet: row.watch_type })),
    ];
    const strategyRows = [
      ...(planningPeriods.data ?? []).map((row) => ({ entity_type: "planning_period", entity_id: row.id, title: row.title, snippet: row.status })),
      ...(commitments.data ?? []).map((row) => ({ entity_type: "commitment", entity_id: row.id, title: row.title, snippet: row.status })),
      ...(milestones.data ?? []).map((row) => ({ entity_type: "milestone", entity_id: row.id, title: row.title, snippet: row.status })),
      ...(gates.data ?? []).map((row) => ({ entity_type: "decision_gate", entity_id: row.id, title: row.title, snippet: row.status })),
      ...(scenarios.data ?? []).map((row) => ({ entity_type: "scenario", entity_id: row.id, title: row.title, snippet: "Hypothetical planning" })),
    ];
    const founderRows = [
      ...(products.data ?? []).map((row) => ({ entity_type: "product", entity_id: row.id, title: row.name, snippet: row.sku ?? "Product" })),
      ...(suppliers.data ?? []).map((row) => ({ entity_type: "supplier", entity_id: row.id, title: row.name, snippet: row.contact_reference ?? "Supplier" })),
      ...(orders.data ?? []).map((row) => ({ entity_type: "supplier_order", entity_id: row.id, title: row.reference ?? "Supplier order", snippet: row.status })),
      ...(roadmap.data ?? []).map((row) => ({ entity_type: "roadmap_item", entity_id: row.id, title: row.title, snippet: row.status })),
      ...(incidents.data ?? []).map((row) => ({ entity_type: "incident", entity_id: row.id, title: row.title, snippet: row.severity })),
      ...(support.data ?? []).map((row) => ({ entity_type: "support_case", entity_id: row.id, title: row.summary, snippet: row.category })),
      ...(githubWork.data ?? []).map((row) => ({ entity_type: "github_work_item", entity_id: row.id, title: row.title, snippet: `${row.kind.replace("_", " ")} · ${row.state}` })),
      ...(marketing.data ?? []).map((row) => ({ entity_type: "campaign_performance", entity_id: row.id, title: row.utm_campaign ?? row.channel ?? "Tracked campaign", snippet: row.currency })),
      ...(trips.data ?? []).map((row) => ({ entity_type: "trip", entity_id: row.id, title: row.title, snippet: row.destination_city ?? "Trip" })),
      ...(segments.data ?? []).map((row) => ({ entity_type: "trip_segment", entity_id: row.id, title: row.title, snippet: row.type.replaceAll("_", " "), trip_id: row.trip_id })),
      ...(reservations.data ?? []).map((row) => ({ entity_type: "travel_reservation", entity_id: row.id, title: row.name, snippet: row.type.replaceAll("_", " "), trip_id: row.trip_id })),
      ...(documents.data ?? []).map((row) => ({ entity_type: "personal_document", entity_id: row.id, title: row.label, snippet: row.type.replaceAll("_", " ") })),
      ...(visas.data ?? []).map((row) => ({ entity_type: "visa", entity_id: row.id, title: `${row.country} visa`, snippet: row.status.replaceAll("_", " ") })),
      ...(renewals.data ?? []).map((row) => ({ entity_type: "renewal", entity_id: row.id, title: row.title, snippet: row.status.replaceAll("_", " ") })),
      ...(admin.data ?? []).map((row) => ({ entity_type: "admin", entity_id: row.id, title: row.title, snippet: row.status.replaceAll("_", " ") })),
      ...(dates.data ?? []).map((row) => ({ entity_type: "important_date", entity_id: row.id, title: row.title, snippet: row.date })),
      ...(routines.data ?? []).map((row) => ({ entity_type: "routine", entity_id: row.id, title: row.title, snippet: row.category ?? "Routine" })),
    ];
    return NextResponse.json({ data: [...(workspace.data ?? []), ...knowledgeRows, ...founderRows, ...strategyRows, ...growthRows].slice(0, 30) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "AUTH_REQUIRED" ? "Authentication required." : "Search is unavailable." }, { status: error instanceof Error && error.message === "AUTH_REQUIRED" ? 401 : 500 }); }
}
