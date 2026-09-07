import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { capacityState } from "@/lib/strategy";
import { rankDecisionGates, slippageSignals } from "@/lib/strategy-extended";
import { requireUser } from "@/lib/supabase/server";

const duration = z.enum(["month", "quarter"]);
export async function GET(request: Request) { try {
  const type = duration.parse(new URL(request.url).searchParams.get("type"));
  const { supabase, userId } = await requireUser();
  const days = type === "month" ? 30 : 90;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const [commitments, milestones, gates, goals, events] = await Promise.all([
    supabase.from("strategic_commitments").select("id,title,status,target_date,updated_at").eq("user_id", userId),
    supabase.from("strategic_milestones").select("id,title,status,milestone_date,updated_at").eq("user_id", userId),
    supabase.from("decision_gates").select("id,title,status,due_date,commitment_id,milestone_id").eq("user_id", userId),
    supabase.from("goals").select("id,title,progress,target_date,updated_at").eq("user_id", userId).eq("status", "active").is("deleted_at", null),
    supabase.from("calendar_events").select("starts_at,ends_at").eq("user_id", userId).gte("starts_at", since).is("deleted_at", null),
  ]);
  const failure = [commitments, milestones, gates, goals, events].find((result) => result.error); if (failure?.error) throw failure.error;
  const open = (commitments.data ?? []).filter((row) => !["completed", "dropped"].includes(row.status));
  const gateRows = (gates.data ?? []).map((gate) => ({ id: gate.id, title: gate.title, status: gate.status, dueDate: gate.due_date, blockedCount: [gate.commitment_id, gate.milestone_id].filter(Boolean).length, commitmentPriority: open.find((item) => item.id === gate.commitment_id)?.status === "at_risk" ? 5 : 3 }));
  const goalRows = (goals.data ?? []).map((goal) => ({ id: goal.id, title: goal.title, progress: Number(goal.progress ?? 0), health: (Date.parse(goal.updated_at) < Date.now() - 21 * 86400000 ? "stalled" : "on_track") as "stalled" | "on_track", reason: "Derived from recorded goal activity.", hasAction: true, nextMilestone: null }));
  const meetingHours = (events.data ?? []).reduce((sum, row) => sum + (Date.parse(row.ends_at) - Date.parse(row.starts_at)) / 3600000, 0);
  const review = { type, commitments: { planned: open.length, completed: (commitments.data ?? []).filter((row) => row.status === "completed" && row.updated_at >= since).length, dropped: (commitments.data ?? []).filter((row) => row.status === "dropped" && row.updated_at >= since).length, carriedForward: open.filter((row) => row.updated_at < since).length }, milestones: { reached: (milestones.data ?? []).filter((row) => row.status === "reached" && row.updated_at >= since).length, missed: (milestones.data ?? []).filter((row) => row.status === "missed" && row.updated_at >= since).length }, capacity: capacityState({ commitments: open.length, deadlines: open.filter((row) => row.target_date && row.target_date <= today).length, meetingHours, availableHours: type === "month" ? 80 : 240 }), decisions: rankDecisionGates(gateRows, today).slice(0, 5), slippage: slippageSignals({ commitments: (commitments.data ?? []).map((row) => ({ id: row.id, title: row.title, status: row.status, targetDate: row.target_date, updatedAt: row.updated_at })), milestones: (milestones.data ?? []).map((row) => ({ id: row.id, title: row.title, status: row.status, milestoneDate: row.milestone_date, updatedAt: row.updated_at })), gates: gateRows, goals: goalRows }, today) };
  return NextResponse.json({ review }, { headers: { "Cache-Control": "private, no-store" } });
} catch (error) { return apiError(error, "Strategic review could not be loaded."); } }
