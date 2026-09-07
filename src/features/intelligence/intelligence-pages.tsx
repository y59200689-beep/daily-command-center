"use client";

import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/toast-provider";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import { minutesLabel } from "@/lib/utils";

type Row = Record<string, unknown> & { id: string };
type Recommendation = {
  key: string;
  entityType: string;
  entityId: string;
  label: string;
  reason: string;
  route: string;
  priority: number;
  evidence: Array<{ label: string }>;
};
type Risk = {
  key: string;
  severity: string;
  title: string;
  reason: string;
  recommendedAction: string;
  route: string;
  evidence: Array<{ label: string }>;
};
type Plan = {
  date: string;
  wins: Recommendation[];
  blocks: Array<{
    startsAt: string;
    endsAt: string;
    title: string;
    kind: string;
  }>;
  defer: Array<{ id: string; title: string; reason: string }>;
  followups: Recommendation[];
  workout: { label: string; reason: string } | null;
  capacity: {
    capacityMinutes: number;
    meetingMinutes: number;
    availableFocusMinutes: number;
    highPriorityMinutes: number;
    overcommittedMinutes: number;
    insight: string;
  };
};
type PlanConflict = { id: string; versionKey: string; overlapMinutes: number; firstId: string; secondId: string; first: { title: string; source: string }; second: { title: string; source: string } };

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
function localDateTimeInput(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function Loading({ label = "Preparing your brief" }: { label?: string }) {
  return (
    <div className="empty-state">
      <span>···</span>
      <h2>{label}</h2>
    </div>
  );
}
function Failure({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="empty-state">
      <span>!</span>
      <h2>This view could not be prepared</h2>
      <p>{message}</p>
      <Button emphasis="outline" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}

export function PlannerPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<PlanConflict[]>([]);
  const [keptOverlapKeys, setKeptOverlapKeys] = useState<string[]>([]);
  const [moving, setMoving] = useState<{ index: number; startsAt: string; endsAt: string } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/intelligence/plan", {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setPlan(body.plan);
      setConflicts(body.conflicts ?? []);
      setKeptOverlapKeys([]);
      setSelected(body.plan.wins.map((item: Recommendation) => item.entityId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Plan unavailable.");
    }
  }, []);
  useDeferredEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  async function submit(action: "accept" | "reject") {
    setSaving(true);
    try {
      const response = await fetch("/api/intelligence/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, selectedTaskIds: selected, blocks: plan?.blocks, keptOverlapKeys }),
      });
      const body = await response.json();
      if (!response.ok) { if (body.conflicts) setConflicts(body.conflicts); throw new Error(body.error); }
      showToast(
        action === "accept"
          ? "Today’s plan is accepted."
          : "Suggestion rejected. Your current priorities were not changed.",
      );
    } catch (reason) {
      showToast(
        reason instanceof Error ? reason.message : "Plan could not be saved.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }
  if (error) return <Failure message={error} retry={() => void load()} />;
  if (!plan) return <Loading label="Planning around your real commitments" />;
  return (
    <div className="intelligence-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Morning planner · {plan.date}</p>
          <h1>Today’s plan.</h1>
          <p>{plan.capacity.insight} Nothing changes until you accept.</p>
        </div>
        <Button
          disabled={saving || !selected.length}
          intent="brand"
          onClick={() => void submit("accept")}
        >
          {saving ? "Saving…" : "Accept plan"}
        </Button>
      </header>
      <section className="metric-ledger metric-ledger--four">
        <Metric
          value={minutesLabel(plan.capacity.capacityMinutes)}
          label="Capacity"
        />
        <Metric
          value={minutesLabel(plan.capacity.meetingMinutes)}
          label="Meetings"
        />
        <Metric
          value={minutesLabel(plan.capacity.availableFocusMinutes)}
          label="Available focus"
        />
        <Metric
          value={minutesLabel(plan.capacity.overcommittedMinutes)}
          label="Overcommitted"
        />
      </section>
      <div className="editorial-split">
        <section>
          <p className="eyebrow">Suggested wins</p>
          <h2>Choose up to three.</h2>
          <div className="plan-wins">
            {plan.wins.map((win, index) => (
              <label className="plan-win" key={win.key}>
                <input
                  type="checkbox"
                  checked={selected.includes(win.entityId)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [
                            ...current.filter((id) => id !== win.entityId),
                            win.entityId,
                          ].slice(0, 3)
                        : current.filter((id) => id !== win.entityId),
                    )
                  }
                />
                <span>
                  <small>0{index + 1}</small>
                  <strong>{win.label}</strong>
                  <em>{win.reason}</em>
                </span>
              </label>
            ))}
          </div>
          <p className="eyebrow intelligence-section-label">
            Suggested schedule
          </p>
          {plan.blocks.map((block) => (
            <article
              className="schedule-row"
              key={`${block.startsAt}-${block.title}`}
            >
              <time>
                {formatTime(block.startsAt)}–{formatTime(block.endsAt)}
              </time>
              <div>
                <strong>{block.title}</strong>
                <small>{block.kind}</small>
              </div>
            </article>
          ))}
          {conflicts.length ? <div className="planner-conflicts"><p className="eyebrow">Schedule conflicts</p>{conflicts.map((conflict) => { const proposedId = conflict.firstId.startsWith("proposed:") ? conflict.firstId : conflict.secondId; const index = Number(proposedId.split(":")[1]); const block = plan.blocks[index]; return <article className="planner-conflict" key={conflict.id}><div><strong>This block conflicts with your Calendar.</strong><p>{conflict.first.title} overlaps {conflict.second.title} by {conflict.overlapMinutes} min.</p></div><div className="integration-actions"><Button emphasis="outline" disabled={!block} onClick={() => block && setMoving({ index, startsAt: localDateTimeInput(block.startsAt), endsAt: localDateTimeInput(block.endsAt) })}>Move block</Button><Button emphasis="ghost" disabled={!block} onClick={() => { if (!block) return; setPlan((current) => current ? { ...current, blocks: current.blocks.filter((_, blockIndex) => blockIndex !== index) } : current); setConflicts((current) => current.filter((item) => item.id !== conflict.id)); }}>Remove block</Button><Button emphasis="ghost" onClick={() => { setKeptOverlapKeys((current) => [...new Set([...current, conflict.versionKey])]); setConflicts((current) => current.filter((item) => item.id !== conflict.id)); }}>Keep overlap</Button></div></article>; })}</div> : null}
        </section>
        <aside>
          <p className="eyebrow">Consider deferring</p>
          {plan.defer.length ? (
            plan.defer.map((item) => (
              <div className="brief-item" key={item.id}>
                <strong>{item.title}</strong>
                <p>{item.reason}</p>
              </div>
            ))
          ) : (
            <p className="dataset-note">No clear deferrals are suggested.</p>
          )}
          <p className="eyebrow intelligence-section-label">Follow-ups</p>
          {plan.followups.map((item) => (
            <Link className="brief-item" href={item.route} key={item.key}>
              <strong>{item.label}</strong>
              <p>{item.reason}</p>
            </Link>
          ))}
          {plan.workout ? (
            <>
              <p className="eyebrow intelligence-section-label">Personal</p>
              <div className="brief-item">
                <strong>{plan.workout.label}</strong>
                <p>{plan.workout.reason}</p>
              </div>
            </>
          ) : null}
          <Button
            emphasis="ghost"
            disabled={saving}
            onClick={() => void submit("reject")}
          >
            Reject suggestion
          </Button>
        </aside>
      </div>
      {moving ? <Modal open onClose={() => setMoving(null)} title="Move plan block" description="Choose a new time that does not overlap your Calendar."><form className="simple-form" noValidate onSubmit={(event) => { event.preventDefault(); const start = new Date(moving.startsAt); const end = new Date(moving.endsAt); if (!(end > start)) { showToast("The block must end after it starts.", "error"); return; } setPlan((current) => current ? { ...current, blocks: current.blocks.map((block, index) => index === moving.index ? { ...block, startsAt: start.toISOString(), endsAt: end.toISOString() } : block) } : current); setConflicts((current) => current.filter((conflict) => !conflict.firstId.startsWith(`proposed:${moving.index}:`) && !conflict.secondId.startsWith(`proposed:${moving.index}:`))); setMoving(null); }}><label htmlFor="move-block-start">Starts</label><input id="move-block-start" type="datetime-local" value={moving.startsAt} onChange={(event) => setMoving({ ...moving, startsAt: event.target.value })}/><label htmlFor="move-block-end">Ends</label><input id="move-block-end" type="datetime-local" value={moving.endsAt} onChange={(event) => setMoving({ ...moving, endsAt: event.target.value })}/><div className="modal__actions"><Button emphasis="ghost" type="button" onClick={() => setMoving(null)}>Cancel</Button><Button type="submit">Move block</Button></div></form></Modal> : null}
    </div>
  );
}

export function RisksPage() {
  const [risks, setRisks] = useState<Risk[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/intelligence/overview", {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setRisks(body.risks);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Risks unavailable.");
    }
  }, []);
  useDeferredEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  if (error) return <Failure message={error} retry={() => void load()} />;
  if (!risks) return <Loading label="Reviewing active risks" />;
  return (
    <div className="intelligence-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Decision support</p>
          <h1>Risks.</h1>
          <p>Calm, evidence-based signals from your current workspace.</p>
        </div>
      </header>
      {risks.length ? (
        <div className="risk-ledger">
          {risks.map((risk) => (
            <article
              className={`risk-row risk-row--${risk.severity}`}
              key={risk.key}
            >
              <span>{risk.severity}</span>
              <div>
                <h2>{risk.title}</h2>
                <p>{risk.reason}</p>
                <details>
                  <summary>Evidence</summary>
                  <ul>
                    {risk.evidence.map((item) => (
                      <li key={item.label}>{item.label}</li>
                    ))}
                  </ul>
                </details>
              </div>
              <Link href={risk.route}>{risk.recommendedAction} →</Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span>✓</span>
          <h2>No meaningful risks detected</h2>
          <p>
            The system will surface a risk when current evidence warrants
            attention.
          </p>
        </div>
      )}
    </div>
  );
}

type WeeklyReview = {
  periodStart: string;
  periodEnd: string;
  metrics: Record<string, number>;
  allocation: Array<{
    id: string;
    name: string;
    minutes: number;
    share: number;
  }>;
  wins: string[];
  risks: Risk[];
  unfinished: Array<{ id: string; title: string; dueDate: string }>;
  recommendations: Recommendation[];
  insights: string[];
  business?: { leadsCreated: number; opportunitiesCreated: number; opportunitiesAdvanced: number; proposalsSent: number; dealsWon: number; dealsLost: number; trackedHours: number; scopeCreep: number; profitabilityWarnings: number; reactivationCandidates: number; currencies: Record<string, { received: number; outstanding: number; overdue: number; pipeline: number }> };
  founder?: { revenue: Record<string, number>; orders: number; failedProductionDeployments: number; incidents: number; supportCases: number; aiRequests: number; aiFailures: number; funnel: { sessions: number; conversion: number | null } | null };
  life?: { upcomingTrips: Array<{ id: string; title: string; start_date: string | null }>; renewalsDue: number; documentsNeedingAttention: number; adminCompleted: number; fitnessSessions: number; routinesActive: number; routineCompletions: number };
  strategy?: { planned:number; completed:number; moved:number; dropped:number; milestonesReached:number; mainBlocker:string|null; capacity:string; topRisk:string|null };
  knowledge?: { activeTopics: number; newFindings: number; staleSources: number; openQuestions: number; watchesDue: number };
};
export function WeeklyReviewPage() {
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/intelligence/review/weekly", {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setReview(body.review);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Review unavailable.",
      );
    }
  }, []);
  useDeferredEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  async function save() {
    setSaving(true);
    const response = await fetch("/api/intelligence/review/weekly", {
      method: "POST",
    });
    setSaving(false);
    showToast(
      response.ok
        ? "Weekly review saved."
        : "Weekly review could not be saved.",
      response.ok ? "success" : "error",
    );
  }
  if (error) return <Failure message={error} retry={() => void load()} />;
  if (!review) return <Loading label="Preparing your executive review" />;
  const m = review.metrics;
  return (
    <div className="intelligence-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            Weekly executive review · {review.periodStart}—{review.periodEnd}
          </p>
          <h1>This week.</h1>
          <p>What moved, what drifted, and what next week should protect.</p>
        </div>
        <Button intent="brand" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save review"}
        </Button>
      </header>
      <section className="metric-ledger">
        <Metric value={String(m.tasksCompleted ?? 0)} label="Tasks completed" />
        <Metric value={minutesLabel(m.focusMinutes ?? 0)} label="Focus" />
        <Metric
          value={`${(m.moneyReceived ?? 0).toLocaleString()} MAD`}
          label="Received"
        />
        <Metric
          value={`${(m.overdueAmount ?? 0).toLocaleString()} MAD`}
          label="Overdue"
        />
        <Metric value={String(m.contentPublished ?? 0)} label="Published" />
        <Metric
          value={String(m.fitnessSessions ?? 0)}
          label="Fitness sessions"
        />
      </section>
      {review.business ? <section className="data-surface weekly-business-review"><p className="eyebrow">Business</p><div className="metric-ledger metric-ledger--four"><Metric value={String(review.business.leadsCreated)} label="Leads created"/><Metric value={String(review.business.opportunitiesCreated)} label="Opportunities created"/><Metric value={String(review.business.opportunitiesAdvanced)} label="Opportunities advanced"/><Metric value={String(review.business.proposalsSent)} label="Proposals sent"/><Metric value={`${review.business.trackedHours.toFixed(1)} h`} label="Tracked project hours"/><Metric value={String(review.business.scopeCreep)} label="Scope changes approved"/><Metric value={String(review.business.dealsWon)} label="Deals won"/><Metric value={String(review.business.dealsLost)} label="Deals lost"/></div>{Object.entries(review.business.currencies).map(([currency, values]) => <div className="metric-ledger metric-ledger--four" key={currency}><Metric value={`${values.received.toLocaleString()} ${currency}`} label="Received"/><Metric value={`${values.outstanding.toLocaleString()} ${currency}`} label="Outstanding"/><Metric value={`${values.overdue.toLocaleString()} ${currency}`} label="Overdue"/><Metric value={`${values.pipeline.toLocaleString()} ${currency}`} label="Open pipeline"/></div>)}</section> : null}
      {review.founder ? <section className="data-surface weekly-business-review"><p className="eyebrow">Para Officinal</p><div className="metric-ledger metric-ledger--four"><Metric value={String(review.founder.orders)} label="Orders"/><Metric value={String(review.founder.failedProductionDeployments)} label="Failed production deployments"/><Metric value={String(review.founder.incidents)} label="Incidents"/><Metric value={String(review.founder.supportCases)} label="Support cases"/><Metric value={String(review.founder.aiRequests)} label="AI requests"/><Metric value={String(review.founder.aiFailures)} label="AI failures"/>{review.founder.funnel ? <><Metric value={String(review.founder.funnel.sessions)} label="Sessions"/><Metric value={review.founder.funnel.conversion == null ? "—" : `${(review.founder.funnel.conversion * 100).toFixed(1)}%`} label="Conversion"/></> : null}</div>{Object.entries(review.founder.revenue).map(([currency, revenue]) => <Metric key={currency} value={`${revenue.toLocaleString()} ${currency}`} label="Revenue"/>)}</section> : null}
      {review.life ? <section className="data-surface weekly-business-review"><p className="eyebrow">Personal</p><div className="metric-ledger metric-ledger--four"><Metric value={String(review.life.renewalsDue)} label="Renewals due"/><Metric value={String(review.life.documentsNeedingAttention)} label="Documents needing attention"/><Metric value={String(review.life.adminCompleted)} label="Admin completed"/><Metric value={String(review.life.fitnessSessions)} label="Fitness sessions"/><Metric value={String(review.life.routinesActive)} label="Active routines"/><Metric value={String(review.life.routineCompletions)} label="Routine completions"/></div>{review.life.upcomingTrips.length ? <div className="signal-stack">{review.life.upcomingTrips.map((trip) => <Link className="signal-row" href={`/travel/${trip.id}`} key={trip.id}><span><strong>{trip.title}</strong>{trip.start_date ? `Starts ${trip.start_date}` : "Dates to plan"}</span></Link>)}</div> : <p className="dataset-note">No upcoming trips recorded.</p>}</section> : null}
      {review.strategy ? <section className="data-surface weekly-business-review"><p className="eyebrow">Strategy</p><div className="metric-ledger metric-ledger--four"><Metric value={String(review.strategy.planned)} label="Commitments planned"/><Metric value={String(review.strategy.completed)} label="Commitments completed"/><Metric value={String(review.strategy.moved)} label="Carried forward"/><Metric value={String(review.strategy.dropped)} label="Dropped"/><Metric value={String(review.strategy.milestonesReached)} label="Milestones reached"/><Metric value={review.strategy.capacity.replaceAll("_"," ")} label="Capacity"/></div><p className="dataset-note">{review.strategy.mainBlocker ? `Main blocker: ${review.strategy.mainBlocker}` : "No recorded strategic blocker this week."}</p></section> : null}
      {review.knowledge ? <section className="data-surface weekly-business-review"><p className="eyebrow">Knowledge</p><div className="metric-ledger metric-ledger--four"><Metric value={String(review.knowledge.activeTopics)} label="Active topics"/><Metric value={String(review.knowledge.newFindings)} label="New findings this week"/><Metric value={String(review.knowledge.staleSources)} label="Stale sources"/><Metric value={String(review.knowledge.openQuestions)} label="Open questions"/><Metric value={String(review.knowledge.watchesDue)} label="Watches due"/></div></section> : null}
      <div className="editorial-split">
        <section>
          <p className="eyebrow">Interpretation</p>
          {review.insights.length ? (
            review.insights.map((item) => (
              <h2 className="review-statement" key={item}>
                {item}
              </h2>
            ))
          ) : (
            <p className="dataset-note">
              More recorded activity will produce a stronger interpretation.
            </p>
          )}
          <p className="eyebrow intelligence-section-label">Focus allocation</p>
          {review.allocation.map((item) => (
            <div className="allocation-row" key={item.id}>
              <span>
                <strong>{item.name}</strong>
                <small>{minutesLabel(item.minutes)}</small>
              </span>
              <i>
                <b style={{ width: `${item.share}%` }} />
              </i>
              <em>{item.share}%</em>
            </div>
          ))}
        </section>
        <aside>
          <p className="eyebrow">Next week</p>
          {review.recommendations.map((item) => (
            <Link className="brief-item" href={item.route} key={item.key}>
              <strong>{item.label}</strong>
              <p>{item.reason}</p>
            </Link>
          ))}
          <p className="eyebrow intelligence-section-label">Unfinished</p>
          {review.unfinished.map((item) => (
            <Link
              className="brief-item"
              href={`/tasks/${item.id}`}
              key={item.id}
            >
              <strong>{item.title}</strong>
              <p>Due {item.dueDate}</p>
            </Link>
          ))}
        </aside>
      </div>
    </div>
  );
}

