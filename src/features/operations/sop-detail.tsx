"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type SOPDetailProps = {
  id: string;
};

type SOPData = Record<string, unknown> & {
  id: string;
  title: string;
  category: string;
  description: string;
  current_version: number;
  review_status: string;
  versions?: Array<Record<string, unknown>>;
  steps?: Array<Record<string, unknown>>;
  checklists?: Array<Record<string, unknown>>;
};

export function SopDetail({ id }: SOPDetailProps) {
  const [sop, setSop] = useState<SOPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [newVersionContent, setNewVersionContent] = useState("");
  const [changeSummary, setChangeSummary] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/operations/sops/${id}`, { cache: "no-store" });
      const body = await res.json();
      if (res.ok) {
        setSop(body.sop);
      } else {
        setError(body.error || "Failed to load SOP");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const handleMarkReviewed = async () => {
    try {
      const res = await fetch(`/api/operations/sops/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_reviewed" }),
      });
      if (res.ok) {
        void load();
      } else {
        const body = await res.json();
        setError(body.error || "Failed to mark reviewed");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionContent.trim()) return;

    try {
      const res = await fetch(`/api/operations/sops/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newVersionContent,
          change_summary: changeSummary,
        }),
      });
      if (res.ok) {
        setShowVersionModal(false);
        setNewVersionContent("");
        setChangeSummary("");
        void load();
      } else {
        const body = await res.json();
        setError(body.error || "Failed to create new version");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  if (loading) {
    return (
      <main className="domain-page operations-page">
        <p className="faint-note">Loading SOP details...</p>
      </main>
    );
  }

  if (!sop) {
    return (
      <main className="domain-page operations-page">
        <p className="field-error">{error || "SOP not found"}</p>
        <Link href="/operations/sops"><Button emphasis="outline">Back to Library</Button></Link>
      </main>
    );
  }

  const latestVersion = sop.versions?.[0] as Record<string, unknown> | undefined;

  return (
    <main className="domain-page operations-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            <Link href="/operations/sops">SOPs</Link> · {String(sop.category)} · v{String(sop.current_version)}
          </p>
          <h1>{sop.title}</h1>
          <p>{sop.description || "No description provided"}</p>
        </div>
        <div className="operations-header-actions">
          <Link href="/operations/sops"><Button emphasis="outline">Library</Button></Link>
          <Button emphasis="outline" onClick={handleMarkReviewed}>Mark Reviewed</Button>
          <Button intent="brand" onClick={() => setShowVersionModal(true)}>New Version</Button>
        </div>
      </header>

      {error ? <p role="alert" className="field-error">{error}</p> : null}

      <div className="operations-grid">
        {/* Main Content & Steps */}
        <section className="operations-section operations-section--full data-surface">
          <header>
            <div>
              <p className="eyebrow">Procedure Definition</p>
              <h2>Version {String(sop.current_version)} Content</h2>
            </div>
            <span className="operations-badge badge--healthy">Active Version</span>
          </header>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: "14px", marginTop: "12px" }}>
            {String(latestVersion?.content || "No written content for this version.")}
          </div>
        </section>

        {/* Steps List */}
        <section className="operations-section data-surface">
          <header>
            <div>
              <p className="eyebrow">Workflow</p>
              <h2>Configured Steps ({sop.steps?.length || 0})</h2>
            </div>
          </header>
          {(!sop.steps || sop.steps.length === 0) ? (
            <p className="faint-note">No discrete steps defined yet.</p>
          ) : (
            <div className="operations-step-list">
              {sop.steps.map((step, idx) => (
                <div key={idx} className="operations-step-item">
                  <div className="operations-step-header">
                    <strong>{idx + 1}. {String(step.title)}</strong>
                    {Boolean(step.is_required) && <span className="operations-badge badge--warning">Required</span>}
                  </div>
                  {Boolean(step.instructions) && <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>{String(step.instructions)}</p>}

                </div>
              ))}
            </div>
          )}
        </section>

        {/* Version History */}
        <section className="operations-section data-surface">
          <header>
            <div>
              <p className="eyebrow">Audit & Lineage</p>
              <h2>Version History ({sop.versions?.length || 0})</h2>
            </div>
          </header>
          {(!sop.versions || sop.versions.length === 0) ? (
            <p className="faint-note">No version history found.</p>
          ) : (
            <div>
              {sop.versions.map((ver) => (
                <div key={String(ver.id)} className="operations-row">
                  <div>
                    <strong>Version {String(ver.version_number)}</strong>
                    <small>{String(ver.change_summary || "Routine update")}</small>
                  </div>
                  <em>{new Date(String(ver.created_at)).toLocaleDateString()}</em>
                  <span className="operations-badge badge--muted">
                    {String(ver.version_number) === String(sop.current_version) ? "Current" : "Historical"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {showVersionModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>Publish New SOP Version (v{Number(sop.current_version) + 1})</h2>
            <form onSubmit={handleCreateVersion}>
              <label>
                Summary of Changes
                <input
                  type="text"
                  required
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  placeholder="e.g. Updated verification steps and added timeout check"
                />
              </label>
              <label>
                Updated Procedure Content (Markdown)
                <textarea
                  rows={8}
                  required
                  value={newVersionContent}
                  onChange={(e) => setNewVersionContent(e.target.value)}
                  placeholder="# Procedure Steps..."
                />
              </label>
              <div className="modal__actions">
                <Button type="button" emphasis="outline" onClick={() => setShowVersionModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" intent="brand">
                  Publish Version {Number(sop.current_version) + 1}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
