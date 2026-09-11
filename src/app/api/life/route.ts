import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { documentExpiryStatus, rankLifeSignals, type LifeSignal } from "@/lib/life";
import { requireUser } from "@/lib/supabase/server";

function isMissingLifeSchema(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return candidate.code === "PGRST205" || candidate.code === "42P01" || /personal_profiles|personal_documents|trips/i.test(candidate.message ?? "");
}

export async function GET() {
  try {
    const { supabase, userId } = await requireUser(); const today = new Date().toISOString().slice(0, 10);
    const [profile, trips, documents, renewals, admin, dates, routines, completions, fitness, targets, goals, visas] = await Promise.all([
      supabase.from("personal_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("trips").select("*").eq("user_id", userId).is("archived_at", null).not("status", "in", "(completed,canceled)").order("start_date").limit(12),
      supabase.from("personal_documents").select("*").eq("user_id", userId).is("archived_at", null).order("expires_at").limit(30),
      supabase.from("personal_renewals").select("*").eq("user_id", userId).not("status", "in", "(renewed,canceled)").order("due_date").limit(20),
      supabase.from("personal_admin_items").select("*").eq("user_id", userId).not("status", "in", "(completed,canceled)").order("due_date").limit(20),
      supabase.from("important_dates").select("*").eq("user_id", userId).order("date").limit(20),
      supabase.from("personal_routines").select("*").eq("user_id", userId).eq("active", true).order("created_at").limit(20),
      supabase.from("routine_completions").select("routine_id,completed_on").eq("user_id", userId).gte("completed_on", weekStart(today)),
      supabase.from("fitness_activities").select("id").eq("user_id", userId).gte("date", weekStart(today)).is("deleted_at", null),
      supabase.from("fitness_targets").select("id,target_value,target_type").eq("user_id", userId).eq("active", true).is("deleted_at", null),
      supabase.from("goals").select("id,title,period,progress,target_date").eq("user_id", userId).is("deleted_at", null).eq("status", "active").order("updated_at", { ascending: false }).limit(5),
      supabase.from("visa_applications").select("id,trip_id,country,status,appointment_date,visa_requirements(id,completed)").eq("user_id", userId).not("status", "in", "(approved,rejected,withdrawn)"),
    ]); const failed = [profile, trips, documents, renewals, admin, dates, routines, completions, fitness, targets, goals, visas].find((result) => result.error); if (failed?.error) throw failed.error;
    const signals: LifeSignal[] = [];
    for (const document of documents.data ?? []) { const status = documentExpiryStatus(document.expires_at, today); if (status === "expired" || status === "expires_soon") signals.push({ id: `document:${document.id}:${document.expires_at}`, kind: "document", title: status === "expired" ? "Document expired" : "Document expires soon", message: `${document.label}${document.expires_at ? ` · ${document.expires_at}` : ""}`, route: "/documents", priority: status === "expired" ? 92 : 68 }); }
    for (const renewal of renewals.data ?? []) if (renewal.due_date) { const days = daysUntil(renewal.due_date, today); if (days <= Number(renewal.lead_time_days ?? 30)) signals.push({ id: `renewal:${renewal.id}:${renewal.due_date}`, kind: "renewal", title: "Renewal needs attention", message: `${renewal.title} is due ${relativeDays(days)}.`, route: "/life?section=renewals", priority: days < 0 ? 88 : 58 }); }
    for (const item of admin.data ?? []) if (item.due_date && daysUntil(item.due_date, today) <= 0) signals.push({ id: `admin:${item.id}:${item.due_date}`, kind: "admin", title: "Personal admin is overdue", message: `${item.title} needed attention ${relativeDays(daysUntil(item.due_date, today))}.`, route: "/life?section=admin", priority: 76 });
    for (const visa of visas.data ?? []) { const incomplete = (visa.visa_requirements ?? []).filter((item) => !item.completed).length; const appointmentDays = visa.appointment_date ? daysUntil(visa.appointment_date, today) : null; if (visa.status === "additional_documents_requested") signals.push({ id: `visa-documents:${visa.id}`, kind: "visa", title: "Visa documents requested", message: `${visa.country} needs additional documents.`, route: visa.trip_id ? `/travel/${visa.trip_id}` : "/life", priority: 91 }); else if (appointmentDays !== null && appointmentDays >= 0 && appointmentDays <= 7 && incomplete) signals.push({ id: `visa-appointment:${visa.id}:${incomplete}`, kind: "visa", title: "Complete visa supporting documents", message: `Appointment ${relativeDays(appointmentDays)} and ${incomplete} item${incomplete === 1 ? " remains" : "s remain"}.`, route: visa.trip_id ? `/travel/${visa.trip_id}` : "/life", priority: 90 - appointmentDays }); }
    for (const date of dates.data ?? []) { const days = daysUntil(nextDateOccurrence(date.date, date.recurrence), today); if (days >= 0 && days <= Number(date.reminder_lead_days ?? 7)) signals.push({ id: `important-date:${date.id}:${date.date}`, kind: "important_date", title: "Important date approaching", message: `${date.title} is ${relativeDays(days)}.`, route: "/life?section=dates", priority: 52 + Math.max(0, 7 - days) }); }
    for (const trip of trips.data ?? []) { const days = trip.start_date ? daysUntil(trip.start_date, today) : null; if (days !== null && days <= 21 && days >= 0) signals.push({ id: `trip:${trip.id}:${trip.updated_at}`, kind: "trip", title: "Trip approaching", message: `${trip.title} starts ${relativeDays(days)}. Review preparation.`, route: `/travel/${trip.id}`, priority: Math.max(45, 80 - days) }); }
    const attention = rankLifeSignals(signals, 5); const nextAction = attention[0] ?? null;
    return NextResponse.json({ profile: profile.data, nextAction, attention, trips: trips.data ?? [], documents: documents.data ?? [], renewals: renewals.data ?? [], admin: admin.data ?? [], dates: dates.data ?? [], goals: goals.data ?? [], routines: routines.data ?? [], completedRoutineIds: (completions.data ?? []).map((item) => item.routine_id), fitness: { sessions: fitness.data?.length ?? 0, targets: targets.data ?? [] } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (isMissingLifeSchema(error)) {
      return NextResponse.json({
        schemaStatus: "unavailable",
        schemaDependency: "V7 life schema",
        profile: null, nextAction: null, attention: [], trips: [], documents: [], renewals: [], admin: [], dates: [], goals: [], routines: [], completedRoutineIds: [], fitness: { sessions: 0, targets: [] },
      }, { headers: { "Cache-Control": "private, no-store" } });
    }
    return apiError(error, "Life overview could not be loaded.");
  }
}

function weekStart(today: string) { const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7)); return date.toISOString().slice(0, 10); }
function daysUntil(date: string, today: string) { return Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000); }
function relativeDays(days: number) { return days === 0 ? "today" : days === 1 ? "tomorrow" : days === -1 ? "yesterday" : days > 1 ? `in ${days} days` : `${Math.abs(days)} days ago`; }
function nextDateOccurrence(date: string, recurrence: string | null) { if (recurrence !== "yearly") return date; const currentYear = new Date().getUTCFullYear(); const candidate = `${currentYear}-${date.slice(5)}`; return candidate >= new Date().toISOString().slice(0, 10) ? candidate : `${currentYear + 1}-${date.slice(5)}`; }
