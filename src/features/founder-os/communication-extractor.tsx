"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type ExtractedAction = {
  kind: "commitment" | "task" | "waiting" | "decision" | "followup" | "risk";
  title: string;
  counterpart?: string;
  direction?: "owed_to_me" | "owed_by_me";
  dueDate?: string;
  confidence: number;
  reason: string;
};

const KIND_ROUTES: Record<ExtractedAction["kind"], string> = {
  commitment: "/commitments",
  task: "/tasks",
  waiting: "/waiting",
  decision: "/decisions",
  followup: "/commitments",
  risk: "/risks",
};

const KIND_LABEL: Record<ExtractedAction["kind"], string> = {
  commitment: "Commitment",
  task: "Task",
  waiting: "Waiting on",
  decision: "Decision",
  followup: "Follow-up",
  risk: "Risk",
};

function confidenceColor(confidence: number) {
  if (confidence >= 0.85) return "var(--status-ok, #22c55e)";
  if (confidence >= 0.7) return "var(--status-caution, #eab308)";
  return "var(--status-low, #94a3b8)";
}

export function CommunicationExtractor() {
  const [text, setText] = useState("");
  const [actions, setActions] = useState<ExtractedAction[] | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");

  async function extract() {
    if (text.trim().length < 5) return;
    setExtracting(true);
    setError("");
    setActions(null);
    setDismissed(new Set());
    try {
      const res = await fetch("/api/communication/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setActions(body.actions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed.");
    } finally {
      setExtracting(false);
    }
  }

  const visible = actions?.filter((_, i) => !dismissed.has(i)) ?? [];

  return (
    <section className="founder-record" aria-label="Communication action extractor">
      <header className="founder-section-header">
        <div>
          <p className="eyebrow">Intelligence layer</p>
          <h2>Extract actions from communication</h2>
          <p className="founder-muted">
            Paste an email, chat message, or meeting note. The system will
            propose structured actions (commitments, tasks, decisions) for you to
            confirm before anything is saved.
          </p>
        </div>
      </header>

      {error && <p role="alert" className="founder-error">{error}</p>}

      <div className="founder-form">
        <label>
          Communication text
          <textarea
            id="communication-extract-input"
            value={text}
            onChange={(e) => { setText(e.target.value); setActions(null); }}
            rows={5}
            maxLength={10000}
            placeholder={
              "Ahmed said he will send supplier pricing by Friday.\n" +
              "I promised Sarah I will review the agreement tomorrow.\n" +
              "Need to decide between AWS and GCP by end of week."
            }
          />
        </label>
        <Button
          disabled={extracting || text.trim().length < 5}
          onClick={() => void extract()}
        >
          {extracting ? "Extracting…" : "Extract structured actions"}
        </Button>
      </div>

      {actions !== null && (
        <div style={{ marginTop: "1rem" }}>
          {visible.length === 0 && (
            <p className="founder-empty">
              No structured actions were extracted from this text.{" "}
              <span className="founder-muted">
                Try including more specific commitments, decisions, or action
                items.
              </span>
            </p>
          )}
          {visible.length > 0 && (
            <p className="founder-muted" style={{ marginBottom: "0.5rem" }}>
              {visible.length} proposed action
              {visible.length > 1 ? "s" : ""} — review and confirm before
              saving.
            </p>
          )}
          {actions.map((action, i) => {
            if (dismissed.has(i)) return null;
            return (
              <article
                key={i}
                className="founder-signal"
                aria-label={`Extracted ${action.kind}: ${action.title}`}
              >
                <div className="founder-signal__heading">
                  <span
                    className="eyebrow"
                    style={{ color: confidenceColor(action.confidence) }}
                  >
                    {KIND_LABEL[action.kind]}
                    {action.direction === "owed_to_me"
                      ? " · owed to me"
                      : action.direction === "owed_by_me"
                      ? " · owed by me"
                      : ""}
                  </span>
                  <span className="founder-muted" style={{ fontSize: "0.78em" }}>
                    {Math.round(action.confidence * 100)}% confidence
                  </span>
                </div>
                <h3>{action.title}</h3>
                <p className="founder-muted" style={{ fontSize: "0.85em" }}>
                  {action.reason}
                  {action.counterpart && ` · Counterpart: ${action.counterpart}`}
                  {action.dueDate && ` · Due: ${action.dueDate}`}
                </p>
                <div className="founder-actions">
                  <Link href={KIND_ROUTES[action.kind]}>
                    Confirm in {KIND_LABEL[action.kind]} workspace →
                  </Link>
                  <Button
                    emphasis="ghost"
                    onClick={() =>
                      setDismissed((prev) => new Set([...prev, i]))
                    }
                  >
                    Dismiss
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
