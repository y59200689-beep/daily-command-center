"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AttachmentSection } from "@/components/attachment-section";
import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Row = Record<string, unknown> & { id: string };
type Data = { item: Row; assets: Row[] };
const stages = ["idea", "brief", "copy", "designing", "review", "approved", "scheduled", "published"];

export function ContentWorkspace({ id }: { id: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [asset, setAsset] = useState({ asset_type: "link", label: "", url: "" });
  const { showToast } = useToast();
  const load = useCallback(async () => {
    try { const response = await fetch(`/api/content/${id}`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Content item could not be loaded."); }
  }, [id]);
  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  async function patchItem(values: Record<string, unknown>, message: string) {
    setBusy(true);
    const response = await fetch(`/api/entities/content/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    if (response.ok) { showToast(message); await load(); }
    else { const body = await response.json(); showToast(body.error ?? "Content could not be updated.", "error"); }
    setBusy(false);
  }
  async function move(status: string) { await patchItem({ status, published_at: status === "published" ? new Date().toISOString() : null }, `Content moved to ${status}.`); }
  async function approve(approval_status: string) { await patchItem({ approval_status }, `Approval marked ${approval_status.replace("_", " ")}.`); }
  async function addAsset(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    const response = await fetch(`/api/content/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...asset, url: asset.url || null }) });
    if (response.ok) { setOpen(false); setAsset({ asset_type: "link", label: "", url: "" }); showToast("Asset reference added."); await load(); }
    else { const body = await response.json(); setError(body.error); }
    setBusy(false);
  }

  if (error) return <div className="empty-state"><span>!</span><h2>Content unavailable</h2><p>{error}</p></div>;
  if (!data) return <div className="empty-state"><span>···</span><h2>Loading content</h2></div>;
  const item = data.item;
  const references = data.assets.filter((entry) => entry.asset_type !== "upload");
  return <div className="detail-page">
    <Link className="back-link" href="/content">← Back to content</Link>
    <header className="detail-header"><div><p className="eyebrow">{String(item.platform ?? "Content")} · {String(item.status)}</p><h1>{String(item.title)}</h1><p>{String(item.creative_brief ?? item.brief ?? "No creative brief yet.")}</p></div><Button emphasis="outline" onClick={() => setOpen(true)}>Add reference</Button></header>
    <div className="content-stage-strip" aria-label="Workflow stage">{stages.map((stage) => <button disabled={busy} className={item.status === stage ? "active" : ""} onClick={() => void move(stage)} key={stage}>{stage}</button>)}</div>
    <div className="detail-grid"><section><p className="eyebrow">Creative direction</p><h2>{String(item.creative_direction ?? item.hook ?? "Not defined yet")}</h2><div className="signal-row"><span><strong>Caption</strong>{String(item.caption ?? "No caption")}</span></div><div className="signal-row"><span><strong>Call to action</strong>{String(item.cta ?? "No CTA")}</span></div><div className="signal-row"><span><strong>Approval</strong>{String(item.approval_status)} · {String(item.approval_notes ?? "")}</span><span className="approval-actions"><button disabled={busy} onClick={() => void approve("approved")}>Approve</button><button disabled={busy} onClick={() => void approve("changes_requested")}>Request changes</button></span></div></section><aside><p className="eyebrow">References</p>{references.length ? references.map((entry) => entry.url ? <a className="signal-row" href={String(entry.url)} target="_blank" rel="noreferrer" key={entry.id}><span><strong>{String(entry.asset_type)}</strong>{String(entry.label)}</span></a> : <div className="signal-row" key={entry.id}><span><strong>{String(entry.asset_type)}</strong>{String(entry.label)}</span></div>) : <p className="dataset-note">No asset references yet.</p>}</aside></div>
    <AttachmentSection entityType="content" entityId={id} title="Content files"/>
    <Modal open={open} onClose={() => setOpen(false)} title="Add asset reference" description="Keep links and external references here. Upload private files in Content files."><form className="simple-form" onSubmit={addAsset} noValidate><label htmlFor="asset-type">Type</label><select id="asset-type" value={asset.asset_type} onChange={(event) => setAsset({ ...asset, asset_type: event.target.value })}>{["link", "reference", "drive", "copy"].map((value) => <option key={value}>{value}</option>)}</select><label htmlFor="asset-label">Label</label><input id="asset-label" required value={asset.label} onChange={(event) => setAsset({ ...asset, label: event.target.value })}/><label htmlFor="asset-url">URL</label><input id="asset-url" type="url" value={asset.url} onChange={(event) => setAsset({ ...asset, url: event.target.value })}/><div className="modal__actions"><Button emphasis="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button intent="brand" type="submit" disabled={busy}>{busy ? "Adding…" : "Add reference"}</Button></div></form></Modal>
  </div>;
}
