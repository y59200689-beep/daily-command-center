import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { rankNextOperationalMove, evaluateProcessHealth, evaluateSopReviewState } from "@/lib/operations";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const today = new Date().toISOString().slice(0, 10);

    const [runsRes, sopsRes, incidentsRes, blockersRes, processesRes, failuresRes, improvementsRes] = await Promise.all([
      supabase.from("process_runs").select("*,process_templates(name,criticality)").eq("user_id", userId).order("created_at", { ascending: false }).limit(40),
      supabase.from("operational_sops").select("*").eq("user_id", userId).neq("status", "archived").order("updated_at", { ascending: false }).limit(40),
      supabase.from("quality_incidents").select("*,process_templates(name),operational_sops(title)").eq("user_id", userId).neq("status", "resolved").order("detected_at", { ascending: false }).limit(20),
      supabase.from("operational_blockers").select("*,process_runs(title,priority)").eq("user_id", userId).is("resolved_at", null).order("blocked_since", { ascending: false }).limit(20),
      supabase.from("process_templates").select("*,operational_sops(title)").eq("user_id", userId).eq("status", "active").order("created_at", { ascending: false }),
      supabase.from("process_failures").select("*").eq("user_id", userId).order("detected_at", { ascending: false }).limit(20),
      supabase.from("process_improvements").select("*,process_templates(name)").eq("user_id", userId).in("status", ["idea", "reviewing", "approved", "testing"]).order("created_at", { ascending: false }).limit(10),
    ]);

    const runs = runsRes.data ?? [];
    const sops = sopsRes.data ?? [];
    const incidents = incidentsRes.data ?? [];
    const blockers = blockersRes.data ?? [];
    const processes = processesRes.data ?? [];
    const failures = failuresRes.data ?? [];
    const improvements = improvementsRes.data ?? [];

    const nextOperationalMove = rankNextOperationalMove(runs, sops, incidents, blockers, today);

    const dueToday = runs.filter(r => ["planned", "ready", "in_progress"].includes(r.status) && r.due_at && r.due_at.slice(0, 10) === today);
    const activeRuns = runs.filter(r => ["in_progress", "ready", "planned"].includes(r.status));
    const blockedOperations = blockers;
    const qualityAndFailures = {
      incidents,
      recentFailures: failures,
    };

    const sopsNeedingReview = sops.filter(s => {
      const state = evaluateSopReviewState(s, today);
      return state === "Overdue review" || state === "Review due" || state === "Review soon";
    });

    const recurringOperations = processes.filter(p => p.default_frequency !== null);

    const processHealthList = processes.map(proc => {
      const procRuns = runs.filter(r => r.process_template_id === proc.id);
      const procFailures = failures.filter(f => f.run_id && procRuns.some(pr => pr.id === f.run_id));
      const procIncidents = incidents.filter(i => i.process_template_id === proc.id);
      const health = evaluateProcessHealth(procRuns, procFailures, procIncidents, 3);
      return {
        process: proc,
        health,
      };
    });

    return NextResponse.json({
      nextOperationalMove,
      dueToday,
      activeRuns,
      blockedOperations,
      qualityAndFailures,
      sopsNeedingReview,
      recurringOperations,
      processHealthList,
      improvementOpportunities: improvements,
    });
  } catch (error) {
    return apiError(error, "Operations overview could not be loaded.");
  }
}
