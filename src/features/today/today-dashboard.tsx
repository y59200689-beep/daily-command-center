"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast-provider";
import { minutesLabel } from "@/lib/utils";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import { subscribeToWorkspaceMutations } from "@/lib/workspace-mutations";

type Item = Record<string, unknown> & { id: string };
type Insight = {
  id: string;
  severity: string;
  title: string;
  message: string;
  action_label: string;
  action_route: string;
};
type Recommendation = {
  key: string;
  actionType: string;
  entityType: string;
  entityId: string;
  label: string;
  reason: string;
  route: string;
  priority: number;
  evidence: Array<{ label: string }>;
};
type Intelligence = {
  mode: string;
  headline: string;
  summary: string;
  attentionQueue: Recommendation[];
  capacity: {
    availableFocusMinutes: number;
    overcommittedMinutes: number;
    insight: string;
  };
  finance: { expectedThisWeek: number; overdueAmount: number; renewalsNext7Days: number; insights: string[] };
  content: { stuckInReview: number; dueSoon: number; scheduledNext7Days: number; insights: string[] };
  fitness: { insights: string[] };
};
type TodayData = {
  date: string;
  profile: { display_name?: string; timezone?: string } | null;
  priorities: Item[];
  inboxCount: number;
  events: Item[];
  nextEvent: Item | null;
  waiting: Item[];
  waitingCount: number;
  overdueCount: number;
  projects: Item[];
  followups: Item[];
  notes: Item[];
  insights: Insight[];
  summary: string;
  calendarConflict: { id: string; title: string; conflictType: string; startsAt?: string; route: string } | null;
  businessSignals: Array<{ id: string; title: string; message: string; route: string }>;
  founderSignals: Array<{ id: string; title: string; message: string; route: string }>;
  lifeSignals: Array<{ id: string; title: string; message: string; route: string }>;
  strategicSignals: Array<{ id: string; title: string; message: string; route: string }>;
  growthSignals?: Array<{ id: string; title: string; message: string; route: string }>;
  operationsSignals?: Array<{ id: string; title: string; message: string; route: string }>;
  intelligence: Intelligence;
  modules: string[];
};
const formatTime = (value: unknown) =>
  value
    ? new Intl.DateTimeFormat("en", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(String(value)))
    : "—";
