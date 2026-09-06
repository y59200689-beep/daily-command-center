import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { normalizeParticipants } from "@/lib/v4";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const [threads, followups, waiting, invoices, clients, projects, content, contacts, leads, opportunities] = await Promise.all([
      supabase.from("email_threads").select("*,clients(name),projects(name)").eq("user_id", userId).order("last_message_at", { ascending: false }).limit(30),
      supabase.from("followups").select("*,clients(name),projects(name)").eq("user_id", userId).eq("status", "open").order("due_at").limit(20),
      supabase.from("waiting_items").select("*,clients(name),projects(name)").eq("user_id", userId).eq("status", "waiting").limit(20),
      supabase.from("invoices").select("*,clients(name)").eq("user_id", userId).in("status", ["sent", "partial", "overdue"]).lt("due_date", new Date().toISOString().slice(0, 10)).is("deleted_at", null).limit(20),
      supabase.from("clients").select("id,name,email").eq("user_id", userId).is("deleted_at", null),
      supabase.from("projects").select("id,name").eq("user_id", userId).is("deleted_at", null),
      supabase.from("content_items").select("id,title").eq("user_id", userId).is("deleted_at", null),
      supabase.from("client_contacts").select("client_id,email").eq("user_id", userId).not("email", "is", null),
      supabase.from("leads").select("id,name,email,company").eq("user_id", userId).is("archived_at", null),
      supabase.from("opportunities").select("id,title,lead_id,client_id,stage").eq("user_id", userId).is("archived_at", null),
    ]);
    for (const result of [threads, followups, waiting, invoices, clients, projects, content, contacts, leads, opportunities]) if (result.error) throw result.error;
    const clientEmails = new Map((clients.data ?? []).map((client) => [client.id, normalizeParticipants([String(client.email ?? ""), ...(contacts.data ?? []).filter((contact) => contact.client_id === client.id).map((contact) => String(contact.email ?? ""))]) ]));
    const enriched = (threads.data ?? []).map((thread) => {
      const participants = normalizeParticipants((thread.participants ?? []) as string[]);
      const matches = (clients.data ?? []).filter((client) => clientEmails.get(client.id)?.some((email) => participants.includes(email)));
      const leadMatches = (leads.data ?? []).filter((lead) => lead.email && participants.includes(normalizeParticipants([lead.email])[0] ?? ""));
      const suggestion = matches.length === 1 ? { id: matches[0].id, name: matches[0].name, reason: "Email address matches a known client contact." } : leadMatches.length === 1 ? { id: leadMatches[0].id, name: leadMatches[0].name, reason: "Email address exactly matches this lead." } : null;
      return { ...thread, suggested_client: matches.length === 1 ? suggestion : null, suggested_lead: leadMatches.length === 1 ? suggestion : null, multiple_client_matches: matches.length > 1, multiple_lead_matches: leadMatches.length > 1 };
    });
    return NextResponse.json({ threads: enriched, followups: followups.data ?? [], waiting: waiting.data ?? [], overdueInvoices: invoices.data ?? [], selectors: { clients: clients.data ?? [], projects: projects.data ?? [], invoices: invoices.data ?? [], content: content.data ?? [], leads: leads.data ?? [], opportunities: opportunities.data ?? [] } });
  } catch (error) { return apiError(error, "Communication could not be loaded."); }
}
