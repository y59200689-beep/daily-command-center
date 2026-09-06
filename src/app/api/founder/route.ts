import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { commerceSummary, founderAttention, growthFunnel, inventoryRisk, productPerformance, supportSummary } from "@/lib/founder";
import { requireUser } from "@/lib/supabase/server";
import { deploymentSourceHealth } from "@/lib/founder-sources";

const createCompany = z.object({ name: z.string().trim().min(1).max(240), primaryProjectId: z.uuid().nullable().optional() });

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const company = await supabase.from("companies").select("*").eq("user_id", userId).eq("active", true).order("created_at").limit(1).maybeSingle();
    if (company.error) throw company.error;
    if (!company.data) { const projects = await supabase.from("projects").select("id,name").eq("user_id", userId).is("deleted_at", null).order("updated_at", { ascending: false }).limit(20); if (projects.error) throw projects.error; return NextResponse.json({ company: null, state: "not_configured", projects: projects.data ?? [] }); }
    const companyId = company.data.id;
    const [orders, items, products, inventory, deployments, incidents, support, roadmap, suppliers, funnelSnapshots, marketing, aiUsage, githubRepositories] = await Promise.all([
      supabase.from("commerce_orders").select("id,status,currency,total_amount,shipping_cost,payment_fee,marketing_cost,created_at").eq("user_id", userId).eq("company_id", companyId).order("created_at", { ascending: false }).limit(200),
      supabase.from("commerce_order_items").select("order_id,product_id,product_name,quantity,unit_price,unit_cost").eq("user_id", userId).eq("company_id", companyId).limit(500),
      supabase.from("product_catalog_refs").select("id,name,sku,currency,unit_cost").eq("user_id", userId).eq("company_id", companyId).eq("active", true).limit(50),
      supabase.from("inventory_snapshots").select("id,product_id,available_stock,reorder_level,captured_at").eq("user_id", userId).eq("company_id", companyId).order("captured_at", { ascending: false }).limit(200),
      supabase.from("deployment_records").select("id,status,environment,commit_message,completed_at").eq("user_id", userId).eq("company_id", companyId).order("completed_at", { ascending: false }).limit(10),
      supabase.from("incidents").select("id,title,severity,status,started_at").eq("user_id", userId).eq("company_id", companyId).neq("status", "resolved").order("started_at", { ascending: false }).limit(10),
      supabase.from("support_cases").select("id,category,status,created_at,resolved_at").eq("user_id", userId).eq("company_id", companyId).order("created_at", { ascending: false }).limit(200),
      supabase.from("product_roadmap_items").select("id,title,type,status,priority,horizon").eq("user_id", userId).eq("company_id", companyId).not("status", "in", "(shipped,paused)").order("updated_at", { ascending: false }).limit(12),
      supabase.from("supplier_records").select("id,name,lead_time_days,active").eq("user_id", userId).eq("company_id", companyId).eq("active", true).limit(20),
      supabase.from("company_funnel_snapshots").select("*").eq("user_id", userId).eq("company_id", companyId).order("period_end", { ascending: false }).limit(2),
      supabase.from("marketing_attribution_records").select("channel,currency,spend,attributed_revenue,orders_count,new_customers,campaign_id").eq("user_id", userId).eq("company_id", companyId).order("snapshot_date", { ascending: false }).limit(30),
      supabase.from("ai_usage_records").select("feature,model,input_tokens,output_tokens,estimated_cost,status,currency").eq("user_id", userId).eq("company_id", companyId).limit(500),
      supabase.from("external_references").select("id,title,url,external_updated_at,metadata,entity_id").eq("user_id", userId).eq("provider", "github").eq("entity_type", "repository").order("external_updated_at", { ascending: false }).limit(20),
    ]);
    const failed = [orders, items, products, inventory, deployments, incidents, support, roadmap, suppliers, funnelSnapshots, marketing, aiUsage, githubRepositories].find((result) => result.error);
    if (failed?.error) throw failed.error;
    const latestInventory = new Map<string, Record<string, unknown>>(); for (const row of inventory.data ?? []) if (!latestInventory.has(String(row.product_id))) latestInventory.set(String(row.product_id), row);
    const inventoryRows = (products.data ?? []).map((product) => { const snapshot = latestInventory.get(product.id); const risk = inventoryRisk(snapshot ?? {}, null); return { ...product, ...(snapshot ?? {}), ...risk }; });
    const supportMetrics = supportSummary(support.data ?? []);
    const attention = founderAttention({ incidents: (incidents.data ?? []).map((item) => ({ id: item.id, title: item.title, severity: item.severity })), deployments: (deployments.data ?? []).map((item) => ({ id: item.id, status: item.status, environment: item.environment })), inventory: inventoryRows.map((item) => ({ id: item.id, name: item.name, state: item.state })), supportOpen: supportMetrics.open });
    const funnel = growthFunnel(funnelSnapshots.data?.[0] ?? null); const marketingByCurrency = (marketing.data ?? []).reduce<Record<string, { spend: number; revenue: number; orders: number; customers: number }>>((result, row) => { const currency = String(row.currency ?? "MAD"); const target = result[currency] ??= { spend: 0, revenue: 0, orders: 0, customers: 0 }; target.spend += Number(row.spend ?? 0); target.revenue += Number(row.attributed_revenue ?? 0); target.orders += Number(row.orders_count ?? 0); target.customers += Number(row.new_customers ?? 0); return result; }, {}); const usage = aiUsage.data ?? []; const estimatedCost = usage.filter((row) => row.estimated_cost != null).reduce((sum, row) => sum + Number(row.estimated_cost), 0);
    const repositories = (githubRepositories.data ?? []).map((repository) => { const metadata = (repository.metadata ?? {}) as Record<string, unknown>; return { id: repository.id, name: repository.title, url: repository.url, updatedAt: repository.external_updated_at, openIssues: Number(metadata.open_issues_count ?? 0), openPullRequests: Number(metadata.open_pr_count ?? 0) }; });
    const development = { repositories, openIssues: repositories.reduce((sum, item) => sum + item.openIssues, 0), openPullRequests: repositories.reduce((sum, item) => sum + item.openPullRequests, 0), lastActivity: repositories[0]?.updatedAt ?? null };
    const latestDeployment = (deployments.data ?? []).find((item) => item.environment === "production") ?? null;
    const deploymentSource = deploymentSourceHealth({ connected: Boolean(latestDeployment), lastSuccessfulSync: latestDeployment?.completed_at ?? null, providerError: latestDeployment?.status === "failed" });
    return NextResponse.json({ company: company.data, commerce: commerceSummary(orders.data ?? []), funnel, products: productPerformance(items.data ?? []).slice(0, 8), inventory: inventoryRows.filter((item) => item.state !== "healthy" && item.state !== "unavailable").slice(0, 8), latestDeployment, deploymentSource, incidents: incidents.data ?? [], supportOpen: supportMetrics.open, support: supportMetrics, roadmap: roadmap.data ?? [], suppliers: suppliers.data ?? [], marketing: marketingByCurrency, development, aiUsage: { requests: usage.length, successes: usage.filter((row) => row.status === "success").length, failures: usage.filter((row) => row.status === "failed").length, inputTokens: usage.reduce((sum, row) => sum + Number(row.input_tokens ?? 0), 0), outputTokens: usage.reduce((sum, row) => sum + Number(row.output_tokens ?? 0), 0), estimatedCost, unknownCostRequests: usage.filter((row) => row.estimated_cost == null).length, topFeature: usage.reduce<Record<string, number>>((result, row) => { result[row.feature] = (result[row.feature] ?? 0) + 1; return result; }, {}) }, attention, nextAction: attention[0] ?? null });
  } catch (error) { return apiError(error, "Founder dashboard could not be loaded."); }
}

export async function POST(request: Request) {
  try {
    const input = createCompany.parse(await request.json()); const { supabase, userId } = await requireUser();
    if (input.primaryProjectId) { const project = await supabase.from("projects").select("id").eq("id", input.primaryProjectId).eq("user_id", userId).is("deleted_at", null).maybeSingle(); if (project.error) throw project.error; if (!project.data) return NextResponse.json({ error: "The selected project is not available." }, { status: 422 }); }
    const saved = await supabase.from("companies").insert({ user_id: userId, name: input.name, primary_project_id: input.primaryProjectId ?? null, industry: "e-commerce", country_code: "MA", currency: "MAD" }).select("*").single();
    if (saved.error) throw saved.error; if (input.primaryProjectId) { const updated = await supabase.from("projects").update({ company_id: saved.data.id } as never).eq("id", input.primaryProjectId).eq("user_id", userId); if (updated.error) throw updated.error; }
    return NextResponse.json({ company: saved.data }, { status: 201 });
  } catch (error) { return apiError(error, "Company could not be created."); }
}