export function TodayDashboard() {
  const [data, setData] = useState<TodayData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("Priorities");
  const { showToast } = useToast();
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/today", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setData(body);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Today could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useDeferredEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(
    () =>
      subscribeToWorkspaceMutations(
        [
          "tasks",
          "inbox",
          "projects",
          "followups",
          "waiting",
          "notes",
          "calendar",
          "content",
        ],
        () => {
          void load();
        },
      ),
    [load],
  );
  async function complete(task: Item) {
    const completed = task.status === "completed";
    const response = await fetch(`/api/entities/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: completed ? "planned" : "completed",
        completed_at: completed ? null : new Date().toISOString(),
      }),
    });
    if (response.ok) {
      showToast(completed ? "Task reopened." : "Task completed.");
      await load();
    } else showToast("Task could not be updated.", "error");
  }
  if (loading)
    return (
      <div className="today-page">
        <div className="empty-state">
          <span>···</span>
          <h2>Preparing your daily brief</h2>
        </div>
      </div>
    );
  if (error || !data)
    return (
      <div className="today-page">
        <div className="empty-state">
          <span>!</span>
          <h2>Today could not be loaded</h2>
          <p>{error}</p>
          <Button emphasis="outline" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      </div>
    );
  const completed = data.priorities.filter(
    (task) => task.status === "completed",
  ).length;
  const date = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${data.date}T12:00:00`));
  const name = data.profile?.display_name?.split(" ")[0];
  const startRoute =
    data.intelligence.attentionQueue[0]?.route ??
    (data.priorities[0] ? `/focus?task=${data.priorities[0].id}` : "/tasks");
  return (
    <div className="today-page">
      <section className="brief-hero">
        <div className="brief-hero__main">
          <p className="eyebrow">
            Daily command center · {date} ·{" "}
            {data.intelligence.mode.replaceAll("_", " ")}
          </p>
          <h1>
            Your daily brief.
            <br />
            <em>{data.intelligence.headline}.</em>
          </h1>
          <p className="brief-copy">
            {name ? `${name}, ` : ""}
            {data.intelligence.summary}
          </p>
          <div className="hero-actions">
            <Link
              className="button button--solid button--brand"
              href={startRoute}
            >
              Start priority <span>→</span>
            </Link>
            <Link
              className="button button--outline button--neutral"
              href="/plan"
            >
              Plan my day
            </Link>
            <Link
              className="button button--ghost button--neutral"
              href="/assistant"
            >
              <Icons.Sparkles size={16} /> Ask assistant
            </Link>
          </div>
        </div>
        <div className="brief-hero__rail">
          <div className="now-block">
            <span className="live-dot" />{" "}
            <small>
              Available focus · {data.profile?.timezone ?? "Africa/Casablanca"}
            </small>
            <strong>
              {minutesLabel(data.intelligence.capacity.availableFocusMinutes)}
            </strong>
          </div>
          <dl className="brief-facts">
            <div>
              <dt>Next</dt>
              <dd>
                <strong>
                  {data.nextEvent ? formatTime(data.nextEvent.starts_at) : "—"}
                </strong>
                <span>
                  {data.nextEvent
                    ? String(data.nextEvent.title)
                    : "No more events"}
                </span>
              </dd>
            </div>
            <div>
              <dt>Wins</dt>
              <dd>
                <strong>{data.priorities.length - completed}</strong>
                <span>
                  {completed ? `${completed} completed` : "selected today"}
                </span>
              </dd>
            </div>
            <div>
              <dt>Waiting</dt>
              <dd>
                <strong>{data.waitingCount}</strong>
                <span>
                  {data.overdueCount
                    ? `${data.overdueCount} overdue tasks`
                    : "open loops"}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </section>
      <div className="today-tabs" role="tablist" aria-label="Today sections">
        {["Priorities", "Inbox", "Calendar", "Content radar"].map((label) => (
          <button
            role="tab"
            aria-selected={tab === label}
            onClick={() => setTab(label)}
            key={label}
          >
            {label}
            {label === "Inbox" ? <span>{data.inboxCount}</span> : null}
          </button>
        ))}
      </div>
      {tab === "Priorities" ? (
        <section className="priority-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Today’s priorities</p>
              <h2>Three wins, in order.</h2>
            </div>
            <p>
              {completed}/{data.priorities.length} complete
            </p>
          </div>
          {data.priorities.length ? (
            <div className="priority-list">
              {data.priorities.map((task, index) => (
                <article
                  className={`priority-row ${task.status === "completed" ? "priority-row--done" : ""}`}
                  key={task.id}
                >
                  <span className="priority-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <button
                    className="task-check"
                    aria-label={`${task.status === "completed" ? "Reopen" : "Complete"} ${task.title}`}
                    onClick={() => void complete(task)}
                  >
                    {task.status === "completed" ? (
                      <Icons.Check size={16} />
                    ) : null}
                  </button>
                  <div className="priority-copy">
                    <h3>{String(task.title)}</h3>
                    <p>
                      {String(task.status).replaceAll("_", " ")}{" "}
                      {task.estimated_minutes ? (
                        <>· {minutesLabel(Number(task.estimated_minutes))}</>
                      ) : null}
                    </p>
                  </div>
                  <Link className="row-action" href={`/focus?task=${task.id}`}>
                    Focus <span>→</span>
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span>01</span>
              <h2>No wins selected yet</h2>
              <p>Choose up to three tasks to give today a clear shape.</p>
              <Link
                className="button button--outline button--neutral"
                href="/tasks"
              >
                Choose from tasks
              </Link>
            </div>
          )}
        </section>
      ) : (
        <ContextTab
          tab={tab}
          count={
            tab === "Inbox"
              ? data.inboxCount
              : tab === "Calendar"
                ? data.events.length
                : tab === "Content radar"
                  ? data.insights.filter((item) =>
                      item.action_route.startsWith("/content"),
                    ).length
                  : 0
          }
        />
      )}
      {data.calendarConflict ? (
        <section className="today-conflict-signal" aria-label="Calendar conflict">
          <div>
            <p className="eyebrow">Calendar conflict</p>
            <h2>{data.calendarConflict.title}</h2>
            <p>{data.calendarConflict.conflictType === "external_deleted" ? "Deleted in Google Calendar while local changes remain." : data.calendarConflict.conflictType === "remote_changed_before_local_delete" ? "Google changed before your deletion could finish." : "Changed in both Google Calendar and Daily Command Center."}</p>
          </div>
          <Link className="button button--outline button--neutral" href={data.calendarConflict.route}>Review</Link>
        </section>
      ) : null}
      {data.businessSignals.length ? (
        <section className="today-business-signals" aria-label="Business signals">
          <div className="section-heading section-heading--small"><div><p className="eyebrow">Business</p><h2>Worth protecting</h2></div><Link href="/business">Open business</Link></div>
          {data.businessSignals.map((signal) => <Link className="brief-item" href={signal.route} key={signal.id}><strong>{signal.title}</strong><p>{signal.message}</p></Link>)}
        </section>
      ) : null}
      {data.founderSignals.length ? (
        <section className="today-business-signals" aria-label="Founder attention">
          <div className="section-heading section-heading--small"><div><p className="eyebrow">Founder attention</p><h2>Requires a decision</h2></div><Link href="/founder">Open founder</Link></div>
          {data.founderSignals.map((signal) => <Link className="brief-item" href={signal.route} key={signal.id}><strong>{signal.title}</strong><p>{signal.message}</p></Link>)}
        </section>
      ) : null}
      {data.lifeSignals.length ? (
        <section className="brief-module">
          <p className="eyebrow">Life</p>
          {data.lifeSignals.map((signal) => <Link className="brief-item" href={signal.route} key={signal.id}><strong>{signal.title}</strong><p>{signal.message}</p></Link>)}
        </section>
      ) : null}
      {data.strategicSignals.length ? (
        <section className="brief-module" aria-label="Strategic signals">
          <p className="eyebrow">Strategy</p>
          {data.strategicSignals.map((signal) => <Link className="brief-item" href={signal.route} key={signal.id}><strong>{signal.title}</strong><p>{signal.message}</p></Link>)}
        </section>
      ) : null}
      {data.growthSignals?.length ? (
        <section className="brief-module" aria-label="Growth signals">
          <div className="section-heading section-heading--small"><div><p className="eyebrow">Growth</p><h2>Opportunity signals</h2></div><Link href="/growth">Open growth</Link></div>
          {data.growthSignals.map((signal) => <Link className="brief-item" href={signal.route} key={signal.id}><strong>{signal.title}</strong><p>{signal.message}</p></Link>)}
        </section>
      ) : null}
      {data.operationsSignals?.length ? (
        <section className="brief-module" aria-label="Operations signals">
          <div className="section-heading section-heading--small"><div><p className="eyebrow">Operations</p><h2>Operational signals</h2></div><Link href="/operations">Open operations</Link></div>
          {data.operationsSignals.map((signal) => <Link className="brief-item" href={signal.route} key={signal.id}><strong>{signal.title}</strong><p>{signal.message}</p></Link>)}
        </section>
      ) : null}
      <Attention
        recommendations={data.intelligence.attentionQueue}
        onChanged={load}
      />
      <AdaptiveBrief intelligence={data.intelligence} nextEvent={data.nextEvent} projects={data.projects}/>
      <section className="today-grid">
        <div className="agenda-panel">
          <div className="section-heading section-heading--small">
            <div>
              <p className="eyebrow">Today’s calendar</p>
              <h2>Shape of the day</h2>
            </div>
            <Link href="/calendar">Open calendar</Link>
          </div>
          {data.events.length ? (
            <div className="agenda-list">
              {data.events.map((event) => (
                <div className="agenda-row" key={event.id}>
                  <div className="agenda-time">
                    <strong>{formatTime(event.starts_at)}</strong>
                    <span>{formatTime(event.ends_at)}</span>
                  </div>
                  <span className="agenda-line agenda-line--meeting" />
                  <div>
                    <h3>{String(event.title)}</h3>
                    <p>{String(event.description ?? event.timezone ?? "")}</p>
                  </div>
                  {event.id === data.nextEvent?.id ? (
                    <span className="status status--blue">Next</span>
                  ) : null}
                  {event.id === data.nextEvent?.id ? (
                    <Link
                      className="meeting-prep-link"
                      href={`/meeting/${event.id}`}
                    >
                      Prepare
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="dataset-note">No calendar events today.</p>
          )}
        </div>
        <aside className="context-panel">
          <div className="section-heading section-heading--small">
            <div>
              <p className="eyebrow">Waiting</p>
              <h2>Open loops</h2>
            </div>
            <Link href="/waiting">View all</Link>
          </div>
          {data.waiting.slice(0, 2).map((item) => (
            <div className="waiting-row" key={item.id}>
              <span className="waiting-signal" />
              <div>
                <h3>{String(item.contact ?? "Open loop")}</h3>
                <p>{String(item.title)}</p>
              </div>
              <time>
                {item.expected_by
                  ? new Date(String(item.expected_by)).toLocaleDateString()
                  : "—"}
              </time>
            </div>
          ))}
          <div className="context-rule" />
          <div className="section-heading section-heading--small">
            <div>
              <p className="eyebrow">Projects</p>
              <h2>Momentum</h2>
            </div>
          </div>
          {data.projects.slice(0, 2).map((project) => (
            <Link
              href={`/projects/${project.id}`}
              className="project-mini"
              key={project.id}
            >
              <span
                style={{ background: String(project.color ?? "#3157D5") }}
              />
              <div>
                <strong>{String(project.name)}</strong>
                <small>{String(project.description ?? "Open project")}</small>
              </div>
              <em>{String(project.progress ?? 0)}%</em>
            </Link>
          ))}
        </aside>
      </section>
      <section className="closing-strip">
        <div>
          <p className="eyebrow">Captured recently</p>
          {data.notes.slice(0, 2).map((note) => (
            <Link href={`/notes/${note.id}`} key={note.id}>
              <strong>{String(note.title)}</strong>
              <span>
                {new Date(String(note.updated_at)).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
        <div className="ai-note">
          <Icons.Sparkles size={18} />
          <p>
            <strong>Attention capacity</strong>
            <span>{data.intelligence.capacity.insight}</span>
          </p>
          <Link href="/review/evening">Evening review →</Link>
        </div>
      </section>
    </div>
  );
}
function AdaptiveBrief({ intelligence, nextEvent, projects }: { intelligence: Intelligence; nextEvent: Item | null; projects: Item[] }) {
  const rows = intelligence.mode === "finance_heavy"
    ? [{ label: "Overdue", value: `${intelligence.finance.overdueAmount.toLocaleString()} MAD` }, { label: "Expected", value: `${intelligence.finance.expectedThisWeek.toLocaleString()} MAD` }, { label: "Renewals", value: `${intelligence.finance.renewalsNext7Days.toLocaleString()} MAD` }]
    : intelligence.mode === "content_deadline"
      ? [{ label: "Due soon", value: String(intelligence.content.dueSoon) }, { label: "In review", value: String(intelligence.content.stuckInReview) }, { label: "Scheduled", value: String(intelligence.content.scheduledNext7Days) }]
      : intelligence.mode === "meeting_heavy"
        ? [{ label: "Next meeting", value: nextEvent ? String(nextEvent.title) : "Calendar clear" }, { label: "Available focus", value: minutesLabel(intelligence.capacity.availableFocusMinutes) }, { label: "Preparation", value: nextEvent ? "Brief ready" : "Not needed" }]
        : [{ label: "Focus available", value: minutesLabel(intelligence.capacity.availableFocusMinutes) }, { label: "Project momentum", value: projects[0] ? String(projects[0].name) : "No active project" }, { label: "Personal", value: intelligence.fitness.insights[0] ?? "No target pressure" }];
  return <section className="adaptive-brief"><p className="eyebrow">Today’s context · {intelligence.mode.replaceAll("_", " ")}</p><div>{rows.map((row) => <article key={row.label}><span>{row.label}</span><strong>{row.value}</strong></article>)}</div></section>;
}
function Attention({
  recommendations,
  onChanged,
}: {
  recommendations: Recommendation[];
  onChanged: () => Promise<void>;
}) {
  const [explained, setExplained] = useState<string | null>(null);
  async function feedback(
    item: Recommendation,
    action: "dismissed" | "snoozed" | "irrelevant",
  ) {
    await fetch("/api/intelligence/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        insightKey: item.key,
        insightType: item.actionType,
        entityType: item.entityType,
        entityId: item.entityId,
        action,
        ...(action === "snoozed" ? { snoozeHours: 24 } : {}),
      }),
    });
    await onChanged();
  }
  if (!recommendations.length) return null;
  return (
    <section className="attention-section">
      <div className="section-heading section-heading--small">
        <div>
          <p className="eyebrow">Needs attention</p>
          <h2>What deserves a closer look.</h2>
        </div>
        <Link href="/risks">Review risks</Link>
      </div>
      {recommendations.slice(0, 5).map((item) => (
        <article className="attention-row" key={item.key}>
          <span>{item.priority}</span>
          <div>
            <Link href={item.route}>
              <strong>{item.label}</strong>
            </Link>
            <p>{item.reason}</p>
            {explained === item.key ? (
              <ul className="recommendation-evidence">
                {item.evidence.map((evidence) => (
                  <li key={evidence.label}>{evidence.label}</li>
                ))}
              </ul>
            ) : null}
            <div className="insight-controls">
              <button
                onClick={() =>
                  setExplained(explained === item.key ? null : item.key)
                }
              >
                Why this?
              </button>
              <button onClick={() => void feedback(item, "snoozed")}>
                Snooze
              </button>
              <button onClick={() => void feedback(item, "dismissed")}>
                Dismiss
              </button>
              <button onClick={() => void feedback(item, "irrelevant")}>
                Irrelevant
              </button>
            </div>
          </div>
          <Link href={item.route}>
            <em>Act →</em>
          </Link>
        </article>
      ))}
    </section>
  );
}
function ContextTab({ tab, count }: { tab: string; count: number }) {
  const href = tab === "Content radar" ? "/content" : `/${tab.toLowerCase()}`;
  return (
    <section className="context-tab">
      <p className="eyebrow">{tab}</p>
      <h2>
        {count
          ? `${count} item${count === 1 ? "" : "s"} in view.`
          : `Nothing needs attention in ${tab.toLowerCase()}.`}
      </h2>
      <p>This view is calculated from your authenticated workspace.</p>
      <Link className="button button--outline button--neutral" href={href}>
        Open {tab.toLowerCase()}
      </Link>
    </section>
  );
}