type Evening = {
  completed: number;
  planned: number;
  focusMinutes: number;
  projectsTouched: Row[];
  meetings: Row[];
  notes: Row[];
  decisions: Row[];
  moneyReceived: number;
  contentProgressed: number;
  fitness: Row[];
  carryOver: Row[];
};
export function EveningReviewPage() {
  const [review, setReview] = useState<Evening | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [carry, setCarry] = useState<string[]>([]);
  const [form, setForm] = useState({
    wentWell: "",
    needsAttention: "",
    capture: "",
  });
  const { showToast } = useToast();
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/intelligence/review/evening", {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setReview(body.review);
      setCarry(
        body.saved?.carry_over_task_ids ??
          body.review.carryOver.map((item: Row) => item.id),
      );
      setForm({
        wentWell: body.saved?.went_well ?? "",
        needsAttention: body.saved?.needs_attention ?? "",
        capture: body.saved?.capture ?? "",
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Review unavailable.",
      );
    }
  }, []);
  useDeferredEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/intelligence/review/evening", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, carryOverTaskIds: carry }),
    });
    setSaving(false);
    showToast(
      response.ok
        ? "Evening review saved."
        : "Evening review could not be saved.",
      response.ok ? "success" : "error",
    );
  }
  if (error) return <Failure message={error} retry={() => void load()} />;
  if (!review) return <Loading label="Looking back at today" />;
  return (
    <div className="intelligence-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Evening review</p>
          <h1>Close the loop.</h1>
          <p>
            {review.completed} of {review.planned} planned items completed ·{" "}
            {minutesLabel(review.focusMinutes)} focused ·{" "}
            {review.meetings.length} meetings.
          </p>
        </div>
      </header>
      <section className="metric-ledger metric-ledger--four">
        <Metric
          value={String(review.projectsTouched.length)}
          label="Projects touched"
        />
        <Metric
          value={`${review.moneyReceived.toLocaleString()} MAD`}
          label="Money received"
        />
        <Metric
          value={String(review.contentProgressed)}
          label="Content progressed"
        />
        <Metric
          value={String(review.fitness.length)}
          label="Fitness sessions"
        />
      </section>
      <form className="review-form" noValidate onSubmit={save}>
        <label>
          What moved forward?
          <textarea className="resize-none"
            value={form.wentWell}
            onChange={(event) =>
              setForm({ ...form, wentWell: event.target.value })
            }
          />
        </label>
        <label>
          What got stuck?
          <textarea className="resize-none"
            value={form.needsAttention}
            onChange={(event) =>
              setForm({ ...form, needsAttention: event.target.value })
            }
          />
        </label>
        <label>
          Anything important to capture?
          <textarea className="resize-none"
            value={form.capture}
            onChange={(event) =>
              setForm({ ...form, capture: event.target.value })
            }
          />
        </label>
        <fieldset>
          <legend>Move to tomorrow</legend>
          {review.carryOver.map((task) => (
            <label className="carry-option" key={task.id}>
              <input
                type="checkbox"
                checked={carry.includes(task.id)}
                onChange={(event) =>
                  setCarry((current) =>
                    event.target.checked
                      ? [...current, task.id]
                      : current.filter((id) => id !== task.id),
                  )
                }
              />
              <span>{String(task.title)}</span>
            </label>
          ))}
        </fieldset>
        <Button type="submit" intent="brand" disabled={saving}>
          {saving ? "Saving…" : "Save review"}
        </Button>
      </form>
    </div>
  );
}

