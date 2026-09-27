"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast-provider";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Candidate = { id: string; name: string; reason: string; lastCompletedAt: string };
export function ReactivationCandidates({ clientId, presentation = "default", onMutationSuccess }: { clientId?: string; presentation?: "default" | "dashboard"; onMutationSuccess?: () => void }) {
  const [items, setItems] = useState<Candidate[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/business/reactivation", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setItems((body.candidates as Candidate[]).filter(item => !clientId || item.id === clientId));
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Reactivation candidates could not be loaded."); }
    finally { setLoading(false); }
  }, [clientId]);
  useDeferredEffect(useCallback(() => { void load(); }, [load]));
  const act = async (id: string, action: "create_opportunity" | "dismiss" | "snooze") => {
    setBusy(`${id}:${action}`); setError("");
    try {
      const response = await fetch("/api/business/reactivation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: id, action }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setItems(current => current.filter(item => item.id !== id));
      onMutationSuccess?.();
      showToast(action === "create_opportunity" ? "Reactivation opportunity created." : action === "snooze" ? "Reactivation reminder snoozed." : "Reactivation reminder dismissed.", "success");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "This reactivation action could not be saved."); }
    finally { setBusy(""); }
  };
  const cards = items.map(item => <article key={item.id} className={presentation === "dashboard" ? undefined : "signal-row"}><span><strong>{item.name}</strong><p>{item.reason}</p><small>Last completed work {new Date(item.lastCompletedAt).toLocaleDateString()}.</small></span><div className="integration-actions"><Button disabled={Boolean(busy)} onClick={() => void act(item.id, "create_opportunity")}>{busy === `${item.id}:create_opportunity` ? "Creating…" : "Create opportunity"}</Button><Button emphasis="ghost" disabled={Boolean(busy)} onClick={() => void act(item.id, "snooze")}>Snooze</Button><Button emphasis="ghost" disabled={Boolean(busy)} onClick={() => void act(item.id, "dismiss")}>Dismiss</Button></div></article>);
  if (presentation === "dashboard") return <section className="business-dashboard__panel business-dashboard__reactivation" aria-busy={loading}>
    <header className="business-dashboard__panel-header"><span className="business-dashboard__icon"><Users/></span><div><h2>Potential reactivation</h2><p>{items.length ? "A good moment to reconnect." : "A new conversation with a past client."}</p></div></header>
    {error ? <div className="business-dashboard__error" role="alert"><span>{error}</span><Button emphasis="outline" onClick={() => void load()}>Retry</Button></div> : loading ? <div className="business-dashboard__reactivation-empty" role="status"><span><Users size={19}/></span><strong>Checking past relationships…</strong></div> : items.length ? <div className="business-dashboard__reactivation-items">{cards}</div> : <div className="business-dashboard__reactivation-empty"><span><Users size={19}/></span><strong>No reactivation candidates</strong><p>When a past client is ready for a new conversation, you’ll find them here.</p><Link href="/clients">Explore your clients</Link></div>}
  </section>;
  return <section className="data-surface reactivation-candidates"><p className="eyebrow">Potential reactivation</p>{error ? <p className="field-error" role="alert">{error}</p> : null}{loading ? <p className="dataset-note" role="status">Checking past relationships…</p> : items.length ? cards : <p className="dataset-note">No past client currently needs a reactivation prompt.</p>}</section>;
}
