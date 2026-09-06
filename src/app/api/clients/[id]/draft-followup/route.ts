import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { normalizeParticipants } from "@/lib/v4";
import { requireUser } from "@/lib/supabase/server";

const input = z.object({ recipient: z.email().optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clientId = z.uuid().parse((await params).id);
    const requested = input.parse(await request.json());
    const { supabase, userId } = await requireUser();
    const [{ data: client, error: clientError }, { data: contacts, error: contactsError }, { data: threads, error: threadsError }] = await Promise.all([
      supabase.from("clients").select("id,name,email").eq("id", clientId).eq("user_id", userId).is("deleted_at", null).maybeSingle(),
      supabase.from("client_contacts").select("email").eq("client_id", clientId).eq("user_id", userId).not("email", "is", null),
      supabase.from("email_threads").select("id,provider_thread_id,subject,snippet,participants,linked_project_id,last_message_at").eq("user_id", userId).eq("linked_client_id", clientId).order("last_message_at", { ascending: false }).limit(1),
    ]);
    if (clientError || contactsError || threadsError) throw clientError ?? contactsError ?? threadsError;
    if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });
    const latest = threads?.[0] ?? null;
    const candidates = normalizeParticipants([String(client.email ?? ""), ...(contacts ?? []).map((contact) => String(contact.email ?? "")), ...((latest?.participants as string[] | null) ?? [])]);
    const recipient = requested.recipient?.toLowerCase();
    if (!recipient && candidates.length !== 1) return NextResponse.json({ error: candidates.length ? "Choose recipient" : "No verified email address found for this client.", recipients: candidates }, { status: 422 });
    if (recipient && !candidates.includes(recipient)) return NextResponse.json({ error: "Choose a verified recipient for this client.", recipients: candidates }, { status: 422 });
    const to = recipient ?? candidates[0];
    const inThread = Boolean(latest?.provider_thread_id);
    const subject = inThread ? `Re: ${latest?.subject ?? client.name}` : `Follow-up — ${client.name}`;
    const context = latest?.snippet ? ` regarding ${latest.snippet.slice(0, 220)}` : "";
    const body = `Hi,\n\nI wanted to follow up${context}. Please let me know if there is anything you need from me.\n\nBest,`;
    const { data: approval, error } = await supabase.from("approval_items").insert({ user_id: userId, action_type: "send_email", entity_type: "client", entity_id: clientId, title: `Follow up: ${client.name}`, summary: inThread ? `Replying in thread: ${latest?.subject ?? "Latest conversation"}` : "New email", payload: { to, subject, body, ...(inThread ? { threadId: latest?.provider_thread_id } : {}) }, risk_level: "high" }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ approval, replyingInThread: inThread }, { status: 201 });
  } catch (error) { return apiError(error, "A follow-up draft could not be prepared."); }
}
