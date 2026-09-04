"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/toast-provider";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Row = Record<string, unknown> & { id: string };
type Data = { prompt: Row; versions: Row[]; detectedVariables: string[] };

export function PromptWorkspace({ id }: { id: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState("");
  const [compareId, setCompareId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/prompts/${id}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setData(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Prompt could not be loaded.");
    }
  }, [id]);
  useDeferredEffect(useCallback(() => { void load(); }, [load]));
  const variables = useMemo(() => data?.detectedVariables ?? [], [data]);
  const comparison = data?.versions.find((version) => version.id === compareId) ?? null;

  async function usePrompt(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/prompts/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "use", variables: values }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setResult(body.rendered);
      showToast("Prompt prepared.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Prompt could not be prepared.");
    } finally {
      setBusy(false);
    }
  }

  async function restore(versionId: string) {
    setBusy(true);
    const response = await fetch(`/api/prompts/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore", version_id: versionId }) });
    if (response.ok) {
      showToast("Prompt version restored.");
      setCompareId(null);
      await load();
    } else showToast("Version could not be restored.", "error");
    setBusy(false);
  }

  if (error && !data) return <State title="Prompt unavailable" copy={error}/>;
  if (!data) return <State title="Loading prompt"/>;
  const currentText = String(data.prompt.prompt_text ?? data.prompt.prompt);

  return <div className="detail-page">
    <Link className="back-link" href="/prompts">← Back to prompts</Link>
    <header className="detail-header"><div><p className="eyebrow">{String(data.prompt.category ?? "Prompt library")}</p><h1>{String(data.prompt.title)}</h1><p>{String(data.prompt.description ?? "Reusable workspace instruction")}</p></div><Button intent="brand" onClick={() => setOpen(true)}>Use prompt</Button></header>
    <div className="detail-grid"><section><p className="eyebrow">Current prompt</p><pre className="prompt-copy">{currentText}</pre>{comparison ? <div className="version-comparison"><p className="eyebrow">Compared with version {String(comparison.version_number)}</p><div><article><strong>Historical</strong><pre>{String(comparison.prompt_text)}</pre></article><article><strong>Current</strong><pre>{currentText}</pre></article></div></div> : null}{result ? <div className="rendered-prompt"><p className="eyebrow">Expanded prompt</p><p>{result}</p><Button emphasis="outline" onClick={() => void navigator.clipboard.writeText(result)}>Copy prompt</Button></div> : null}</section>
      <aside><p className="eyebrow">Usage</p><div className="signal-row"><span><strong>{String(data.prompt.usage_count ?? 0)} uses</strong>{data.prompt.last_used_at ? `Last used ${new Date(String(data.prompt.last_used_at)).toLocaleDateString()}` : "Not used yet"}</span></div><p className="eyebrow version-heading">Version history</p>{data.versions.length ? data.versions.map((version) => <div className="version-row" key={version.id}><span><strong>Version {String(version.version_number)}</strong>{String(version.change_note ?? new Date(String(version.created_at)).toLocaleDateString())}</span><span><Button emphasis="ghost" onClick={() => setCompareId(version.id)}>Compare</Button><Button emphasis="ghost" disabled={busy} onClick={() => void restore(version.id)}>Restore</Button></span></div>) : <p className="dataset-note">Versions appear when the prompt is edited.</p>}</aside></div>
    <Modal open={open} onClose={() => setOpen(false)} title="Use prompt" description="Complete the variables to create a final prompt. The template is never overwritten."><form className="simple-form" onSubmit={usePrompt} noValidate>{variables.length ? variables.map((name) => <div key={name}><label htmlFor={`variable-${name}`}>{name.replaceAll("_", " ")}</label><input id={`variable-${name}`} required value={values[name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}/></div>) : <p className="dataset-note">This prompt has no variables and is ready to use.</p>}{error ? <p role="alert" className="field-error">{error}</p> : null}<div className="modal__actions"><Button emphasis="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button intent="brand" type="submit" disabled={busy}>{busy ? "Preparing…" : "Prepare prompt"}</Button></div></form></Modal>
  </div>;
}

function State({ title, copy }: { title: string; copy?: string }) {
  return <div className="empty-state"><span>···</span><h2>{title}</h2>{copy ? <p>{copy}</p> : null}</div>;
}