type MemoryItem = Row & {
  memory_type: string;
  title: string;
  summary: string;
  confidence: number;
  source_route?: string | null;
  source_entity_type?: string | null;
};
export function MemoryPage() {
  const [items, setItems] = useState<MemoryItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    memoryType: "fact",
    title: "",
    summary: "",
  });
  const { showToast } = useToast();
  const load = useCallback(async (search = "") => {
    try {
      const response = await fetch(
        `/api/intelligence/memory?query=${encodeURIComponent(search)}`,
        { cache: "no-store" },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setItems(body.items);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Memory unavailable.",
      );
    }
  }, []);
  useDeferredEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  async function create(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const response = await fetch(editingId ? `/api/intelligence/memory/${editingId}` : "/api/intelligence/memory", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (response.ok) {
      setForm({ ...form, title: "", summary: "" });
      setEditingId(null);
      await load(query);
      showToast(editingId ? "Memory updated." : "Memory saved.");
    } else showToast("Memory could not be saved.", "error");
  }
  async function action(id: string, value: "archive" | "outdated") {
    const response = await fetch(`/api/intelligence/memory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: value }),
    });
    if (response.ok) {
      await load(query);
      showToast(
        value === "archive" ? "Memory archived." : "Memory marked outdated.",
      );
    } else showToast("Memory could not be updated.", "error");
  }
  if (error) return <Failure message={error} retry={() => void load(query)} />;
  if (!items) return <Loading label="Loading sourced memory" />;
  return (
    <div className="intelligence-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Structured memory</p>
          <h1>What the system knows.</h1>
          <p>
            User-owned context, with confidence and a path back to its source.
          </p>
        </div>
      </header>
      <div className="editorial-split">
        <section>
          <div className="domain-toolbar">
            <input
              aria-label="Search memory"
              placeholder="Search memory…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                void load(event.target.value);
              }}
            />
          </div>
          {items.length ? (
            <div className="memory-list">
              {items.map((item) => (
                <article className="memory-row" key={item.id}>
                  <span>{item.memory_type.replaceAll("_", " ")}</span>
                  <div>
                    <h2>{item.title}</h2>
                    <p>{item.summary}</p>
                    <small>
                      {Number(item.confidence) <= 0
                        ? "Outdated"
                        : Number(item.confidence) < 0.6
                          ? "Limited evidence"
                          : Number(item.confidence) < 0.85
                            ? "Moderate evidence"
                            : "Strong evidence"}
                      {item.source_entity_type
                        ? ` · Source: ${item.source_entity_type}`
                        : " · No source attached"}
                    </small>
                  </div>
                  <div>
                    {item.source_route ? (
                      <Link href={item.source_route}>View source</Link>
                    ) : null}
                    <button onClick={() => { setEditingId(item.id); setForm({ memoryType: item.memory_type, title: item.title, summary: item.summary }); }}>
                      Edit
                    </button>
                    <button onClick={() => void action(item.id, "outdated")}>
                      Outdated
                    </button>
                    <button onClick={() => void action(item.id, "archive")}>
                      Archive
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span>∅</span>
              <h2>No structured memory yet</h2>
              <p>Add only durable context you want the system to use.</p>
            </div>
          )}
        </section>
        <aside>
          <p className="eyebrow">{editingId ? "Edit memory" : "Add memory"}</p>
          <form className="simple-form" noValidate onSubmit={create}>
            <label>
              Type
              <select
                value={form.memoryType}
                onChange={(event) =>
                  setForm({ ...form, memoryType: event.target.value })
                }
              >
                {[
                  "fact",
                  "preference",
                  "project_context",
                  "client_context",
                  "decision",
                  "pattern",
                  "routine",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input
                required
                maxLength={240}
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />
            </label>
            <label>
              Summary
              <textarea className="resize-none"
                required
                maxLength={10000}
                value={form.summary}
                onChange={(event) =>
                  setForm({ ...form, summary: event.target.value })
                }
              />
            </label>
            <Button type="submit" intent="brand" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Update memory" : "Save memory"}
            </Button>
            {editingId ? <Button emphasis="ghost" onClick={() => { setEditingId(null); setForm({ memoryType: "fact", title: "", summary: "" }); }}>Cancel</Button> : null}
          </form>
          <p className="dataset-note">
            Source links can be attached through the API and future entity
            actions. Low-confidence or outdated memory is never treated as
            certain.
          </p>
        </aside>
      </div>
    </div>
  );
}

export function MeetingBriefPage({ id }: { id: string }) {
  const [brief, setBrief] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/intelligence/meeting/${id}`, {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setBrief(body.brief);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Brief unavailable.");
    }
  }, [id]);
  useDeferredEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  if (error) return <Failure message={error} retry={() => void load()} />;
  if (!brief) return <Loading label="Preparing the meeting brief" />;
  const event = brief.event as Row;
  const client = brief.client as Row | null;
  const project = brief.project as Row | null;
  const section = (label: string, rows: Row[], field = "title") => (
    <section>
      <p className="eyebrow">{label}</p>
      {rows.length ? (
        rows.map((row) => (
          <div className="brief-item" key={row.id}>
            <strong>{String(row[field] ?? row.name ?? label)}</strong>
            <p>{String(row.status ?? row.due_date ?? row.updated_at ?? "")}</p>
          </div>
        ))
      ) : (
        <p className="dataset-note">Nothing linked.</p>
      )}
    </section>
  );
  return (
    <div className="intelligence-page">
      <Link className="back-link" href="/calendar">
        ← Back to calendar
      </Link>
      <header className="page-header">
        <div>
          <p className="eyebrow">
            Meeting brief · {String(brief.evidenceQuality)} evidence
          </p>
          <h1>{String(event.title)}</h1>
          <p>
            {client ? String(client.name) : "No client linked"}
            {project ? ` · ${String(project.name)}` : ""}
          </p>
        </div>
      </header>
      {brief.caveat ? (
        <p className="inline-notice">{String(brief.caveat)}</p>
      ) : null}
      <div className="meeting-grid">
        {section("Open tasks", brief.openTasks as Row[])}
        {section("Waiting", brief.waiting as Row[])}
        {section("Invoices", brief.invoices as Row[], "invoice_number")}
        {section("Recent notes", brief.notes as Row[])}
        {section("Decisions", brief.decisions as Row[])}
        {section("Content", brief.content as Row[])}
        <section>
          <p className="eyebrow">Recommended questions</p>
          <ol>
            {(brief.questions as string[]).map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ol>
        </section>
      </div>
      <div className="hero-actions">
        {new Date(String(event.ends_at)).getTime() <= Date.now() ? <Link
          className="button button--outline button--neutral"
          href={`/meeting/${id}/capture`}
        >
          Capture meeting outcome
        </Link> : null}
        <Link className="button button--ghost button--neutral" href="/tasks">
          Add task
        </Link>
        <Link
          className="button button--ghost button--neutral"
          href="/followups"
        >
          Add follow-up
        </Link>
        <Link className="button button--ghost button--neutral" href="/decisions">
          Log decision
        </Link>
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

type EntitySignal = {
  health: {
    state: string;
    reasons: string[];
    focusMinutesThisWeek?: number;
    upcomingMilestone?: Row | null;
  } | null;
  nextAction: Recommendation | null;
  risks: Risk[];
};
export function EntityIntelligence({
  type,
  id,
}: {
  type: "project" | "client";
  id: string;
}) {
  const [signal, setSignal] = useState<EntitySignal | null>(null);
  const load = useCallback(async () => {
    const response = await fetch(`/api/intelligence/entity/${type}/${id}`, {
      cache: "no-store",
    });
    if (response.ok) setSignal(await response.json());
  }, [type, id]);
  useDeferredEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  if (!signal?.health) return null;
  return (
    <section className="entity-intelligence">
      <p className="eyebrow">Current state</p>
      <div className="entity-intelligence__grid">
        <div>
          <span className="status status--blue">{signal.health.state}</span>
          <h2>{signal.nextAction?.label ?? "No urgent action required"}</h2>
          <p>{signal.nextAction?.reason ?? signal.health.reasons[0]}</p>
          {signal.nextAction ? (
            <Link
              className="button button--outline button--neutral"
              href={signal.nextAction.route}
            >
              Take next action
            </Link>
          ) : null}
        </div>
        <aside>
          <strong>Why</strong>
          <ul>
            {signal.health.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          {type === "project" ? (
            <>
              <strong>Focus this week</strong>
              <p>{minutesLabel(signal.health.focusMinutesThisWeek ?? 0)}</p>
              <strong>Upcoming milestone</strong>
              <p>
                {signal.health.upcomingMilestone
                  ? String(signal.health.upcomingMilestone.name)
                  : "No upcoming milestone"}
              </p>
            </>
          ) : null}
          {signal.risks.length ? (
            <Link href="/risks">
              {signal.risks.length} related risk
              {signal.risks.length === 1 ? "" : "s"} →
            </Link>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
