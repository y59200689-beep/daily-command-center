import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import {financialSearch} from '@/lib/financial-integration';

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
    // Workspace search is the canonical baseline. Newer domain modules are optional
    // so a missing versioned table must not take global search down with it.
    if (workspace.error) throw workspace.error;
    const [planningPeriods, commitments, milestones, gates, scenarios, kTopics, kSources, kFindings, kBriefs, kCollections, kWatches, gPlaybooks, gExperiments, gTargets, opSops, opProcesses, opRuns, opIncidents, opRunbooks, opSystems, opImprovements, tPeople, tRoles, tResps, tDels, tCommits, tEscs, csOutcomes, csRenewals, csRisks, csIssues, csCommitments, csCheckIns, csPlans, cDiscrepancies, cAudits, cAdjustments] = await Promise.all([
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
      supabase.from("operational_sops").select("id,title,category").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("process_templates").select("id,name,category").eq("user_id", userId).ilike("name", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("process_runs").select("id,title,status").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("quality_incidents").select("id,title,severity").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("operational_runbooks").select("id,title,severity").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("operational_systems").select("id,name,purpose").eq("user_id", userId).ilike("name", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("process_improvements").select("id,title,status").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("team_people").select("id,name,role_title").eq("user_id", userId).ilike("name", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("team_roles").select("id,name,responsibility_summary").eq("user_id", userId).ilike("name", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("team_responsibilities").select("id,name,criticality").eq("user_id", userId).ilike("name", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("team_delegations").select("id,title,status").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("team_commitments").select("id,statement,status").eq("user_id", userId).ilike("statement", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("team_escalations").select("id,reason,severity").eq("user_id", userId).ilike("reason", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("client_outcomes").select("id,client_id,title,status").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("client_renewals").select("id,client_id,renewal_date,status").eq("user_id", userId).ilike("renewal_date", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("client_risks").select("id,client_id,description,severity").eq("user_id", userId).ilike("description", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("client_issues").select("id,client_id,title,severity").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("client_commitments").select("id,client_id,statement,status").eq("user_id", userId).ilike("statement", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("client_check_ins").select("id,client_id,purpose,status").eq("user_id", userId).ilike("purpose", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      supabase.from("client_success_plans").select("id,client_id,title,period").eq("user_id", userId).ilike("title", `%${query.replaceAll("%", "\\%")}%`).limit(8),
      // V14 Commerce
      supabase.from("inventory_discrepancies").select("id,product_id,discrepancy_type,status").eq("user_id", userId).ilike("discrepancy_type", `%${query.replaceAll("%", "\\%")}%`).limit(6),
      supabase.from("inventory_audits").select("id,scope,status").eq("user_id", userId).ilike("scope", `%${query.replaceAll("%", "\\%")}%`).limit(6),
      supabase.from("inventory_adjustments").select("id,product_id,reason").eq("user_id", userId).ilike("reason", `%${query.replaceAll("%", "\\%")}%`).limit(6),
    ]);
    const teamRows = [
      ...(tPeople.data ?? []).map((row) => ({ entity_type: "team_person", entity_id: row.id, title: row.name, snippet: row.role_title ?? "Person" })),
      ...(tRoles.data ?? []).map((row) => ({ entity_type: "team_role", entity_id: row.id, title: row.name, snippet: "Role" })),
      ...(tResps.data ?? []).map((row) => ({ entity_type: "team_responsibility", entity_id: row.id, title: row.name, snippet: `Responsibility · ${row.criticality}` })),
      ...(tDels.data ?? []).map((row) => ({ entity_type: "team_delegation", entity_id: row.id, title: row.title, snippet: `Delegation · ${row.status}` })),
      ...(tCommits.data ?? []).map((row) => ({ entity_type: "team_commitment", entity_id: row.id, title: row.statement, snippet: `Commitment · ${row.status}` })),
      ...(tEscs.data ?? []).map((row) => ({ entity_type: "team_escalation", entity_id: row.id, title: row.reason, snippet: `Escalation · ${row.severity}` })),
    ];
    const operationsRows = [
      ...(opSops.data ?? []).map((row) => ({ entity_type: "operational_sop", entity_id: row.id, title: row.title, snippet: `SOP · ${row.category}` })),
      ...(opProcesses.data ?? []).map((row) => ({ entity_type: "process_template", entity_id: row.id, title: row.name, snippet: `Process · ${row.category}` })),
      ...(opRuns.data ?? []).map((row) => ({ entity_type: "process_run", entity_id: row.id, title: row.title, snippet: `Run · ${row.status}` })),
      ...(opIncidents.data ?? []).map((row) => ({ entity_type: "quality_incident", entity_id: row.id, title: row.title, snippet: `Incident · ${row.severity}` })),
      ...(opRunbooks.data ?? []).map((row) => ({ entity_type: "operational_runbook", entity_id: row.id, title: row.title, snippet: `Runbook · ${row.severity}` })),
      ...(opSystems.data ?? []).map((row) => ({ entity_type: "operational_system", entity_id: row.id, title: row.name, snippet: `System · ${row.purpose}` })),
      ...(opImprovements.data ?? []).map((row) => ({ entity_type: "process_improvement", entity_id: row.id, title: row.title, snippet: `Improvement · ${row.status}` })),
    ];
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
    const successRows = [
      ...(csOutcomes.data ?? []).map((row) => ({ entity_type: "client_outcome", entity_id: row.id, client_id: row.client_id, title: row.title, snippet: `Outcome · ${row.status}` })),
      ...(csRenewals.data ?? []).map((row) => ({ entity_type: "client_renewal", entity_id: row.id, client_id: row.client_id, title: `Renewal ${row.renewal_date}`, snippet: `Renewal · ${row.status}` })),
      ...(csRisks.data ?? []).map((row) => ({ entity_type: "client_risk", entity_id: row.id, client_id: row.client_id, title: row.description, snippet: `Risk · ${row.severity}` })),
      ...(csIssues.data ?? []).map((row) => ({ entity_type: "client_issue", entity_id: row.id, client_id: row.client_id, title: row.title, snippet: `Issue · ${row.severity}` })),
      ...(csCommitments.data ?? []).map((row) => ({ entity_type: "client_commitment", entity_id: row.id, client_id: row.client_id, title: row.statement, snippet: `Commitment · ${row.status}` })),
      ...(csCheckIns.data ?? []).map((row) => ({ entity_type: "client_check_in", entity_id: row.id, client_id: row.client_id, title: row.purpose, snippet: `Check-in · ${row.status}` })),
      ...(csPlans.data ?? []).map((row) => ({ entity_type: "client_success_plan", entity_id: row.id, client_id: row.client_id, title: row.title, snippet: `Success Plan · ${row.period}` })),
    ];
    const financialRows=await financialSearch(supabase,userId,query);
    const commerceRows = [
      ...(cDiscrepancies.data ?? []).map((row) => ({ entity_type: "inventory_discrepancy", entity_id: row.id, title: `Discrepancy · ${row.discrepancy_type}`, snippet: row.status })),
      ...(cAudits.data ?? []).map((row) => ({ entity_type: "inventory_audit", entity_id: row.id, title: `Audit · ${row.scope}`, snippet: row.status })),
      ...(cAdjustments.data ?? []).map((row) => ({ entity_type: "inventory_adjustment", entity_id: row.id, title: `Adjustment · ${row.reason}`, snippet: row.product_id })),
    ];
    return NextResponse.json({ data: [...financialRows,...(workspace.data ?? []), ...knowledgeRows, ...founderRows, ...strategyRows, ...growthRows, ...operationsRows, ...teamRows, ...successRows, ...commerceRows].slice(0, 30) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "AUTH_REQUIRED" ? "Authentication required." : "Search is unavailable." }, { status: error instanceof Error && error.message === "AUTH_REQUIRED" ? 401 : 500 }); }
}
