"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Thread = { id: string; subject: string | null; snippet: string | null; last_message_at: string | null; reply_state: string | null; provider_url: string | null };
export function BusinessCommunication({ entity, id }: { entity: "lead" | "opportunity"; id: string }) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const load = useCallback(async () => { const response = await fetch(`/api/business/communication/${entity}/${id}`, { cache: "no-store" }); if (response.ok) setThreads((await response.json()).threads); }, [entity, id]);
  useDeferredEffect(useCallback(() => { void load(); }, [load]));
  if (threads === null) return <section className="data-surface"><p className="eyebrow">Communication</p><p className="dataset-note">Loading linked communication…</p></section>;
  return <section className="data-surface"><p className="eyebrow">Communication</p>{threads.length ? <><p className="dataset-note">Last contact {threads[0].last_message_at ? new Date(threads[0].last_message_at).toLocaleDateString() : "not recorded"} · {threads[0].reply_state === "awaiting_user_reply" ? "Reply needed" : threads[0].reply_state ?? "No action detected"}</p>{threads.map((thread) => <a className="signal-row" href={thread.provider_url ?? "/communication"} key={thread.id}><span><strong>{thread.subject ?? "Email thread"}</strong>{thread.snippet ?? ""} · {thread.reply_state ?? "No action detected"}</span></a>)}</> : <><p className="dataset-note">No email threads linked yet.</p><Link className="button button--outline button--neutral" href="/communication">Find communication</Link></>}</section>;
}
