"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icons } from "@/components/icons";
import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENT_BYTES, formatAttachmentSize, validateAttachmentMetadata, type AttachmentEntityType } from "@/lib/attachment-policy";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

export type AttachmentView = {
  id: string; entity_type: AttachmentEntityType; entity_id: string; file_name: string; mime_type: string | null;
  size_bytes: number; description: string | null; created_at: string; related?: { title: string; href: string; projectId: string | null; clientId: string | null };
};

export function AttachmentSection({ entityType, entityId, title = "Attachments", onCountChange }: { entityType: AttachmentEntityType; entityId: string; title?: string; onCountChange?: (count: number) => void }) {
  const [attachments, setAttachments] = useState<AttachmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<AttachmentView | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<XMLHttpRequest | null>(null);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const response = await fetch(`/api/attachments?entityType=${entityType}&entityId=${entityId}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      const next = body.attachments ?? [];
      setAttachments(next); onCountChange?.(next.length);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Files could not be loaded."); }
    finally { setLoading(false); }
  }, [entityId, entityType, onCountChange]);
  useDeferredEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => () => uploadRef.current?.abort(), []);

  function upload(file: File) {
    const validationError = validateAttachmentMetadata(file);
    if (validationError) { setError(validationError); inputRef.current?.focus(); return; }
    setUploading(true); setProgress(0); setError("");
    const form = new FormData(); form.set("entityType", entityType); form.set("entityId", entityId); form.set("file", file);
    const request = new XMLHttpRequest();
    uploadRef.current = request;
    request.upload.addEventListener("progress", (event) => { if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100)); });
    request.addEventListener("load", () => {
      try {
        const body = JSON.parse(request.responseText || "{}");
        if (request.status < 200 || request.status >= 300) throw new Error(body.error ?? "File could not be uploaded.");
        setAttachments((current) => { const next = [body.attachment, ...current]; onCountChange?.(next.length); return next; });
        showToast("File uploaded.");
      } catch (reason) { setError(reason instanceof Error ? reason.message : "File could not be uploaded."); }
      finally { uploadRef.current = null; setUploading(false); setProgress(0); if (inputRef.current) inputRef.current.value = ""; }
    });
    request.addEventListener("error", () => { uploadRef.current = null; setError("The upload was interrupted. Check your connection and try again."); setUploading(false); setProgress(0); });
    request.addEventListener("abort", () => { uploadRef.current = null; setUploading(false); setProgress(0); setError("Upload cancelled. Choose the file again when you are ready."); });
    request.open("POST", "/api/attachments"); request.send(form);
  }

  async function openFile(attachment: AttachmentView) {
    const target = window.open("about:blank", "_blank");
    if (target) target.opener = null;
    try {
      setError("");
      if (!target) throw new Error("Your browser blocked the file window. Allow pop-ups and try again.");
      const response = await fetch(`/api/attachments/${attachment.id}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      target.location.replace(body.url);
    } catch (reason) { target?.close(); setError(reason instanceof Error ? reason.message : "File could not be opened."); }
  }

  async function confirmDelete() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true); setError("");
    try {
      const response = await fetch(`/api/attachments/${deleting.id}`, { method: "DELETE" });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error); }
      setAttachments((current) => { const next = current.filter((item) => item.id !== deleting.id); onCountChange?.(next.length); return next; });
      setDeleting(null); showToast("File deleted.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "File could not be deleted."); setDeleting(null); }
    finally { setDeleteBusy(false); }
  }

  return <section className="attachment-section" aria-labelledby={`attachments-${entityType}-${entityId}`}>
    <div className="attachment-section__heading"><div><p className="eyebrow">Files</p><h3 id={`attachments-${entityType}-${entityId}`}>{title}</h3></div><Button emphasis="outline" disabled={uploading} onClick={() => inputRef.current?.click()}><Icons.Paperclip size={15}/>{uploading ? "Uploading…" : "Add file"}</Button></div>
    <input ref={inputRef} className="sr-only" type="file" accept={ATTACHMENT_ACCEPT} disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); }}/>
    <div className={`attachment-dropzone ${dragging ? "attachment-dropzone--active" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) upload(file); }}>
      <Icons.Upload size={18}/><span>Drop a file here, or use Add file</span><small>Images, documents, spreadsheets, or ZIP · up to {MAX_ATTACHMENT_BYTES / 1024 / 1024} MB</small>
    </div>
    {uploading ? <div className="attachment-progress" role="progressbar" aria-label="File upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress || undefined}><span style={{ width: `${progress || 12}%` }}/><small>{progress ? `${progress}% uploaded` : "Preparing upload…"}</small><button type="button" onClick={() => uploadRef.current?.abort()}>Cancel upload</button></div> : null}
    {error ? <p className="field-error attachment-error" role="alert">{error} <button type="button" onClick={() => setError("")}>Dismiss</button></p> : null}
    {loading ? <p className="dataset-note" aria-live="polite">Loading files…</p> : attachments.length ? <div className="attachment-list">{attachments.map((attachment) => <div className="attachment-row" key={attachment.id}>
      <span className="attachment-row__icon"><Icons.FileText size={16}/></span><button className="attachment-row__open" type="button" onClick={() => void openFile(attachment)}><strong>{attachment.file_name}</strong><small>{formatAttachmentSize(Number(attachment.size_bytes))} · {new Date(attachment.created_at).toLocaleDateString()}</small></button><button className="attachment-row__delete" type="button" aria-label={`Delete ${attachment.file_name}`} onClick={() => setDeleting(attachment)}><Icons.Trash2 size={15}/></button>
    </div>)}</div> : <div className="attachment-empty"><p>No files attached yet.</p><Button emphasis="ghost" disabled={uploading} onClick={() => inputRef.current?.click()}>Add file</Button></div>}
    <Modal open={Boolean(deleting)} onClose={() => { if (!deleteBusy) setDeleting(null); }} title="Delete attachment" description={deleting ? `Delete “${deleting.file_name}” from this record and private storage? This cannot be undone.` : undefined}><div className="modal__actions"><Button emphasis="ghost" disabled={deleteBusy} onClick={() => setDeleting(null)}>Cancel</Button><Button emphasis="danger" disabled={deleteBusy} onClick={() => void confirmDelete()}>{deleteBusy ? "Deleting…" : "Delete file"}</Button></div></Modal>
  </section>;
}
