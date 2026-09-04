"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/components/icons";
import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { AttachmentView } from "@/components/attachment-section";
import { attachmentEntityTypes, attachmentKind, formatAttachmentSize } from "@/lib/attachment-policy";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Filters = { entity: string; project: string; client: string; type: string; recent: string };
type Option = { id: string; name?: string; title?: string };

export function FilesPage({ initialFilters, initialAttachment = "" }: { initialFilters: Filters; initialAttachment?: string }) {
  const [filters, setFilters] = useState(initialFilters);
  const [files, setFiles] = useState<AttachmentView[]>([]);
  const [projects, setProjects] = useState<Option[]>([]);
  const [clients, setClients] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [attachment, setAttachment] = useState(initialAttachment);
  const [deleting, setDeleting] = useState<AttachmentView | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(page) });
      Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key === "entity" ? "entityType" : key, value); });
      if (attachment) params.set("attachment", attachment);
      router.replace(`/files?${params}`, { scroll: false });
      const response = await fetch(`/api/attachments?${params}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setFiles(body.attachments ?? []); setTotal(body.total ?? 0);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Files could not be loaded."); }
    finally { setLoading(false); }
  }, [attachment, filters, page, router]);
  useDeferredEffect(useCallback(() => { void load(); }, [load]));
  useDeferredEffect(useCallback(() => {
    void Promise.all([fetch("/api/entities/projects?pageSize=100", { cache: "no-store" }), fetch("/api/entities/clients?pageSize=100", { cache: "no-store" })]).then(async ([projectResponse, clientResponse]) => {
      const [projectBody, clientBody] = await Promise.all([projectResponse.json(), clientResponse.json()]);
      if (projectResponse.ok) setProjects(projectBody.records ?? []);
      if (clientResponse.ok) setClients(clientBody.records ?? []);
    });
  }, []));

  function change(key: keyof Filters, value: string) { setAttachment(""); setFilters((current) => ({ ...current, [key]: value })); setPage(1); }
  async function openFile(file: AttachmentView) {
    const target = window.open("about:blank", "_blank"); if (target) target.opener = null;
    try { if (!target) throw new Error("Your browser blocked the file window. Allow pop-ups and try again."); const response = await fetch(`/api/attachments/${file.id}`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error); target.location.replace(body.url); }
    catch (reason) { target?.close(); setError(reason instanceof Error ? reason.message : "File could not be opened."); }
  }
  async function deleteFile() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try { const response = await fetch(`/api/attachments/${deleting.id}`, { method: "DELETE" }); if (!response.ok) { const body = await response.json(); throw new Error(body.error); } setFiles((current) => current.filter((file) => file.id !== deleting.id)); setTotal((current) => Math.max(0, current - 1)); setDeleting(null); showToast("File deleted."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "File could not be deleted."); setDeleting(null); }
    finally { setDeleteBusy(false); }
  }

  return <div className="domain-page files-page">
    <header className="page-header"><div><p className="eyebrow">Workspace</p><h1>Files</h1><p>Private attachments across your command center, kept with the work they belong to.</p></div></header>
    <div className="file-filters" aria-label="File filters">
      <Filter label="Entity" value={filters.entity} onChange={(value) => change("entity", value)} options={attachmentEntityTypes.map((value) => [value, `${value[0].toUpperCase()}${value.slice(1)}s`])}/>
      <Filter label="Project" value={filters.project} onChange={(value) => change("project", value)} options={projects.map((item) => [item.id, String(item.name ?? item.title)])}/>
      <Filter label="Client" value={filters.client} onChange={(value) => change("client", value)} options={clients.map((item) => [item.id, String(item.name ?? item.title)])}/>
      <Filter label="File type" value={filters.type} onChange={(value) => change("type", value)} options={["image","pdf","document","spreadsheet","archive","text"].map((value) => [value, `${value[0].toUpperCase()}${value.slice(1)}`])}/>
      <Filter label="Recent" value={filters.recent} onChange={(value) => change("recent", value)} options={[["7","7 days"],["30","30 days"],["90","90 days"]].map(([value,label]) => [value,label])}/>
    </div>
    {error ? <div className="inline-error" role="alert"><p>{error}</p><Button emphasis="outline" onClick={() => void load()}>Try again</Button></div> : null}
    {loading ? <div className="empty-state" aria-live="polite"><span>···</span><h2>Loading files</h2></div> : files.length ? <div className="file-ledger"><div className="file-ledger__header"><span>File</span><span>Related to</span><span>Uploaded</span><span/></div>{files.map((file) => <div className="file-ledger__row" key={file.id}><button type="button" onClick={() => void openFile(file)}><span className="attachment-row__icon"><Icons.FileText size={16}/></span><span><strong>{file.file_name}</strong><small>{attachmentKind(file.mime_type, file.file_name)} · {formatAttachmentSize(Number(file.size_bytes))}</small></span></button><Link href={file.related?.href ?? "/files"}>{file.related?.title ?? file.entity_type}</Link><time dateTime={file.created_at}>{new Date(file.created_at).toLocaleDateString()}</time><button className="icon-button" type="button" aria-label={`Delete ${file.file_name}`} onClick={() => setDeleting(file)}><Icons.Trash2 size={15}/></button></div>)}</div> : <div className="empty-state"><span>∅</span><h2>No files attached yet</h2><p>Open a task, project, client, note, content item, decision, or invoice to add its first file.</p></div>}
    <div className="dataset-pagination"><p className="dataset-note">Showing {files.length ? (page - 1) * 50 + 1 : 0}–{Math.min(page * 50, total)} of {total}</p><div><Button emphasis="ghost" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button><Button emphasis="ghost" disabled={page * 50 >= total} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
    <Modal open={Boolean(deleting)} onClose={() => { if (!deleteBusy) setDeleting(null); }} title="Delete attachment" description={deleting ? `Delete “${deleting.file_name}” from its record and private storage? This cannot be undone.` : undefined}><div className="modal__actions"><Button emphasis="ghost" disabled={deleteBusy} onClick={() => setDeleting(null)}>Cancel</Button><Button emphasis="danger" disabled={deleteBusy} onClick={() => void deleteFile()}>{deleteBusy ? "Deleting…" : "Delete file"}</Button></div></Modal>
  </div>;
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">All</option>{options.map(([option, text]) => <option value={option} key={option}>{text}</option>)}</select></label>;
}
