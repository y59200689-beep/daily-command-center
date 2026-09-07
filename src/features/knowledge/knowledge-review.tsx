"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

type Topic = { id: string; title: string; status: string; domain: string; priority: string; next_review_at: string | null; updated_at: string };
type Source = { id: string; title: string; freshness_expires_at: string | null; reliability: string | null; updated_at: string };
type Finding = { id: string; title: string; status: string; topic_id: string; updated_at: string };
type Question = { id: string; question: string; status: string; topic_id: string; priority: string; updated_at: string };
type WatchEntity = { id: string; name: string; watch_type: string; next_check_at: string | null; status: string };

const today = () => new Date().toISOString().slice(0,10);

function ReviewSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="attention-section">
      <div className="section-heading">
        <h2 className="section-heading">
          <button onClick={() => setOpen((o) => !o)} style={{ border: 0, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: 0, color: "var(--ink)" }}>
            {open ? "▾" : "▸"} {title} <span className="status">{count}</span>
          </button>
        </h2>
      </div>
      {open ? children : null}
    </section>
  );
}

export function KnowledgeReview() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [watches, setWatches] = useState<WatchEntity[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [tRes, sRes, fRes, qRes, wRes] = await Promise.all([
      fetch("/api/knowledge/topics", { cache: "no-store" }),
      fetch("/api/knowledge/sources", { cache: "no-store" }),
      fetch("/api/knowledge/findings", { cache: "no-store" }),
      fetch("/api/knowledge/questions", { cache: "no-store" }),
      fetch("/api/knowledge/watches", { cache: "no-store" }),
    ]);
    const [tB, sB, fB, qB, wB] = await Promise.all([tRes.json(), sRes.json(), fRes.json(), qRes.json(), wRes.json()]);
    if (!tRes.ok) { setError(tB.error ?? "Review data could not be loaded."); return; }
    setTopics(tB.items ?? []);
    setSources(sB.items ?? []);
    setFindings(fB.items ?? []);
    setQuestions(qB.items ?? []);
    setWatches(wB.items ?? []);
  }, []);
  useDeferredEffect(useCallback(() => { void load(); }, [load]));

  const patch = async (resource: string, id: string, body: Record<string, unknown>) => {
    await fetch(`/api/knowledge/${resource}/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await load();
  };

  const td = today();

  // Derived lists — deterministic, no AI
  const topicsDueReview = topics.filter((t) => t.status !== "archived" && t.next_review_at && t.next_review_at <= td);
  const staleSources = sources.filter((s) => s.freshness_expires_at && s.freshness_expires_at < td);
  const draftFindings = findings.filter((f) => f.status === "draft");
  const openQuestions = questions.filter((q) => q.status === "open");
  const watchesDue = watches.filter((w) => w.status === "active" && w.next_check_at && w.next_check_at <= td);

  const totalItems = topicsDueReview.length + staleSources.length + draftFindings.length + openQuestions.length + watchesDue.length;

  return (
    <main className="domain-page knowledge-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Knowledge · Periodic review</p>
          <h1>Review.</h1>
          <p>{totalItems} item{totalItems === 1 ? "" : "s"} need attention</p>
        </div>
        <div className="strategy-actions">
          <Link className="button button--outline" href="/knowledge">Knowledge</Link>
          <Link className="button button--outline" href="/knowledge/watch">Watchlist</Link>
        </div>
      </header>
      {error ? <p role="alert" className="field-error">{error}</p> : null}

      {totalItems === 0 ? (
        <div className="empty-state">
          <span>✓</span>
          <h2>All caught up</h2>
          <p>No knowledge items need your review right now.</p>
        </div>
      ) : null}

      {topicsDueReview.length > 0 && (
        <ReviewSection title="Topics due for review" count={topicsDueReview.length}>
          {topicsDueReview.map((t) => (
            <div className="attention-row" key={t.id}>
              <span>{t.domain}</span>
              <div>
                <strong><Link href={`/knowledge/topics/${t.id}`}>{t.title}</Link></strong>
                <p>Due: {t.next_review_at}</p>
              </div>
              <div className="detail-actions">
                <Button emphasis="outline" onClick={() => void patch("topics", t.id, { next_review_at: new Date(Date.now() + 14*86400000).toISOString().slice(0,10) })}>Snooze 2w</Button>
                <Button intent="brand" onClick={() => void patch("topics", t.id, { next_review_at: new Date(Date.now() + 30*86400000).toISOString().slice(0,10) })}>Reviewed</Button>
              </div>
            </div>
          ))}
        </ReviewSection>
      )}

      {staleSources.length > 0 && (
        <ReviewSection title="Stale sources" count={staleSources.length}>
          {staleSources.map((s) => (
            <div className="attention-row" key={s.id}>
              <span>{s.reliability ?? "unverified"}</span>
              <div>
                <strong><Link href={`/knowledge/sources/${s.id}`}>{s.title}</Link></strong>
                <p>Expired: {s.freshness_expires_at}</p>
              </div>
              <div className="detail-actions">
                <Button emphasis="outline" onClick={() => void patch("sources", s.id, { freshness_expires_at: new Date(Date.now() + 90*86400000).toISOString().slice(0,10) })}>Renew 90d</Button>
                <Link className="button button--outline" href={`/knowledge/sources/${s.id}`}>Open</Link>
              </div>
            </div>
          ))}
        </ReviewSection>
      )}

      {draftFindings.length > 0 && (
        <ReviewSection title="Draft findings" count={draftFindings.length}>
          {draftFindings.map((f) => (
            <div className="attention-row" key={f.id}>
              <span>draft</span>
              <div>
                <strong><Link href={`/knowledge/findings/${f.id}`}>{f.title}</Link></strong>
              </div>
              <div className="detail-actions">
                <Button intent="brand" onClick={() => void patch("findings", f.id, { status: "supported" })}>Mark supported</Button>
                <Link className="button button--outline" href={`/knowledge/findings/${f.id}`}>Open</Link>
              </div>
            </div>
          ))}
        </ReviewSection>
      )}

      {openQuestions.length > 0 && (
        <ReviewSection title="Unanswered questions" count={openQuestions.length}>
          {openQuestions.map((q) => (
            <div className="attention-row" key={q.id}>
              <span>{q.priority}</span>
              <div>
                <strong><Link href={`/knowledge/topics/${q.topic_id}#question-${q.id}`}>{q.question}</Link></strong>
              </div>
              <div className="detail-actions">
                <Button emphasis="outline" onClick={() => void patch("questions", q.id, { status: "deferred" })}>Defer</Button>
                <Button intent="brand" onClick={() => void patch("questions", q.id, { status: "dropped" })}>Drop</Button>
              </div>
            </div>
          ))}
        </ReviewSection>
      )}

      {watchesDue.length > 0 && (
        <ReviewSection title="Watchlist due for check" count={watchesDue.length}>
          {watchesDue.map((w) => (
            <div className="attention-row" key={w.id}>
              <span>{w.watch_type.replaceAll("_"," ")}</span>
              <div>
                <strong><Link href="/knowledge/watch">{w.name}</Link></strong>
                <p>Next check was: {w.next_check_at}</p>
              </div>
              <div className="detail-actions">
                <Button intent="brand" onClick={() => void patch("watches", w.id, { last_checked_at: new Date().toISOString(), next_check_at: new Date(Date.now() + 7*86400000).toISOString().slice(0,10) })}>Reviewed</Button>
              </div>
            </div>
          ))}
        </ReviewSection>
      )}
    </main>
  );
}
