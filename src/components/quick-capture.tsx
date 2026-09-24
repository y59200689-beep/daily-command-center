"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/toast-provider";
import { parseCapture, type CaptureKind } from "@/lib/capture";
import type { PersistedDomain } from "@/lib/domains";
import { announceWorkspaceMutation } from "@/lib/workspace-mutations";

interface QuickCaptureProps { open: boolean; onClose: () => void }
const captureDomains: Record<CaptureKind, PersistedDomain> = { task: "tasks", note: "notes", idea: "ideas", decision: "decisions", followup: "followups", inbox: "inbox", issue: "inbox", risk: "inbox", waiting: "waiting", commitment: "inbox", contact: "inbox", experiment: "inbox", knowledge: "notes" };

export function QuickCapture({ open, onClose }: QuickCaptureProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const classification = useMemo(() => parseCapture(value), [value]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!classification.text) { setError("Capture something before saving."); return; }
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error??"Capture could not be saved.");
      const savedKind = String(data.parsed?.kind ?? classification.kind);
      const savedDomain = Object.hasOwn(captureDomains, savedKind) ? captureDomains[savedKind as CaptureKind] : captureDomains[classification.kind];
      announceWorkspaceMutation(savedDomain);
      if (savedDomain === "inbox") announceWorkspaceMutation("inbox");
      if (savedKind === "decision") announceWorkspaceMutation("decisions");
      showToast(captureDomains[classification.kind] === "inbox" ? "Captured to Inbox for review." : `${classification.kind[0].toUpperCase()}${classification.kind.slice(1)} saved.`);
      setValue(""); onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Capture could not be saved. Try again."); }
    finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Capture what is on your mind" description="Start with task, note, idea, decision, waiting, issue, risk, commitment, contact, experiment, or knowledge. New operating records go to Inbox for triage.">
      <form className="capture-form" onSubmit={submit} noValidate>
        <label htmlFor="capture-text">Quick capture</label>
        <textarea id="capture-text" value={value} onChange={(event) => setValue(event.target.value)} className="capture-input resize-none" rows={4} placeholder="task send invoice tomorrow" aria-invalid={Boolean(error)} aria-describedby={error ? "capture-error" : "capture-help"} />
        <div className="capture-meta">
          <span id="capture-help">Detected: <strong>{classification.kind}</strong>{classification.kind === "inbox" ? " · will be triaged" : ""}</span>
          <span>{value.length}/2000</span>
        </div>
        {error ? <p className="field-error" id="capture-error" role="alert">{error}</p> : null}
        <div className="modal__actions">
          <Button emphasis="ghost" onClick={onClose}>Cancel</Button>
          <Button intent="brand" type="submit" disabled={busy}>
            {busy ? "Saving…" : captureDomains[classification.kind] === "inbox" ? "Save to Inbox" : `Save ${classification.kind === "followup" ? "Follow-up" : classification.kind[0].toUpperCase() + classification.kind.slice(1)}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
