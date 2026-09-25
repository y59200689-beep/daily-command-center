"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/components/icons";
import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StyledSelect } from "@/components/ui/styled-select";
import type { AttachmentView } from "@/components/attachment-section";
import { ATTACHMENT_ACCEPT, attachmentEntityTypes, attachmentKind, formatAttachmentSize, validateAttachmentMetadata } from "@/lib/attachment-policy";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import "./files-page.css";

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
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadEntity, setUploadEntity] = useState("project");
  const [uploadRecord, setUploadRecord] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const selected = files.find(file => file.id === attachment) ?? null;
  const visible = useMemo(() => files.filter(file => `${file.file_name} ${file.description ?? ""} ${file.related?.title ?? ""}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => sort === "name" ? a.file_name.localeCompare(b.file_name) : sort === "size" ? Number(b.size_bytes)-Number(a.size_bytes) : new Date(b.created_at).getTime()-new Date(a.created_at).getTime()), [files, query, sort]);
  const [now] = useState(() => Date.now());
  const recentCount = files.filter(file => new Date(file.created_at).getTime() >= now-7*86400000).length;
  const linkedCount = files.filter(file => Boolean(file.related?.title)).length;
  const storageBytes = files.reduce((sum,file)=>sum+Number(file.size_bytes),0);
  const router = useRouter();
  const { showToast } = useToast();
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(page) });
      Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key === "entity" ? "entityType" : key, value); });
      router.replace(`/files?${params}`, { scroll: false });
      const response = await fetch(`/api/attachments?${params}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setFiles(body.attachments ?? []); setTotal(body.total ?? 0);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Files could not be loaded."); }
    finally { setLoading(false); }
  }, [filters, page, router]);
  useDeferredEffect(useCallback(() => { void load(); }, [load]));
  useDeferredEffect(useCallback(() => {
    void Promise.all([fetch("/api/entities/projects?pageSize=100", { cache: "no-store" }), fetch("/api/entities/clients?pageSize=100", { cache: "no-store" })]).then(async ([projectResponse, clientResponse]) => {
      const [projectBody, clientBody] = await Promise.all([projectResponse.json(), clientResponse.json()]);
      if (projectResponse.ok) setProjects(projectBody.records ?? []);
      if (clientResponse.ok) setClients(clientBody.records ?? []);
    });
  }, []));

  function change(key: keyof Filters, value: string) { setAttachment(""); setFilters((current) => ({ ...current, [key]: value })); setPage(1); }
  async function selectFile(file: AttachmentView) {
    setAttachment(file.id); setPreviewUrl("");
    if (!file.mime_type?.startsWith("image/")) return;
    try { const response = await fetch(`/api/attachments/${file.id}`, { cache: "no-store" }); const body = await response.json(); if (response.ok) setPreviewUrl(body.url ?? ""); } catch {}
  }
  async function uploadFile(file: File) {
    const validation = validateAttachmentMetadata(file);
    if (validation) { setError(validation); return; }
    if (!uploadRecord) { setError("Choose a project or client for this file."); return; }
    setUploading(true); setError("");
    try { const form = new FormData(); form.set("entityType", uploadEntity); form.set("entityId", uploadRecord); form.set("file", file); const response = await fetch("/api/attachments", { method: "POST", body: form }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "File could not be uploaded."); setUploadOpen(false); showToast("File uploaded."); await load(); setAttachment(body.attachment.id); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "File could not be uploaded."); }
    finally { setUploading(false); }
  }
  async function openFile(file: AttachmentView) {
    const target = window.open("about:blank", "_blank"); if (target) target.opener = null;
    try { if (!target) throw new Error("Your browser blocked the file window. Allow pop-ups and try again."); const response = await fetch(`/api/attachments/${file.id}`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error); target.location.replace(body.url); }
    catch (reason) { target?.close(); setError(reason instanceof Error ? reason.message : "File could not be opened."); }
  }
  async function downloadFile(file: AttachmentView) {
    try { const response = await fetch(`/api/attachments/${file.id}`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error); const fileResponse = await fetch(body.url); if (!fileResponse.ok) throw new Error("File could not be downloaded."); const objectUrl = URL.createObjectURL(await fileResponse.blob()); const link = document.createElement("a"); link.href = objectUrl; link.download = file.file_name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 30000); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "File could not be downloaded."); }
  }
  async function deleteFile() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try { const response = await fetch(`/api/attachments/${deleting.id}`, { method: "DELETE" }); if (!response.ok) { const body = await response.json(); throw new Error(body.error); } setFiles((current) => current.filter((file) => file.id !== deleting.id)); setTotal((current) => Math.max(0, current - 1)); setDeleting(null); showToast("File deleted."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "File could not be deleted."); setDeleting(null); }
    finally { setDeleteBusy(false); }
  }

  return <div className="domain-page files-page">
    <header className="task-context-header files-ui__heading"><div><nav className="task-context-header__breadcrumb" aria-label="Breadcrumb"><span>Workspace</span><span>/</span><span className="current">Files</span></nav><h1>Files</h1><p>Store and manage files across your command center, kept with the work they belong to.</p></div><button className="files-ui__upload" onClick={() => setUploadOpen(true)}><Icons.Upload size={18}/> Upload file <Icons.ChevronDown size={14}/></button></header>
    <div className="files-ui__stats"><article><span><Icons.Folder size={23}/></span><div><small>Total files</small><strong>{total}</strong><small>Across your workspace</small></div><i/><i/><i/><i/></article><article><span><Icons.Clock3 size={23}/></span><div><small>Recent uploads</small><strong>{recentCount}</strong><small>In the last 7 days{total>files.length?" · this page":""}</small></div><i/><i/><i/><i/></article><article><span><Icons.Paperclip size={23}/></span><div><small>Linked to items</small><strong>{linkedCount}</strong><small>Tasks, projects & clients{total>files.length?" · this page":""}</small></div><i/><i/><i/><i/></article><article><span><Icons.Archive size={23}/></span><div><small>Storage used</small><strong>{formatAttachmentSize(storageBytes)}</strong><small>Loaded files{total>files.length?" · this page":""}</small></div><i/><i/><i/><i/></article></div>
    <div className="files-ui__toolbar"><label className="files-ui__search"><Icons.Search size={18}/><input aria-label="Search files on this page" placeholder="Search files..." value={query} onChange={event=>setQuery(event.target.value)}/></label><div className="file-filters" aria-label="File filters"><Filter label="Entity" value={filters.entity} onChange={value=>change("entity",value)} options={attachmentEntityTypes.map(value=>[value,`${value[0].toUpperCase()}${value.slice(1)}s`])}/><Filter label="Project" value={filters.project} onChange={value=>change("project",value)} options={projects.map(item=>[item.id,String(item.name??item.title)])}/><Filter label="Client" value={filters.client} onChange={value=>change("client",value)} options={clients.map(item=>[item.id,String(item.name??item.title)])}/><Filter label="File type" value={filters.type} onChange={value=>change("type",value)} options={["image","pdf","document","spreadsheet","archive","text"].map(value=>[value,`${value[0].toUpperCase()}${value.slice(1)}`])}/><Filter label="Recent" value={filters.recent} onChange={value=>change("recent",value)} options={[["7","7 days"],["30","30 days"],["90","90 days"]]}/></div><div className="files-ui__sort"><Icons.ListTodo size={16}/><StyledSelect label="Sort files" value={sort} onChange={setSort} options={[{value:"recent",label:"Sort: Recently updated"},{value:"name",label:"Sort: Name"},{value:"size",label:"Sort: Size"}]}/></div><div className="files-ui__view"><button className={layout==="grid"?"active":""} aria-label="Grid view" onClick={()=>setLayout("grid")}><Icons.LayoutGrid size={17}/></button><button className={layout==="list"?"active":""} aria-label="List view" onClick={()=>setLayout("list")}><Icons.Menu size={18}/></button></div></div>
    {error ? <div className="inline-error" role="alert"><p>{error}</p><Button emphasis="outline" onClick={() => void load()}>Try again</Button></div> : null}
    {loading ? <div className="empty-state" aria-live="polite"><span>···</span><h2>Loading files</h2></div> : <div className={`files-ui__content ${selected?"has-detail":""}`}><section className={`files-ui__list ${layout==="grid"?"files-ui__list--grid":""}`} aria-label="Files"><div className="files-ui__thead"><span>Name</span><span>Linked to</span><span>Type</span><span>Uploaded</span><span>Size</span></div>{visible.map(file=>{const kind=attachmentKind(file.mime_type,file.file_name);return <div className={`files-ui__row ${selected?.id===file.id?"selected":""}`} key={file.id}><button className="files-ui__file" onClick={()=>void selectFile(file)}><span className={`files-ui__type-icon files-ui__type-icon--${kind}`}><Icons.FileText size={19}/></span><span><strong>{file.file_name}</strong><small>{file.description || "No description"}</small></span></button><Link className="files-ui__linked" href={file.related?.href ?? "/files"}><Icons.Folder size={16}/><span>{file.related?.title ?? file.entity_type}<small>{file.entity_type}</small></span></Link><span className={`files-ui__kind files-ui__kind--${kind}`}>{file.file_name.split(".").pop()?.toUpperCase()}</span><time dateTime={file.created_at}>{new Date(file.created_at).toLocaleDateString([], {month:"short",day:"numeric",year:"numeric"})}<small>by You</small></time><span className="files-ui__size">{formatAttachmentSize(Number(file.size_bytes))}</span><button className="files-ui__more" aria-label={`Delete ${file.file_name}`} onClick={()=>setDeleting(file)}><Icons.MoreHorizontal size={18}/></button></div>})}{!visible.length&&<div className="files-ui__empty"><Icons.Folder size={28}/><h2>{files.length?"No matching files":"No files attached yet"}</h2><p>{files.length?"Try a different search.":"Upload a file and link it to a project or client."}</p><button onClick={files.length?()=>setQuery(""):()=>setUploadOpen(true)}>{files.length?"Clear search":"Upload file"}</button></div>}</section>{selected&&<aside className="files-ui__detail"><div className="files-ui__detail-head"><span className={`files-ui__type-icon files-ui__type-icon--${attachmentKind(selected.mime_type,selected.file_name)}`}><Icons.FileText size={20}/></span><div><h2>{selected.file_name}</h2><p>{selected.description||"No description"}</p></div><button onClick={()=>{setAttachment("");setPreviewUrl("")}} aria-label="Close file details"><Icons.X size={18}/></button></div><div className="files-ui__preview">{previewUrl?<Image unoptimized src={previewUrl} alt={`Preview of ${selected.file_name}`} width={520} height={300}/>:<div className="files-ui__preview-fallback"><Icons.FileText size={55}/><strong>{selected.file_name.split(".").pop()?.toUpperCase()} file</strong><small>Open the file to view its contents</small></div>}</div><div className="files-ui__detail-actions"><button onClick={()=>void openFile(selected)}><Icons.ExternalLink size={15}/> Open</button><button onClick={()=>void downloadFile(selected)}><Icons.ArrowRight size={15}/> Download</button><button onClick={()=>{void navigator.clipboard.writeText(`${window.location.origin}/files?attachment=${selected.id}`);showToast("File link copied.")}}><Icons.Paperclip size={15}/> Share</button></div><div className="files-ui__detail-tabs"><strong>Details</strong><Link href={selected.related?.href??"/files"}>Linked item</Link></div><dl><div><dt>Type</dt><dd>{selected.file_name.split(".").pop()?.toUpperCase()}</dd></div><div><dt>Size</dt><dd>{formatAttachmentSize(Number(selected.size_bytes))}</dd></div><div><dt>Uploaded</dt><dd>{new Date(selected.created_at).toLocaleString()}</dd></div><div><dt>Uploaded by</dt><dd>You</dd></div><div><dt>Location</dt><dd><Link href={selected.related?.href??"/files"}>{selected.related?.title??selected.entity_type}</Link></dd></div></dl><button className="files-ui__delete" onClick={()=>setDeleting(selected)}><Icons.Trash2 size={15}/> Delete file</button></aside>}</div>}
    <div className="dataset-pagination"><p className="dataset-note">Showing {files.length ? (page - 1) * 50 + 1 : 0}–{Math.min(page * 50, total)} of {total}</p><div><Button emphasis="ghost" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button><Button emphasis="ghost" disabled={page * 50 >= total} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
    <Modal open={uploadOpen} onClose={() => { if (!uploading) setUploadOpen(false); }} title="Upload file" description="Choose where this file belongs before uploading."><div className="files-ui__upload-form"><div className="files-ui__upload-field"><span>Link to</span><StyledSelect label="Link to" value={uploadEntity} onChange={next=>{setUploadEntity(next);setUploadRecord("")}} options={[{value:"project",label:"Project"},{value:"client",label:"Client"}]}/></div><div className="files-ui__upload-field"><span>{uploadEntity==="project"?"Project":"Client"}</span><StyledSelect label={uploadEntity==="project"?"Project":"Client"} value={uploadRecord} onChange={setUploadRecord} searchable options={[{value:"",label:`Choose a ${uploadEntity}`},...(uploadEntity==="project"?projects:clients).map(item=>({value:item.id,label:String(item.name??item.title)}))]}/></div><label className="files-ui__upload-drop"><Icons.Upload size={28}/><strong>Choose a file to upload</strong><small>Images, documents, spreadsheets, or ZIP · up to 6 MB</small><input type="file" accept={ATTACHMENT_ACCEPT} disabled={uploading} onChange={event=>{const file=event.target.files?.[0];if(file)void uploadFile(file)}}/></label>{uploading&&<p>Uploading file…</p>}{error&&<p className="field-error" role="alert">{error}</p>}</div></Modal>
    <Modal open={Boolean(deleting)} onClose={() => { if (!deleteBusy) setDeleting(null); }} title="Delete attachment" description={deleting ? `Delete “${deleting.file_name}” from its record and private storage? This cannot be undone.` : undefined}><div className="modal__actions"><Button emphasis="ghost" disabled={deleteBusy} onClick={() => setDeleting(null)}>Cancel</Button><Button emphasis="danger" disabled={deleteBusy} onClick={() => void deleteFile()}>{deleteBusy ? "Deleting…" : "Delete file"}</Button></div></Modal>
  </div>;
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <div className="file-filter"><span>{label}</span><StyledSelect label={`${label} filter`} value={value} onChange={onChange} options={[{ value: "", label: "All" }, ...options.map(([option, text]) => ({ value: option, label: text }))]}/></div>;
}
