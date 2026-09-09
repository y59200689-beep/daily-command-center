import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { syncGoogleCalendar } from "@/lib/integrations/google-calendar";
import { syncProvider } from "@/lib/integrations/sync";
import { emitStrategyNotifications } from "@/lib/strategy-notifications";
import { emitGrowthNotifications, emitOperationsNotifications, emitTeamNotifications, emitCustomerSuccessNotifications, emitCommerceNotifications } from "@/lib/notification-producers";
import { requireUser } from "@/lib/supabase/server";
import { notifyOnce } from "@/lib/v4-notifications";
import { financialAutomationTypes,runFinancialAutomation } from '@/lib/financial-notifications';

const strategicTypes = new Set(["weekly_planning_reminder", "monthly_planning_reminder", "quarterly_planning_reminder", "milestone_risk_check", "blocked_commitment_check"]);
const growthTypes = new Set(["daily_sales_attention", "weekly_growth_review", "proposal_followup_review", "lead_reactivation_review", "client_expansion_review", "pipeline_hygiene", "experiment_review"]);
const operationsTypes = new Set(["daily_operations_review", "weekly_operations_review", "sop_review_check", "recurring_process_check", "blocked_runs_review", "quality_review", "process_health_review"]);
const teamTypes = new Set(["daily_delegation_review", "weekly_team_review", "waiting_on_team_review", "waiting_on_me_review", "ownership_gap_review", "team_capacity_review", "team_handoff_review", "backup_coverage_review"]);
const successTypes = new Set(["daily_client_success_review", "weekly_retention_review", "upcoming_renewal_check", "client_risk_audit", "unfulfilled_commitment_check", "stale_client_touchpoint_check", "critical_client_issue_alert", "client_waiting_state_review"]);
const commerceTypes = new Set(["daily_inventory_review", "weekly_commerce_review", "replenishment_review", "supplier_order_review", "supplier_performance_review", "slow_stock_review", "cost_data_review", "inventory_audit_review"]);
export async function POST(request: Request) { try {
  const input = z.object({ id: z.uuid() }).parse(await request.json()); const { supabase, userId } = await requireUser();
  const { data: automation, error } = await supabase.from("automations").select("*").eq("id", input.id).eq("user_id",userId).eq("enabled",true).maybeSingle(); if (error) throw error; if (!automation) return NextResponse.json({ error: "Automation is not enabled." }, { status: 404 });
  if(financialAutomationTypes.some(type=>type===automation.type))return NextResponse.json(await runFinancialAutomation(supabase,userId,automation.id,'manual:'+new Date().toISOString().slice(0,16)));
  const { data: run, error: runError } = await supabase.from("automation_runs").insert({ user_id: userId, automation_id: automation.id }).select("*").single(); if (runError) throw runError;
  let affected = 0;
  try {
    if (automation.type === "calendar_sync") { const result = await syncGoogleCalendar(supabase, userId); affected = result.imported + result.pushed; }
    if (["strava_sync", "github_sync"].includes(automation.type)) { const result = await syncProvider(supabase, userId, automation.type === "strava_sync" ? "strava" : "github"); affected = result.affected; }
    if (automation.type === "overdue_invoice_alert") { const { count, error: countError } = await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("user_id", userId).lt("due_date", new Date().toISOString().slice(0, 10)).in("status", ["sent", "partial"]); if (countError) throw countError; affected = count ?? 0; if (affected) await notifyOnce(supabase, userId, { type: "finance", title: `${affected} overdue invoice${affected === 1 ? "" : "s"} need attention` }); }
    if (strategicTypes.has(String(automation.type))) {
      const result = await emitStrategyNotifications(supabase, userId); affected = result.affected;
      const route = automation.type === "weekly_planning_reminder" ? "/plan/week" : automation.type === "monthly_planning_reminder" ? "/plan/month" : automation.type === "quarterly_planning_reminder" ? "/plan/quarter" : "/control-tower";
      if (automation.type.endsWith("planning_reminder")) await notifyOnce(supabase, userId, { type: "automations", title: "Planning reminder", body: `Prepare your next strategic planning period.`, entityType: automation.type === "weekly_planning_reminder" ? "strategy_week_plan" : automation.type === "monthly_planning_reminder" ? "strategy_month_plan" : "strategy_quarter_plan", severity: "attention", dedupeKey: `strategy:planning-reminder:${automation.type}:${new Date().toISOString().slice(0, 10)}`, metadata: { route }, cooldownHours: 120 });
    }
    if (growthTypes.has(String(automation.type))) {
      await emitGrowthNotifications(supabase, userId);
      const { count } = await supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("user_id", userId).is("archived_at", null).not("stage", "in", '("won","lost")');
      affected = count ?? 0;
      await notifyOnce(supabase, userId, {
        type: "clients",
        title: automation.name,
        body: "Growth review surfaced active sales items needing your attention.",
        entityType: "growth",
        severity: "attention",
        dedupeKey: `growth:automation:${automation.type}:${new Date().toISOString().slice(0, 10)}`,
        cooldownHours: 24,
      });
    }
    if (operationsTypes.has(String(automation.type))) {
      await emitOperationsNotifications(supabase, userId);
      const { count } = await supabase.from("process_runs").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", ["planned", "ready", "in_progress", "blocked"]);
      affected = count ?? 0;
      await notifyOnce(supabase, userId, {
        type: "automations",
        title: automation.name,
        body: "Operations review surfaced active operational items needing your attention.",
        entityType: "process_run",
        severity: "attention",
        dedupeKey: `operations:automation:${automation.type}:${new Date().toISOString().slice(0, 10)}`,
        cooldownHours: 24,
      });
    }
    if (teamTypes.has(String(automation.type))) {
      await emitTeamNotifications(supabase, userId);
      const { count } = await supabase.from("team_delegations").select("id", { count: "exact", head: true }).eq("user_id", userId).not("status", "in", "(completed,cancelled)");
      affected = count ?? 0;
      await notifyOnce(supabase, userId, {
        type: "automations",
        title: automation.name,
        body: "Team coordination review surfaced active delegations or gaps needing your attention.",
        entityType: "team_delegation",
        severity: "attention",
        dedupeKey: `team:automation:${automation.type}:${new Date().toISOString().slice(0, 10)}`,
        cooldownHours: 24,
      });
    }
    if (successTypes.has(String(automation.type))) {
      await emitCustomerSuccessNotifications(supabase, userId);
      const { count } = await supabase.from("client_risks").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", ["open", "mitigating", "monitoring"]);
      affected = count ?? 0;
      await notifyOnce(supabase, userId, {
        type: "clients",
        title: automation.name,
        body: "Customer success review surfaced client risks, renewals, or commitments needing your attention.",
        entityType: "client_risk",
        severity: "attention",
        dedupeKey: `success:automation:${automation.type}:${new Date().toISOString().slice(0, 10)}`,
        cooldownHours: 24,
      });
    }
    if (commerceTypes.has(String(automation.type))) {
      await emitCommerceNotifications(supabase, userId);
      const { count } = await supabase.from("product_catalog_refs").select("id", { count: "exact", head: true }).eq("user_id", userId);
      affected = count ?? 0;
      await notifyOnce(supabase, userId, {
        type: "automations",
        title: automation.name,
        body: "Commerce review surfaced inventory, supplier, or purchasing items needing your attention.",
        entityType: "product_catalog_ref",
        severity: "attention",
        dedupeKey: `commerce:automation:${automation.type}:${new Date().toISOString().slice(0, 10)}`,
        cooldownHours: 24,
      });
    }

    await supabase.from("automation_runs").update({ finished_at: new Date().toISOString(), result: "success", records_affected: affected }).eq("id", run.id).eq("user_id", userId);
    await supabase.from("automations").update({ last_run_at: new Date().toISOString(), last_status: "healthy", last_error: null }).eq("id", automation.id).eq("user_id", userId);
    await supabase.from("action_audit_log").insert({ user_id: userId, actor: "automation", action_type: "automation_ran", entity_type: "automation", entity_id: automation.id, summary: automation.name, status: "success" });
    return NextResponse.json({ run: { ...run, result: "success", records_affected: affected } });
  } catch (error) { await supabase.from("automation_runs").update({ finished_at: new Date().toISOString(), result: "failed", error: "Run failed safely; review the connection." }).eq("id", run.id).eq("user_id", userId); await supabase.from("automations").update({ last_status: "error", last_error: "Run failed safely; review the connection." }).eq("id", automation.id).eq("user_id", userId); throw error; }
} catch (error) { return apiError(error, "Automation could not run."); } }
