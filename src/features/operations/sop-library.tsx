"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type SOPRow = Record<string, unknown> & { id: string };

function reviewBadgeClass(status: string) {
  if (status === "Fresh") return "badge--healthy";
  if (status === "Due soon") return "badge--warning";
  if (status === "Overdue") return "badge--danger";
  return "badge--muted";
}

export function SopLibrary() {
  const [sops, setSops] = useState<SOPRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("Operations");
  const [newContent, setNewContent] = useState("");
  const [newReviewInterval, setNewReviewInterval] = useState(90);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/operations/sops", { cache: "no-store" });
      const body = await res.json();
      if (res.ok) {
        setSops(body.sops || []);
      } else {
        setError(body.error || "Failed to load SOPs");
      }
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const handleCreateSop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const res = await fetch("/api/operations/sops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          category: newCategory,
          initial_content: newContent,
          review_interval_days: Number(newReviewInterval) || 90,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setNewTitle("");
        setNewDescription("");
        setNewContent("");
        void load();
      } else {
        const body = await res.json();
        setError(body.error || "Failed to create SOP");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const categories = Array.from(new Set(sops.map((s) => String(s.category || "General"))));

  const filtered = sops.filter((s) => {
    if (filterCategory !== "all" && String(s.category) !== filterCategory) return false;
    return true;
  });

  return (
    <main className="domain-page operations-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Operations · Standard Operating Procedures</p>
          <h1>SOP Library.</h1>
          <p>
            {sops.length} documented procedure{sops.length === 1 ? "" : "s"} across {categories.length || 1} categories
          </p>
        </div>
        <div className="operations-header-actions">
          <Link href="/operations"><Button emphasis="outline">Overview</Button></Link>
          <Button intent="brand" onClick={() => setShowModal(true)}>New SOP</Button>
        </div>
      </header>

      {error ? <p role="alert" className="field-error">{error}</p> : null}

      {/* Filter tabs */}
      <div className="strategy-filters">
        <button
          type="button"
          aria-pressed={filterCategory === "all"}
          onClick={() => setFilterCategory("all")}
        >
          All ({sops.length})
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            aria-pressed={filterCategory === cat}
            onClick={() => setFilterCategory(cat)}
          >
            {cat} ({sops.filter((s) => String(s.category) === cat).length})
          </button>
        ))}
      </div>

      <div className="data-surface">
        {loading ? (
          <p className="faint-note">Loading procedures...</p>
        ) : filtered.length === 0 ? (
          <p className="faint-note">No SOPs found in this category.</p>
        ) : (
          filtered.map((sop) => (
            <div key={sop.id} className="operations-row">
              <Link href={`/operations/sops/${sop.id}`}>
                <strong>{String(sop.title)}</strong>
                <small>
                  {String(sop.category || "Operations")} · v{String(sop.current_version || 1)} · Interval: {String(sop.review_interval_days || 90)}d
                </small>
              </Link>
              <em>Last reviewed {sop.last_reviewed_at ? new Date(String(sop.last_reviewed_at)).toLocaleDateString() : "Never"}</em>
              <span className={`operations-badge ${reviewBadgeClass(String(sop.review_status || "Fresh"))}`}>
                {String(sop.review_status || "Fresh")}
              </span>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>Create New SOP</h2>
            <form onSubmit={handleCreateSop}>
              <label>
                Title
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Weekly Financial Reconciliation"
                />
              </label>
              <label>
                Category
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Operations / Finance / Tech"
                />
              </label>
              <label>
                Description
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Purpose and scope of this procedure"
                />
              </label>
              <label>
                Review Interval (Days)
                <input
                  type="number"
                  min="7"
                  max="365"
                  value={newReviewInterval}
                  onChange={(e) => setNewReviewInterval(Number(e.target.value))}
                />
              </label>
              <label>
                Initial Procedure Content (Markdown)
                <textarea
                  rows={6}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="# Procedure Steps&#10;1. Step one...&#10;2. Step two..."
                />
              </label>
              <div className="modal__actions">
                <Button type="button" emphasis="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" intent="brand">
                  Create SOP
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
