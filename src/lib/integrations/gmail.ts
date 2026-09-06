import type { SupabaseClient } from "@supabase/supabase-js";
import { validProviderToken } from "@/lib/integrations/tokens";

function base64Url(value: string) { return Buffer.from(value, "utf8").toString("base64url"); }

export async function sendApprovedGmailDraft(client: SupabaseClient, userId: string, approvalId: string, draft: { to: string; subject: string; body: string; threadId?: string }) {
  const { data: approval, error: approvalError } = await client.from("approval_items").select("*").eq("id", approvalId).eq("user_id", userId).eq("action_type", "send_email").in("status", ["pending", "approved"]).maybeSingle();
  if (approvalError) throw approvalError; if (!approval) throw new Error("This approval is no longer available.");
  if (approval.status === "executed") return approval;
  const token = await validProviderToken(client, userId, "gmail");
  const raw = [`To: ${draft.to}`, `Subject: ${draft.subject}`, "Content-Type: text/plain; charset=UTF-8", "", draft.body].join("\r\n");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw: base64Url(raw), ...(draft.threadId ? { threadId: draft.threadId } : {}) }) });
  if (!response.ok) throw new Error("Gmail could not send this draft. It remains available for review.");
  const sent = await response.json() as { id?: string; threadId?: string };
  const { data, error } = await client.from("approval_items").update({ status: "executed", executed_at: new Date().toISOString(), error: null, payload: { ...(approval.payload as Record<string, unknown>), gmail_message_id: sent.id ?? null, gmail_thread_id: sent.threadId ?? null } }).eq("id", approvalId).eq("user_id", userId).in("status", ["pending", "approved"]).select("*").single();
  if (error) throw error; await client.from("action_audit_log").insert({ user_id: userId, actor: "user", action_type: "gmail_sent", entity_type: approval.entity_type, entity_id: approval.entity_id, provider: "gmail", summary: `Sent approved email: ${draft.subject}`, status: "success" }); return data;
}
