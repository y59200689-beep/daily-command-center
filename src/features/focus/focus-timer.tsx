"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Ban, BarChart3, Check, CheckCircle2, ChevronRight, Clock3, FileText, Folder, Lightbulb, Maximize2, MoreHorizontal, Pause, Play, Plus, SkipForward, Timer, Target } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import "./focus-timer.css";

type Task = Record<string, unknown> & { id: string };
type RecentSession = { id: string; started_at: string; duration_seconds: number | null; tasks: { title: string } | null; projects?: { name: string } | null };
type Project = { id: string; name: string; description?: string };

export function FocusTimer() {
  const params = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [task, setTask] = useState<Task | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [duration, setDuration] = useState("90");
  const durationCustomized = useRef(false);
  const [recent, setRecent] = useState<RecentSession[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [newStep, setNewStep] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notesExpanded, setNotesExpanded] = useState(false);

  const load = useCallback(() => {
    if (sessionId) return;
    const controller = new AbortController();
    async function fetchWorkspace() {
      setLoading(true); setError("");
      try {
        const response = await fetch("/api/focus", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        let selectedTask = (data.tasks as Task[]).find(item => item.id === params.get("task")) ?? null;
        const projectId = params.get("project");
        if (!selectedTask && !projectId && !params.has("task")) {
          const todayResponse = await fetch("/api/today", { cache: "no-store", signal: controller.signal });
          if (todayResponse.ok) {
            const today = await todayResponse.json();
            selectedTask = data.tasks.find((item: Task) => item.id === today.priorities?.[0]?.id) ?? null;
          }
        }
        if (controller.signal.aborted) return;
        setTasks(data.tasks); setProjects(data.projects); setRecent(data.sessions);
        setTask(selectedTask);
        setProject(data.projects.find((item: Project) => item.id === (selectedTask?.project_id ?? projectId)) ?? null);
        if (!durationCustomized.current) setDuration(String(Number(selectedTask?.estimated_minutes) || 90));
        setSeconds(0); setNotes(""); setAdding(false); setNewStep("");
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Focus workspace could not be loaded.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void fetchWorkspace();
    return () => controller.abort();
  }, [params, sessionId]);
  useDeferredEffect(load);
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const elapsed = seconds;
    const interval = window.setInterval(() => setSeconds(elapsed + Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(interval);
    // Capture the elapsed time only when the session starts/resumes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function choose(taskId: string, projectId: string) {
    const query = new URLSearchParams();
    if (taskId) query.set("task", taskId);
    else if (projectId) query.set("project", projectId);
    else query.set("task", "");
    router.replace(`/focus?${query}`, { scroll: false });
  }
  const progressTasks = project ? tasks.filter(item => item.project_id === project.id && item.status !== "cancelled") : task ? tasks.filter(item => item.parent_task_id === task.id && item.status !== "cancelled") : [];
  async function updateProgress(item: Task, completed: boolean) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/entities/tasks/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: completed ? "completed" : "in_progress", completed_at: completed ? new Date().toISOString() : null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTasks(current => current.map(row => row.id === item.id ? data.record : row));
      if (task?.id === item.id) setTask(data.record);
      showToast(completed ? "Task completed." : "Task reopened.", "success");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Task progress could not be saved."); }
    finally { setBusy(false); }
  }
  async function addTask() {
    if (!newStep.trim() || (!task && !project)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/entities/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newStep.trim(), status: "planned", project_id: project?.id ?? null, ...(!project && task ? { parent_task_id: task.id } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTasks(current => [...current, data.record]); setNewStep(""); setAdding(false);
      showToast("Task added.", "success");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Task could not be added."); }
    finally { setBusy(false); }
  }

  async function toggle() {
    if (running) { setRunning(false); return; }
    if (!task && !project) return;
    if (!sessionId) {
      setBusy(true); setError("");
      try {
        const response = await fetch("/api/focus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: task?.id, projectId: project?.id }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setSessionId(data.sessionId);
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Session could not be started."); setBusy(false); return; }
      setBusy(false);
    }
    setRunning(true);
  }
  async function finish(status: "completed" | "blocked" | "skipped") {
    if (!sessionId) { if (status === "skipped") router.push("/today"); return; }
    setBusy(true); setRunning(false); setError("");
    try {
      const response = await fetch("/api/focus", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, durationSeconds: seconds, notes, taskStatus: status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      showToast(task && status === "completed" ? "Task completed. Focus session saved." : task && status === "blocked" ? "Task marked blocked. Focus session saved." : "Focus session saved.", status === "blocked" ? "warning" : "success");
      router.push("/today");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Focus session could not be saved."); setBusy(false); }
  }
  const validDuration = Number.isInteger(Number(duration)) && Number(duration) >= 1 && Number(duration) <= 1440;
  const estimate = validDuration ? Number(duration) : 90;
  const progress = Math.min(100, seconds / (estimate * 60) * 100);
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  const startLabel = !sessionId ? "Start session" : running ? "Pause session" : "Resume session";
  const priority = String(task?.priority ?? "Priority").replaceAll("_", " ");
  const completedSteps = progressTasks.filter(item => item.status === "completed").length;
  const progressPercent = progressTasks.length ? Math.round(completedSteps / progressTasks.length * 100) : 0;
  const recentLabel = useMemo(() => recent.length === 1 ? "1 recent session" : `${recent.length} recent sessions`, [recent.length]);

  return <div className="focus-experience">
    <div className="focus-experience__top"><Link href="/today"><ArrowLeft size={18}/> Return to today</Link></div>
    <div className="focus-experience__setup" aria-label="Session setup">
      <label>Project<select value={project?.id ?? ""} disabled={loading || busy || !!sessionId} onChange={event => choose("", event.target.value)}><option value="">Choose a project</option>{projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Task<select value={task?.id ?? ""} disabled={loading || busy || !!sessionId} onChange={event => choose(event.target.value, project?.id ?? "")}><option value="">{project ? "Focus on the whole project" : "Choose a task"}</option>{tasks.filter(item => (!project || item.project_id === project.id) && (!["completed", "cancelled"].includes(String(item.status)) || item.id === task?.id)).map(item => <option key={item.id} value={item.id}>{String(item.title)}</option>)}</select></label>
      <label>Duration (minutes)<input type="number" min="1" max="1440" step="1" value={duration} disabled={busy || !!sessionId} aria-invalid={!validDuration} aria-describedby="focus-setup-help" onChange={event => { durationCustomized.current = true; setDuration(event.target.value); }}/></label>
      <div className="focus-experience__presets" aria-label="Duration presets">{[25,45,60,90].map(value => <button key={value} disabled={busy || !!sessionId} aria-pressed={duration === String(value)} onClick={() => { durationCustomized.current = true; setDuration(String(value)); }}>{value} min</button>)}</div>
      <p id="focus-setup-help">{loading ? "Loading your tasks and projects…" : !validDuration ? "Enter a whole number from 1 to 1,440 minutes." : sessionId ? "Finish this session before choosing another task, project, or duration." : "Choose a project, a task, or both. Set the time you want to focus."}</p>
    </div>
    <div className="focus-experience__main">
      <section className="focus-experience__stage" aria-label="Focus session">
        <span className="focus-experience__pill"><span/> Focus session</span>
        <p className="focus-experience__eyebrow">{task ? `${priority} · ${String(task.status ?? "inbox").replaceAll("_", " ")}` : project ? "Project focus" : "Choose your focus"}</p>
        <h1>{task ? String(task.title) : project?.name ?? "Nothing selected yet"}</h1>
        <p className="focus-experience__subtitle">{task ? String(task.description || "Give this task your full attention.") : project ? project.description || "Give this project your full attention." : "Choose a task or project above, then begin a focus session."}</p>
        {error && <p className="focus-experience__error" role="alert">{error}</p>}
        <div className="focus-experience__timer" role="timer" aria-label={`${mins} minutes and ${secs} seconds elapsed`} style={{ "--focus-progress": `${progress}%` } as React.CSSProperties}>
          <div className="focus-experience__timer-inner"><Timer size={25}/><strong>{mins}:{secs}</strong><span>{Math.max(0, estimate - Math.floor(seconds / 60))} minutes remaining<br/>of {estimate}</span></div>
        </div>
        <div className="focus-experience__actions">
          <button className="focus-experience__primary" onClick={() => void toggle()} disabled={(!task && !project) || busy || loading || !validDuration}>{running ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}{startLabel}</button>
          <button onClick={() => void finish("completed")} disabled={!sessionId || busy}><Check size={18}/> {task ? "Complete" : "Finish session"}</button>
          <button onClick={() => void finish("blocked")} disabled={!task || !sessionId || busy}><Ban size={18}/> Blocked</button>
          <button onClick={() => void finish("skipped")} disabled={busy}><SkipForward size={18}/> Skip</button>
        </div>
      </section>
      <aside className="focus-experience__rail">
        <section className={`focus-experience__card focus-experience__notes ${notesExpanded ? "is-expanded" : ""}`}><header><span className="focus-experience__icon"><FileText size={20}/></span><h2>Session notes</h2><button aria-label={notesExpanded ? "Collapse notes" : "Expand notes"} onClick={() => setNotesExpanded(value => !value)}><Maximize2 size={17}/></button></header><label className="sr-only" htmlFor="focus-note">Session notes</label><textarea className="resize-none" id="focus-note" maxLength={5000} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Keep the thought here without leaving focus..."/><footer><Check size={17}/><span>Notes saved when you finish</span></footer></section>
        <section className="focus-experience__card focus-experience__tips"><header><span className="focus-experience__icon"><Lightbulb size={21}/></span><h2>Focus tips</h2></header><ul><li>Turn on Do Not Disturb</li><li>Close unnecessary tabs</li><li>Take a 5 min break after the session</li></ul></section>
      </aside>
    </div>
    <div className="focus-experience__cards">
      <section className="focus-experience__card focus-experience__progress"><header><span className="focus-experience__icon"><CheckCircle2 size={21}/></span><h2>{project ? "Project task progress" : "Task progress"}</h2><b>{progressPercent}%</b></header>
        <p className="focus-experience__progress-context">{project ? <Link href={`/projects/${project.id}`}>{project.name}</Link> : task ? String(task.title) : "Choose a task or project to see progress."}</p>
        <div className="focus-experience__progress-track" role="progressbar" aria-label="Task completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}><i style={{ width: `${progressPercent}%` }}/></div>
        {progressTasks.length ? <><p className="focus-experience__progress-context">{completedSteps} of {progressTasks.length} tasks completed</p><ul>{progressTasks.map(item => <li key={item.id}><label><input type="checkbox" disabled={busy} checked={item.status === "completed"} onChange={event => void updateProgress(item, event.target.checked)}/><span>{String(item.title)}</span></label><Link href={`/tasks?task=${item.id}`} aria-label={`Open ${String(item.title)}`}><ChevronRight size={16}/></Link></li>)}</ul></> : <p className="focus-experience__progress-context">{project ? "No tasks in this project yet." : task ? "No subtasks yet. Add the next step for this task." : "Your linked tasks will appear here."}</p>}
        {adding ? <form noValidate className="focus-experience__add-form" onSubmit={event => { event.preventDefault(); void addTask(); }}><input autoFocus aria-label={project ? "New project task" : "New subtask"} maxLength={240} disabled={busy} value={newStep} onChange={event => setNewStep(event.target.value)} placeholder="Add a task"/><button disabled={busy || !newStep.trim()} type="submit">Add</button><button disabled={busy} type="button" onClick={() => setAdding(false)}>Cancel</button></form> : <button className="focus-experience__add" disabled={(!task && !project) || busy || loading} onClick={() => setAdding(true)}><Plus size={18}/> {project ? "Add project task" : "Add subtask"}</button>}
      </section>
      <section className="focus-experience__card focus-experience__details"><header><span className="focus-experience__icon"><Clock3 size={21}/></span><h2>Session details</h2><MoreHorizontal size={19}/></header><dl><div><dt><Timer size={17}/> Focus duration</dt><dd>{estimate} minutes</dd></div><div><dt><BarChart3 size={17}/> Time remaining</dt><dd>{Math.max(0, estimate - Math.floor(seconds / 60))} minutes</dd></div><div><dt><Target size={17}/> Today&apos;s goal</dt><dd>1 focus session</dd></div><div><dt><Clock3 size={17}/> Started</dt><dd>{sessionId ? "In progress" : "Not started"}</dd></div></dl></section>
      <section className="focus-experience__card focus-experience__project"><header><span className="focus-experience__icon"><Folder size={21}/></span><h2>Linked project</h2><MoreHorizontal size={19}/></header>{project ? <div className="focus-experience__project-box"><div><span><Folder size={24}/></span><div><strong>{project.name}</strong><p>{project.description || "Your work, connected to this focus session."}</p></div></div><Link href={`/projects/${project.id}`}>Open project <ChevronRight size={17}/></Link></div> : <div className="focus-experience__project-empty"><Folder size={25}/><p>No project selected</p><Link href={task ? `/tasks?task=${task.id}` : "/tasks"}>View task <ChevronRight size={16}/></Link></div>}</section>
      <section className="focus-experience__card focus-experience__recent"><header><span className="focus-experience__icon"><BarChart3 size={21}/></span><h2>Recent sessions</h2><MoreHorizontal size={19}/></header>{recent.length ? <ul aria-label={recentLabel}>{recent.slice(0, 3).map(item => <li key={item.id}><span><Clock3 size={16}/></span><div><strong>{item.tasks?.title || item.projects?.name || "Focus session"}</strong><small>{new Date(item.started_at).toLocaleDateString([], { month: "short", day: "numeric" })} · {Math.max(1, Math.round((item.duration_seconds ?? 0) / 60))} min</small></div></li>)}</ul> : <div className="focus-experience__recent-empty"><span><BarChart3 size={34}/></span><strong>No recent sessions</strong><p>Your focus sessions will appear here to track your progress.</p></div>}</section>
    </div>
  </div>;
}
