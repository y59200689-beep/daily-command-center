import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { syncGoogleCalendar } from "@/lib/integrations/google-calendar";
import { syncProvider } from "@/lib/integrations/sync";
import { emitStrategyNotifications } from "@/lib/strategy-notifications";
import { emitGrowthNotifications } from "@/lib/notification-producers";
import { requireUser } from "@/lib/supabase/server";
import { notifyOnce } from "@/lib/v4-notifications";

const strategicTypes = new Set(["weekly_planning_reminder", "monthly_planning_reminder", "quarterly_planning_reminder", "milestone_risk_check", "blocked_commitment_check"]);
const growthTypes = new Set(["daily_sales_attention", "weekly_growth_review", "proposal_followup_review", "lead_reactivation_review", "client_expansion_review", "pipeline_hygiene", "experiment_review"]);
export async function POST(request: Request) { try {
  const input = z.object({ id: z.uuid() }).parse(await request.json()); const { supabase, userId } = await requireUser();
  const { data: automation, error } = await supabase.from("automations").select("*").eq("id", input.id).eq("user_id",userId).eq("enabled",true).maybeSingle(); if (error) throw error; if (!automation) return NextResponse.json({ error: "Automation is not enabled." }, { status: 404 });
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

    await supabase.from("automation_runs").update({ finished_at: new Date().toISOString(), result: "success", records_affected: affected }).eq("id", run.id).eq("user_id", userId);
    await supabase.from("automations").update({ last_run_at: new Date().toISOString(), last_status: "healthy", last_error: null }).eq("id", automation.id).eq("user_id", userId);
    await supabase.from("action_audit_log").insert({ user_id: userId, actor: "automation", action_type: "automation_ran", entity_type: "automation", entity_id: automation.id, summary: automation.name, status: "success" });
    return NextResponse.json({ run: { ...run, result: "success", records_affected: affected } });
  } catch (error) { await supabase.from("automation_runs").update({ finished_at: new Date().toISOString(), result: "failed", error: "Run failed safely; review the connection." }).eq("id", run.id).eq("user_id", userId); await supabase.from("automations").update({ last_status: "error", last_error: "Run failed safely; review the connection." }).eq("id", automation.id).eq("user_id", userId); throw error; }
} catch (error) { return apiError(error, "Automation could not run."); } }
