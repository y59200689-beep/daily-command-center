import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { identifyExpansionCandidates, identifyDormantClients, identifyLeadReactivations } from "@/lib/growth";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const today = new Date().toISOString().slice(0, 10);

    const [clientsRes, projectsRes, invoicesRes, servicesRes, leadsRes, oppsRes] = await Promise.all([
      supabase.from("clients").select("id,name,status,last_contact_at,updated_at").eq("user_id", userId).is("deleted_at", null),
      supabase.from("projects").select("id,client_id,name,status,updated_at").eq("user_id", userId).is("deleted_at", null),
      supabase.from("invoices").select("id,client_id,total_amount,currency,status,paid_at,updated_at").eq("user_id", userId).is("deleted_at", null),
      supabase.from("services").select("id,name").eq("user_id", userId).is("archived_at", null),
      supabase.from("leads").select("id,name,company,status,potential_value,currency,last_contact_at,notes").eq("user_id", userId).is("archived_at", null),
      supabase.from("opportunities").select("id,lead_id,lost_reason,stage").eq("user_id", userId).is("archived_at", null),
    ]);

    if (clientsRes.error) throw clientsRes.error;
    if (projectsRes.error) throw projectsRes.error;
    if (invoicesRes.error) throw invoicesRes.error;
    if (servicesRes.error) throw servicesRes.error;
    if (leadsRes.error) throw leadsRes.error;
    if (oppsRes.error) throw oppsRes.error;

    const clients = clientsRes.data ?? [];
    const projects = projectsRes.data ?? [];
    const invoices = invoicesRes.data ?? [];
    const services = servicesRes.data ?? [];
    const leads = leadsRes.data ?? [];
    const opps = oppsRes.data ?? [];

    const expansion = identifyExpansionCandidates(
      clients,
      projects,
      invoices,
      services.map((s) => ({ client_id: "", service_name: s.name })),
      today
    );

    const dormantClients = identifyDormantClients(clients, projects, invoices, today);
    const dormantLeads = identifyLeadReactivations(leads, opps, today);

    return NextResponse.json({
      expansion,
      dormantClients,
      dormantLeads,
    });
  } catch (error) {
    return apiError(error, "Expansion data could not be loaded.");
  }
}
