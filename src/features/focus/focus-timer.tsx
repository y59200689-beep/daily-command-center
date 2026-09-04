"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast-provider";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
type Task = Record<string, unknown> & {
    id: string;
};
export function FocusTimer() { const params = useSearchParams(); const [task, setTask] = useState<Task | null>(null); const [seconds, setSeconds] = useState(0); const [running, setRunning] = useState(false); const [sessionId, setSessionId] = useState<string | null>(null); const [notes, setNotes] = useState(""); const [error, setError] = useState(""); const { showToast } = useToast(); const load = useCallback(async () => { try {
    let id = params.get("task");
    if (!id) {
        const today = await fetch("/api/today", { cache: "no-store" }).then((response) => response.json());
        id = today.priorities?.[0]?.id ?? null;
    }
    if (!id)
        return;
    const response = await fetch(`/api/entities/tasks/${id}`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok)
        setTask(data.record);
    else
        throw new Error(data.error);
}
catch (reason) {
    setError(reason instanceof Error ? reason.message : "Priority could not be loaded.");
} }, [params]); useDeferredEffect(useCallback(() => { void load(); }, [load])); useEffect(() => { if (!running)
    return; const interval = window.setInterval(() => setSeconds((value) => value + 1), 1000); return () => window.clearInterval(interval); }, [running]); async function toggle() { if (running) {
    setRunning(false);
    return;
} if (!task)
    return; if (!sessionId) {
    const response = await fetch("/api/focus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: task.id }) });
    const data = await response.json();
    if (!response.ok) {
        setError(data.error);
        return;
    }
    setSessionId(data.sessionId);
} setRunning(true); } async function finish(status: "completed" | "blocked") { if (!task || !sessionId)
    return; setRunning(false); const response = await fetch("/api/focus", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, taskId: task.id, durationSeconds: seconds, notes, taskStatus: status }) }); if (response.ok) {
    showToast(status === "completed" ? "Priority completed. Focus session saved." : "Task marked blocked. Focus session saved.", status === "blocked" ? "warning" : "success");
}
else {
    const data = await response.json();
    setError(data.error);
} } const mins = String(Math.floor(seconds / 60)).padStart(2, "0"); const secs = String(seconds % 60).padStart(2, "0"); const estimate = Number(task?.estimated_minutes ?? 90); return <div className="focus-page"><div className="focus-top"><Link href="/today">← Return to today</Link><span><span className="live-dot"/> Focus session</span></div><main className="focus-stage"><p className="eyebrow">{task ? `Priority · ${String(task.status).replaceAll("_", " ")}` : "Choose a priority"}</p><h1>{task ? String(task.title) : "Nothing selected yet"}</h1><p>{task ? String(task.description ?? "Give this task your full attention.") : "Select a daily win from Tasks, then begin a focus session."}</p>{error ? <p className="field-error" role="alert">{error}</p> : null}<div className={`timer ${running ? "timer--running" : ""}`}><span>{mins}</span><i>:</i><span>{secs}</span></div><div className="focus-actions"><Button intent="brand" onClick={() => void toggle()} disabled={!task}>{running ? "Pause" : seconds ? "Resume" : "Start session"}</Button><Button emphasis="outline" onClick={() => void finish("completed")} disabled={!sessionId}>Complete</Button><Button emphasis="ghost" onClick={() => void finish("blocked")} disabled={!sessionId}>Blocked</Button></div><div className="focus-progress"><span><i style={{ width: `${Math.min(100, (seconds / (estimate * 60)) * 100)}%` }}/></span><p>{Math.max(0, estimate - Math.floor(seconds / 60))} minutes remaining of {estimate}</p></div></main><aside className="focus-notes"><p className="eyebrow">Session notes</p><label className="sr-only" htmlFor="focus-note">Session notes</label><textarea className="resize-none" id="focus-note" rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Keep the thought here without leaving focus…"/><div><Icons.Check size={15}/> Saved with the session</div></aside></div>; }
