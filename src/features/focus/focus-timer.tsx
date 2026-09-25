"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Ban, BarChart3, Check, CheckCircle2, ChevronRight, Clock3, FileText, Folder, Lightbulb, Maximize2, MoreHorizontal, Pause, Play, Plus, SkipForward, Timer, Target } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import "./focus-timer.css";

type Task = Record<string, unknown> & { id: string };
type RecentSession = { id: string; started_at: string; duration_seconds: number | null; tasks: { title: string } | null };
const initialSteps = ["Open project workspace", "Review and organize content", "Execute main task", "Final review and wrap up"];

export function FocusTimer() {
  const params = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [task, setTask] = useState<Task | null>(null);
  const [project, setProject] = useState<{ id: string; name: string; description?: string } | null>(null);
  const [recent, setRecent] = useState<RecentSession[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [steps, setSteps] = useState(initialSteps);
  const [checked, setChecked] = useState<number[]>([]);
  const [adding, setAdding] = useState(false);
  const [newStep, setNewStep] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notesExpanded, setNotesExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      let id = params.get("task");
      if (!id) {
        const response = await fetch("/api/today", { cache: "no-store" });
        const today = await response.json();
        id = today.priorities?.[0]?.id ?? null;
      }
      if (!id) return;
      const response = await fetch(`/api/entities/tasks/${id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTask(data.record);
      try {
        const stored = localStorage.getItem(`focus-draft-${data.record.id}`);
        if (stored) { const draft = JSON.parse(stored) as { notes?: string; steps?: string[]; checked?: number[] }; setNotes(draft.notes ?? ""); setSteps(draft.steps?.length ? draft.steps : initialSteps); setChecked(draft.checked ?? []); }
      } catch {}
      if (data.record?.project_id) {
        const projectResponse = await fetch(`/api/entities/projects/${data.record.project_id}`, { cache: "no-store" });
        const projectData = await projectResponse.json();
        if (projectResponse.ok) setProject(projectData.record);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Priority could not be loaded."); }
  }, [params]);
  useDeferredEffect(useCallback(() => { void load(); }, [load]));
  useDeferredEffect(useCallback(() => {
    void fetch("/api/focus", { cache: "no-store" }).then(response => response.json()).then(data => { if (Array.isArray(data.sessions)) setRecent(data.sessions); }).catch(() => {});
  }, []));
  useEffect(() => { if (!running) return; const interval = window.setInterval(() => setSeconds(value => value + 1), 1000); return () => window.clearInterval(interval); }, [running]);
  useEffect(() => {
    if (!task) return;
    const timeout = window.setTimeout(() => { localStorage.setItem(`focus-draft-${task.id}`, JSON.stringify({ notes, steps, checked })); }, 350);
    return () => window.clearTimeout(timeout);
  }, [task, notes, steps, checked]);

  async function toggle() {
    if (running) { setRunning(false); return; }
    if (!task) return;
    if (!sessionId) {
      setBusy(true); setError("");
      try {
        const response = await fetch("/api/focus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: task.id }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setSessionId(data.sessionId);
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Session could not be started."); setBusy(false); return; }
      setBusy(false);
    }
    setRunning(true);
  }
  async function finish(status: "completed" | "blocked" | "skipped") {
    if (!task) return;
    if (!sessionId) { if (status === "skipped") router.push("/today"); return; }
    setBusy(true); setRunning(false); setError("");
    try {
      const response = await fetch("/api/focus", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, taskId: task.id, durationSeconds: seconds, notes, taskStatus: status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      localStorage.removeItem(`focus-draft-${task.id}`);
      showToast(status === "completed" ? "Task completed. Focus session saved." : status === "blocked" ? "Task marked blocked. Focus session saved." : "Focus session saved.", status === "blocked" ? "warning" : "success");
      router.push("/today");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Focus session could not be saved."); setBusy(false); }
  }
  const estimate = Math.max(1, Number(task?.estimated_minutes) || 90);
  const progress = Math.min(100, seconds / (estimate * 60) * 100);
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  const startLabel = !sessionId ? "Start session" : running ? "Pause session" : "Resume session";
  const priority = String(task?.priority ?? "Priority").replaceAll("_", " ");
  const completedSteps = checked.length;
  const recentLabel = useMemo(() => recent.length === 1 ? "1 recent session" : `${recent.length} recent sessions`, [recent.length]);

  return <div className="focus-experience">
    <div className="focus-experience__top"><Link href="/today"><ArrowLeft size={18}/> Return to today</Link></div>
    <div className="focus-experience__main">
      <section className="focus-experience__stage" aria-label="Focus session">
        <span className="focus-experience__pill"><span/> Focus session</span>
        <p className="focus-experience__eyebrow">{task ? `${priority} · ${String(task.status ?? "inbox").replaceAll("_", " ")}` : "Choose a priority"}</p>
        <h1>{task ? String(task.title) : "Nothing selected yet"}</h1>
        <p className="focus-experience__subtitle">{task ? String(task.description || "Give this task your full attention.") : "Select a daily priority from Tasks, then begin a focus session."}</p>
        {error && <p className="focus-experience__error" role="alert">{error}</p>}
        <div className="focus-experience__timer" role="timer" aria-label={`${mins} minutes and ${secs} seconds elapsed`} style={{ "--focus-progress": `${progress}%` } as React.CSSProperties}>
          <div className="focus-experience__timer-inner"><Timer size={25}/><strong>{mins}:{secs}</strong><span>{Math.max(0, estimate - Math.floor(seconds / 60))} minutes remaining<br/>of {estimate}</span></div>
        </div>
        <div className="focus-experience__actions">
          <button className="focus-experience__primary" onClick={() => void toggle()} disabled={!task || busy}>{running ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}{startLabel}</button>
          <button onClick={() => void finish("completed")} disabled={!sessionId || busy}><Check size={18}/> Complete</button>
          <button onClick={() => void finish("blocked")} disabled={!sessionId || busy}><Ban size={18}/> Blocked</button>
          <button onClick={() => void finish("skipped")} disabled={busy}><SkipForward size={18}/> Skip</button>
        </div>
      </section>
      <aside className="focus-experience__rail">
        <section className={`focus-experience__card focus-experience__notes ${notesExpanded ? "is-expanded" : ""}`}><header><span className="focus-experience__icon"><FileText size={20}/></span><h2>Session notes</h2><button aria-label={notesExpanded ? "Collapse notes" : "Expand notes"} onClick={() => setNotesExpanded(value => !value)}><Maximize2 size={17}/></button></header><label className="sr-only" htmlFor="focus-note">Session notes</label><textarea id="focus-note" value={notes} onChange={event => setNotes(event.target.value)} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); if (task) localStorage.setItem(`focus-draft-${task.id}`, JSON.stringify({ notes, steps, checked })); showToast("Session draft saved."); } }} placeholder="Keep the thought here without leaving focus..."/><footer><Check size={17}/><span>Draft saved on this device</span><kbd>⌘ S</kbd></footer></section>
        <section className="focus-experience__card focus-experience__tips"><header><span className="focus-experience__icon"><Lightbulb size={21}/></span><h2>Focus tips</h2></header><ul><li>Turn on Do Not Disturb</li><li>Close unnecessary tabs</li><li>Take a 5 min break after the session</li></ul></section>
      </aside>
    </div>
    <div className="focus-experience__cards">
      <section className="focus-experience__card focus-experience__progress"><header><span className="focus-experience__icon"><CheckCircle2 size={21}/></span><h2>Task progress</h2><b>{steps.length ? Math.round(completedSteps / steps.length * 100) : 0}%</b></header><div className="focus-experience__progress-track"><i style={{ width: `${steps.length ? completedSteps / steps.length * 100 : 0}%` }}/></div><ul>{steps.map((step, index) => <li key={`${step}-${index}`}><label><input type="checkbox" checked={checked.includes(index)} onChange={event => setChecked(current => event.target.checked ? [...current, index] : current.filter(item => item !== index))}/><span>{step}</span></label></li>)}</ul>{adding ? <form className="focus-experience__add-form" onSubmit={event => { event.preventDefault(); if (newStep.trim()) { setSteps(current => [...current, newStep.trim()]); setNewStep(""); setAdding(false); } }}><input autoFocus aria-label="New step" value={newStep} onChange={event => setNewStep(event.target.value)} placeholder="Add a step"/><button type="submit">Add</button></form> : <button className="focus-experience__add" onClick={() => setAdding(true)}><Plus size={18}/> Add subtask</button>}</section>
      <section className="focus-experience__card focus-experience__details"><header><span className="focus-experience__icon"><Clock3 size={21}/></span><h2>Session details</h2><MoreHorizontal size={19}/></header><dl><div><dt><Timer size={17}/> Focus duration</dt><dd>{estimate} minutes</dd></div><div><dt><BarChart3 size={17}/> Time remaining</dt><dd>{Math.max(0, estimate - Math.floor(seconds / 60))} minutes</dd></div><div><dt><Target size={17}/> Today&apos;s goal</dt><dd>1 focus session</dd></div><div><dt><Clock3 size={17}/> Started</dt><dd>{sessionId ? "In progress" : "Not started"}</dd></div></dl></section>
      <section className="focus-experience__card focus-experience__project"><header><span className="focus-experience__icon"><Folder size={21}/></span><h2>Linked project</h2><MoreHorizontal size={19}/></header>{project ? <div className="focus-experience__project-box"><div><span><Folder size={24}/></span><div><strong>{project.name}</strong><p>{project.description || "Your work, connected to this focus session."}</p></div></div><Link href={`/projects/${project.id}`}>Open project <ChevronRight size={17}/></Link></div> : <div className="focus-experience__project-empty"><Folder size={25}/><p>No project linked to this task</p><Link href={task ? `/tasks?task=${task.id}` : "/tasks"}>View task <ChevronRight size={16}/></Link></div>}</section>
      <section className="focus-experience__card focus-experience__recent"><header><span className="focus-experience__icon"><BarChart3 size={21}/></span><h2>Recent sessions</h2><MoreHorizontal size={19}/></header>{recent.length ? <ul aria-label={recentLabel}>{recent.slice(0, 3).map(item => <li key={item.id}><span><Clock3 size={16}/></span><div><strong>{item.tasks?.title || "Focus session"}</strong><small>{new Date(item.started_at).toLocaleDateString([], { month: "short", day: "numeric" })} · {Math.max(1, Math.round((item.duration_seconds ?? 0) / 60))} min</small></div></li>)}</ul> : <div className="focus-experience__recent-empty"><span><BarChart3 size={34}/></span><strong>No recent sessions</strong><p>Your focus sessions will appear here to track your progress.</p></div>}</section>
    </div>
  </div>;
}
