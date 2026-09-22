"use client";
import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useRef, useState, type ReactNode } from "react";
import { AttachmentSection } from "@/components/attachment-section";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/toast-provider";
import type { DomainRecord, PersistedDomain } from "@/lib/domains";
import { normalizeOptionalNumberInput } from "@/lib/numeric-input";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import { announceWorkspaceMutation } from "@/lib/workspace-mutations";
import { CalendarConflicts } from "@/features/calendar/calendar-conflicts";
type DomainKey = PersistedDomain | "assistant" | "settings";
const attachmentEntities = { tasks: "task", projects: "project", clients: "client", notes: "note", content: "content", decisions: "decision", invoices: "invoice" } as const;
type Field = {
    key: string;
    label: string;
    type?: "text" | "textarea" | "date" | "datetime-local" | "number" | "select" | "relation";
    required?: boolean;
    options?: string[];
    relation?: "projects" | "clients" | "goals" | "campaigns" | "prompts";
};
type Config = {
    eyebrow: string;
    title: string;
    intro: string;
    action: string;
    columns: string[];
    titleField: string;
    secondary: string;
    tertiary: string;
    fields: Field[];
};
const f = (key: string, label: string, type?: Field["type"], options?: string[], required = false, relation?: Field["relation"]): Field => ({ key, label, type, options, required, relation });
const c = (eyebrow: string, title: string, intro: string, action: string, columns: string[], titleField: string, secondary: string, tertiary: string, fields: Field[]): Config => ({ eyebrow, title, intro, action, columns, titleField, secondary, tertiary, fields });
const configs: Record<DomainKey, Config> = {
    tasks: c("Execution", "Tasks", "A deliberate list of commitments—not a graveyard of good intentions.", "New task", ["Task", "Status", "Due"], "title", "status", "due_date", [f("title", "Task", "text", undefined, true), f("description", "Notes", "textarea"), f("status", "Status", "select", ["inbox", "planned", "in_progress", "waiting", "blocked", "completed", "cancelled"]), f("priority", "Priority", "select", ["none", "low", "medium", "high", "urgent"]), f("due_date", "Due date", "date")]),
    inbox: c("Triage", "Inbox", "Capture quickly, then decide what each item becomes.", "Capture", ["Captured item", "Detected as", "Captured"], "raw_text", "detected_type", "created_at", [f("raw_text", "Capture", "textarea", undefined, true), f("detected_type", "Type", "select", ["inbox", "task", "note", "idea", "decision", "follow-up"]), f("status", "Triage status", "select", ["unprocessed", "processed", "archived"])]),
    projects: c("Workspace", "Projects", "See momentum, risk, and the next meaningful move.", "New project", ["Project", "Status", "Progress"], "name", "status", "progress", [f("name", "Project name", "text", undefined, true), f("description", "Description", "textarea"), f("status", "Status", "select", ["idea", "planning", "active", "paused", "completed", "archived"]), f("progress", "Progress", "number"), f("value_amount", "Project value", "number"), f("currency", "Currency"), f("target_date", "Target date", "date")]),
    clients: c("Relationships", "Clients", "Keep promises, context, and follow-ups close together.", "New client", ["Client", "Company", "Next contact"], "name", "company", "next_follow_up_at", [f("name", "Client name", "text", undefined, true), f("company", "Company"), f("email", "Email"), f("phone", "Phone"), f("notes", "Notes", "textarea")]),
    followups: c("Relationships", "Follow-ups", "Keep every promised check-in visible.", "New follow-up", ["Follow-up", "Status", "Due"], "title", "status", "due_at", [f("title", "Follow-up", "text", undefined, true), f("due_at", "Due", "datetime-local"), f("status", "Status", "select", ["open", "done", "cancelled"]), f("notes", "Notes", "textarea")]),
    waiting: c("Open loops", "Waiting", "Know exactly where momentum depends on someone else.", "Track request", ["Waiting for", "Contact", "Expected"], "title", "contact", "expected_by", [f("title", "Waiting for", "text", undefined, true), f("contact", "Contact"), f("expected_by", "Expected by", "datetime-local"), f("status", "Status", "select", ["waiting", "received", "cancelled"]), f("notes", "Notes", "textarea")]),
    notes: c("Second brain", "Notes", "Working knowledge with context and a way back to the source.", "New note", ["Note", "Category", "Updated"], "title", "category", "updated_at", [f("title", "Title", "text", undefined, true), f("content", "Note", "textarea"), f("category", "Category")]),
    goals: c("Direction", "Goals", "Connect the week in front of you to the quarter you want.", "New goal", ["Goal", "Period", "Progress"], "title", "period", "progress", [f("title", "Goal", "text", undefined, true), f("description", "Description", "textarea"), f("period", "Period", "select", ["quarter", "month", "week"]), f("target_date", "Target date", "date"), f("progress", "Progress", "number")]),
    ideas: c("Possibilities", "Idea vault", "Interesting is enough. Ideas do not need to become obligations.", "Capture idea", ["Idea", "Potential", "State"], "title", "potential", "status", [f("title", "Idea", "text", undefined, true), f("description", "Description", "textarea"), f("potential", "Potential", "select", ["low", "medium", "high", "huge"]), f("status", "State")]),
    decisions: c("Memory", "Decision log", "Keep the why, impact, and review point—not just the outcome.", "Log decision", ["Decision", "Impact", "Review"], "title", "impact", "review_date", [f("title", "Decision title", "text", undefined, true), f("decision", "Outcome", "textarea", undefined, true), f("reasoning", "Reasoning", "textarea"), f("impact", "Impact", "select", ["low","medium","high","critical"]), f("confidence", "Confidence", "select", ["low","medium","high"]), f("status", "Status", "select", ["active","review_due","superseded","reversed","archived"]), f("decision_date", "Date", "date"), f("review_date", "Review date", "date")]),
    prompts: c("Library", "Prompts", "Reusable instructions with variables, versions, and a record of what works.", "New prompt", ["Prompt", "Category", "Uses"], "title", "category", "usage_count", [f("title", "Prompt name", "text", undefined, true), f("prompt_text", "Instructions", "textarea", undefined, true), f("category", "Category", "select", ["Coding","Marketing","Design","Image Generation","Business","Research","Writing","Other"]), f("description", "Description", "textarea"), f("rating", "Usefulness rating (1–5)", "number")]),
    invoices: c("Business pulse · MAD", "Invoices", "Track what has been billed, paid, and linked to client work.", "New invoice", ["Invoice", "Status", "Remaining"], "invoice_number", "status", "amount_remaining", [f("invoice_number", "Invoice number"), f("title", "Title", "text", undefined, true), f("description", "Description", "textarea"), f("subtotal", "Subtotal", "number", undefined, true), f("tax_amount", "Tax", "number"), f("discount_amount", "Discount", "number"), f("currency", "Currency"), f("status", "Status", "select", ["draft", "sent", "partial", "paid", "overdue", "cancelled"]), f("issue_date", "Issue date", "date"), f("due_date", "Due date", "date"), f("external_reference", "External reference"), f("notes", "Notes", "textarea")]),
    payments: c("Cash received", "Payments", "Immutable receipts recorded against an owned invoice.", "Record payment", ["Reference", "Method", "Amount"], "reference", "payment_method", "amount", [f("invoice_id","Invoice ID","text",undefined,true),f("amount","Amount","number",undefined,true),f("currency","Currency"),f("payment_date","Payment date","date",undefined,true),f("payment_method","Payment method"),f("reference","Reference"),f("notes","Notes","textarea")]),
    expenses: c("Business costs", "Expenses", "Direct and operating costs with enough context to explain cash movement.", "Add expense", ["Expense", "Category", "Amount"], "description", "category", "amount", [f("description","Description","text",undefined,true),f("category","Category","select",["Software","Hosting","Advertising","Design","Travel","Equipment","Contractors","Other"]),f("vendor","Vendor"),f("amount","Amount","number",undefined,true),f("currency","Currency"),f("expense_date","Expense date","date",undefined,true),f("recurring","Recurring","select",["false","true"]),f("receipt_url","Receipt URL"),f("notes","Notes","textarea")]),
    subscriptions: c("Recurring costs", "Subscriptions", "See the software and services that will renew next.", "Add subscription", ["Subscription", "Status", "Renews"], "name", "status", "next_billing_date", [f("name","Name","text",undefined,true),f("provider","Provider"),f("amount","Amount","number",undefined,true),f("currency","Currency"),f("billing_cycle","Billing cycle","select",["monthly","quarterly","yearly","custom"]),f("next_billing_date","Next billing date","date"),f("category","Category"),f("status","Status","select",["active","paused","cancelled"]),f("notes","Notes","textarea")]),
    campaigns: c("Creative operations", "Campaigns", "Group content around a client objective and deadline.", "New campaign", ["Campaign", "Status", "Ends"], "name", "status", "end_date", [f("name","Campaign name","text",undefined,true),f("objective","Objective","textarea"),f("start_date","Start date","date"),f("end_date","End date","date"),f("status","Status","select",["planning","active","paused","completed","archived"]),f("description","Description","textarea")]),
    finance: c("Business pulse · MAD", "Finance", "A lightweight view of cash promised, received, and spent.", "Add transaction", ["Record", "Status", "Amount"], "notes", "status", "amount", [f("type", "Type", "select", ["income", "expense", "subscription"]), f("amount", "Amount", "number", undefined, true), f("currency", "Currency"), f("occurred_on", "Date", "date", undefined, true), f("notes", "Description", "textarea", undefined, true)]),
    content: c("Publishing", "Content pipeline", "Move ideas from a promising thought to something published.", "New content", ["Content", "Stage", "Due"], "title", "status", "due_date", [f("title", "Content title", "text", undefined, true), f("creative_brief", "Creative brief", "textarea"), f("creative_direction", "Creative direction", "textarea"), f("hook", "Hook", "textarea"), f("caption", "Caption", "textarea"), f("cta", "Call to action"), f("platform", "Platform", "select", ["Instagram","Facebook","TikTok","LinkedIn","YouTube","Website","Email","Other"]), f("format", "Format"), f("status", "Stage", "select", ["idea","brief","copy","designing","review","approved","scheduled","published","archived"]), f("priority","Priority","select",["none","low","medium","high","urgent"]),f("due_date","Due date","date"),f("scheduled_at","Scheduled at","datetime-local"),f("publish_date", "Publish date", "datetime-local"),f("approval_status","Approval","select",["not_required","pending","changes_requested","approved"]),f("approved_by_name","Approved by"),f("approval_notes","Approval notes","textarea"),f("performance_notes","Performance notes","textarea")]),
    fitness: c("Personal rhythm", "Activities", "Track consistency without turning movement into accounting.", "Log activity", ["Activity", "Duration", "Date"], "activity_type", "duration_minutes", "date", [f("activity_type", "Activity", "select", ["Running","Gym","Walking","Swimming","Hiking","Cycling","Other"], true), f("date", "Date", "date", undefined, true), f("duration_minutes", "Duration (minutes)", "number"), f("distance_km", "Distance (km)", "number"), f("calories","Calories","number"),f("effort","Effort","select",["","easy","moderate","hard"]),f("source","Source"),f("notes", "Notes", "textarea")]),
    "fitness-targets": c("Weekly direction", "Fitness targets", "Set a small number of targets that make the week legible.", "Add target", ["Activity", "Measure", "Target"], "activity_type", "target_type", "target_value", [f("activity_type","Activity","select",["Running","Gym","Walking","Swimming","Hiking","Cycling","Other"],true),f("target_type","Measure","select",["sessions","distance_km","duration_minutes"]),f("target_value","Target","number",undefined,true),f("period","Period","select",["week","month"]),f("active","Active","select",["true","false"])]),
    "notification-preferences": c("Attention settings","Notification preferences","Choose which categories can enter the attention layer and how serious they must be.","Add preference",["Category","Minimum severity","Enabled"],"category","minimum_severity","enabled",[f("category","Category","select",["tasks","calendar","clients","finance","content","decisions","fitness","integrations","automations"],true),f("minimum_severity","Minimum severity","select",["low","medium","high","critical"]),f("enabled","Enabled","select",["true","false"])]),
    calendar: c("Time", "Calendar", "Give important work a real place in the day.", "New event", ["Event", "Starts", "Timezone"], "title", "starts_at", "timezone", [f("title", "Event title", "text", undefined, true), f("description", "Description", "textarea"), f("starts_at", "Starts", "datetime-local", undefined, true), f("ends_at", "Ends", "datetime-local", undefined, true), f("timezone", "Timezone"), f("recurrence_rule", "Recurrence rule")]),
    assistant: c("Workspace intelligence", "Assistant", "Ask across your commitments, context, and decisions.", "New conversation", [], "title", "status", "created_at", []),
    settings: c("System", "Settings", "Tune the command center to the way you work.", "Save changes", [], "title", "status", "created_at", [])
};
const relationshipFields: Partial<Record<DomainKey, Field[]>> = { tasks: [f("project_id", "Project", "relation", undefined, false, "projects"), f("client_id", "Client", "relation", undefined, false, "clients"), f("goal_id", "Goal", "relation", undefined, false, "goals")], projects: [f("client_id", "Client", "relation", undefined, false, "clients"), f("goal_id", "Goal", "relation", undefined, false, "goals")], followups: [f("client_id", "Client", "relation", undefined, false, "clients"), f("project_id", "Project", "relation", undefined, false, "projects")], waiting: [f("client_id", "Client", "relation", undefined, false, "clients"), f("project_id", "Project", "relation", undefined, false, "projects")], notes: [f("project_id", "Project", "relation", undefined, false, "projects"),f("client_id","Client","relation",undefined,false,"clients")], ideas: [f("project_id", "Project", "relation", undefined, false, "projects")], decisions: [f("project_id", "Project", "relation", undefined, false, "projects"),f("client_id","Client","relation",undefined,false,"clients")], prompts: [f("project_id", "Project", "relation", undefined, false, "projects"),f("client_id","Client","relation",undefined,false,"clients"),f("campaign_id","Campaign","relation",undefined,false,"campaigns")], invoices: [f("client_id", "Client", "relation", undefined, false, "clients"), f("project_id", "Project", "relation", undefined, false, "projects")], expenses: [f("client_id", "Client", "relation", undefined, false, "clients"),f("project_id", "Project", "relation", undefined, false, "projects")],subscriptions:[f("project_id","Project","relation",undefined,false,"projects")],campaigns:[f("client_id","Client","relation",undefined,true,"clients"),f("project_id","Project","relation",undefined,false,"projects")], finance: [f("client_id", "Client", "relation", undefined, false, "clients"), f("project_id", "Project", "relation", undefined, false, "projects")], content: [f("client_id", "Client", "relation", undefined, false, "clients"), f("project_id", "Project", "relation", undefined, false, "projects"),f("campaign_id","Campaign","relation",undefined,false,"campaigns"),f("prompt_id","Prompt","relation",undefined,false,"prompts")] };
configs.tasks.fields.push(f("daily_position", "Today’s win position", "select", ["", "1", "2", "3"]));
for (const [key, fields] of Object.entries(relationshipFields))
    configs[key as DomainKey].fields.push(...fields);
const emptyValues = (config: Config) => Object.fromEntries(config.fields.map((field) => [field.key, field.options?.[0] ?? (field.key === "currency" ? "MAD" : field.key === "timezone" ? "Africa/Casablanca" : "")]));
const display = (value: unknown) => value == null || value === "" ? "—" : String(value).replaceAll("_", " ");
export function DomainPage({ domain, embedded = false, onMutationSuccess, refreshToken }: {
    domain: DomainKey;
    embedded?: boolean;
    onMutationSuccess?: () => void | Promise<void>;
    refreshToken?: number;
}) {
    const config = configs[domain];
    const [records, setRecords] = useState<DomainRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("open");
    const [priorityFilter, setPriorityFilter] = useState("all");
    const [taskSort, setTaskSort] = useState("updated");
    const [taskView, setTaskView] = useState<"list" | "board">("list");
    const [calendarView, setCalendarView] = useState<"month" | "agenda">("month");
    const deferredQuery=useDeferredValue(query);
    const [page,setPage]=useState(1);
    const [total,setTotal]=useState(0);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<DomainRecord | null>(null);
    const [values, setValues] = useState<Record<string, string>>(emptyValues(config));
    const [saving, setSaving] = useState(false);
    const [archiveArmed, setArchiveArmed] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const previousRefreshToken = useRef(refreshToken);
    const { showToast } = useToast();
    const load = useCallback(async () => { if (domain === "assistant" || domain === "settings")
        return; try {
        setLoading(true);setError("");const params=new URLSearchParams({page:String(page),pageSize:"50"});if(deferredQuery.trim())params.set("q",deferredQuery.trim());if(domain==="tasks"){params.set("status",statusFilter);params.set("priority",priorityFilter);params.set("sort",taskSort)}const response = await fetch(`/api/entities/${domain}?${params}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok)
            throw new Error(data.error);
        setRecords(data.records);
        setTotal(data.total??data.records.length);
    }
    catch (reason) {
        setError(reason instanceof Error ? reason.message : "Records could not be loaded.");
    }
    finally {
        setLoading(false);
    } }, [domain,deferredQuery,page,priorityFilter,statusFilter,taskSort]);
    useDeferredEffect(useCallback(() => { void load(); }, [load]));
    useEffect(() => {
        if (previousRefreshToken.current === refreshToken) return;
        previousRefreshToken.current = refreshToken;
        void load();
    }, [load, refreshToken]);
    const rows = records;
    if (domain === "assistant")
        return <AssistantView config={config}/>;
    if (domain === "settings")
        return <SettingsView config={config}/>;
    function begin(record?: DomainRecord) { setError(""); setArchiveArmed(false); setEditing(record ?? null); setValues(record ? Object.fromEntries(config.fields.map((field) => [field.key, toInputValue(record[field.key], field.type)])) : emptyValues(config)); setOpen(true); }
    async function save(event: React.FormEvent) { event.preventDefault(); setSaving(true); setError(""); try {
        const body = Object.fromEntries(config.fields.map((field) => [field.key, normalizeInput(values[field.key], field)]).filter(([, value]) => value !== ""));
        const response = await fetch(`/api/entities/${domain}${editing ? `/${editing.id}` : ""}`, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await response.json();
        if (!response.ok)
            throw new Error(data.error);
        setRecords((current) => editing ? current.map((item) => item.id === editing.id ? data.record : item) : [data.record, ...current]);if(!editing)setTotal((current)=>current+1);
        await onMutationSuccess?.();
        if(domain!=="assistant"&&domain!=="settings")announceWorkspaceMutation(domain);
        setOpen(false);
        showToast(editing ? "Changes saved." : "Record saved.");
    }
    catch (reason) {
        setError(reason instanceof Error ? reason.message : "Record could not be saved.");
    }
    finally {
        setSaving(false);
    } }
    async function archive(record: DomainRecord) { if (!archiveArmed) { setArchiveArmed(true); showToast(`Click Archive again to confirm archiving “${display(record[config.titleField])}”.`, "warning"); return; } const response = await fetch(`/api/entities/${domain}/${record.id}`, { method: "DELETE" }); if (response.ok) {
        setRecords((current) => current.filter((item) => item.id !== record.id));
        setTotal((current)=>Math.max(0,current-1));
        await onMutationSuccess?.();
        if(domain!=="assistant"&&domain!=="settings")announceWorkspaceMutation(domain);
        setOpen(false);
        showToast("Archived.");
    }
    else {
        const data = await response.json();
        setError(data.error ?? "Record could not be archived.");
    } }
    async function toggleTask(record: DomainRecord) {
        const completed = record.status === "completed";
        const response = await fetch(`/api/entities/tasks/${record.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: completed ? "planned" : "completed", completed_at: completed ? null : new Date().toISOString() }) });
        const data = await response.json();
        if (!response.ok) { showToast(data.error ?? "Task could not be updated.", "error"); return; }
        setRecords((current) => current.map((item) => item.id === record.id ? data.record : item));
        showToast(completed ? "Task reopened." : "Task completed.");
        announceWorkspaceMutation("tasks");
    }
    async function resolveInbox(record: DomainRecord) {
        const detectedType = String(record.detected_type ?? "inbox");
        const rawText = String(record.raw_text ?? "");
        // Create the real record based on detected_type before marking as processed
        if (detectedType === "task") {
            const taskRes = await fetch("/api/entities/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: rawText, status: "inbox", priority: "none", created_by: "user" }) });
            if (!taskRes.ok) { const d = await taskRes.json(); showToast(d.error ?? "Task could not be created.", "error"); return; }
        } else if (detectedType === "note") {
            const noteRes = await fetch("/api/entities/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: rawText.slice(0, 120), content: rawText, category: "note", created_by: "user" }) });
            if (!noteRes.ok) { const d = await noteRes.json(); showToast(d.error ?? "Note could not be created.", "error"); return; }
        } else if (detectedType === "idea") {
            const ideaRes = await fetch("/api/entities/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: rawText, status: "captured" }) });
            if (!ideaRes.ok) { const d = await ideaRes.json(); showToast(d.error ?? "Idea could not be created.", "error"); return; }
        } else if (detectedType === "decision") {
            const decRes = await fetch("/api/entities/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: rawText.slice(0, 120), decision: rawText, decision_date: new Date().toISOString().slice(0, 10) }) });
            if (!decRes.ok) { const d = await decRes.json(); showToast(d.error ?? "Decision could not be created.", "error"); return; }
        } else if (detectedType === "follow-up") {
            const fuRes = await fetch("/api/entities/followups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: rawText, status: "open" }) });
            if (!fuRes.ok) { const d = await fuRes.json(); showToast(d.error ?? "Follow-up could not be created.", "error"); return; }
        }
        // Mark inbox item as processed
        const response = await fetch(`/api/entities/inbox/${record.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "processed" }) });
        const data = await response.json();
        if (!response.ok) { showToast(data.error ?? "Inbox item could not be cleared.", "error"); return; }
        setRecords((current) => current.map((item) => item.id === record.id ? data.record : item));
        const label = detectedType === "task" ? "Task created from inbox." : detectedType === "note" ? "Note created from inbox." : detectedType === "idea" ? "Idea created from inbox." : detectedType === "decision" ? "Decision created from inbox." : detectedType === "follow-up" ? "Follow-up created from inbox." : "Inbox item cleared.";
        showToast(label);
        announceWorkspaceMutation("inbox");
        if (["task", "note", "idea", "decision", "follow-up"].includes(detectedType)) {
            const mutationTarget = detectedType === "task" ? "tasks" : detectedType === "note" ? "notes" : detectedType === "idea" ? "ideas" : detectedType === "decision" ? "decisions" : "followups";
            announceWorkspaceMutation(mutationTarget);
        }
    }
    return <div className={`domain-page ${embedded ? "domain-page--embedded" : ""}`}>
        {embedded ? <div className="embedded-heading"><div><p className="eyebrow">Manage records</p><h2>{config.title}</h2></div><Button intent="brand" onClick={() => begin()}><Icons.Plus size={16}/>{config.action}</Button></div> : domain === "tasks" ? <header className="task-context-header"><div><div className="task-context-header__path"><Icons.ListTodo size={15}/><span>My work</span><Icons.ChevronRight size={13}/><strong>Tasks</strong></div><h1>Tasks</h1><p>Plan, prioritize, and move work forward.</p></div><div className="task-context-header__actions"><span className="task-total"><strong>{total}</strong> total</span><Button intent="brand" onClick={() => begin()}><Icons.Plus size={16}/>New task</Button></div></header> : <header className="task-context-header domain-context-header"><div><div className="task-context-header__path"><span>{config.eyebrow}</span><Icons.ChevronRight size={13}/><strong>{config.title}</strong></div><h1>{config.title}</h1><p>{config.intro}</p></div><div className="task-context-header__actions"><span className="task-total"><strong>{total}</strong> total</span><Button intent="brand" onClick={() => begin()}><Icons.Plus size={16}/>{config.action}</Button></div></header>}
        {domain === "calendar" ? <CalendarConflicts onEdit={begin} onResolved={load} /> : null}
        <div className={`domain-toolbar ${domain === "tasks" ? "task-toolbar" : ""}`}><SearchInput ref={inputRef} id={`${domain}-search`} label={`Search ${domain}`} value={query} onChange={(event) => {setQuery(event.target.value);setPage(1)}} onClear={() => {setQuery("");setPage(1)}} placeholder={`Search ${domain}…`}/><div className="domain-toolbar__controls">{domain === "tasks" ? <><div className="view-switch task-view-switch" aria-label="Task view"><button type="button" className={taskView === "list" ? "active" : ""} aria-pressed={taskView === "list"} onClick={() => setTaskView("list")}><Icons.ListTodo size={14}/>List</button><button type="button" className={taskView === "board" ? "active" : ""} aria-pressed={taskView === "board"} onClick={() => setTaskView("board")}><Icons.BriefcaseBusiness size={14}/>Board</button></div><label className="compact-select"><span>Status</span><select aria-label="Filter tasks by status" value={statusFilter} onChange={(event) => {setStatusFilter(event.target.value);setPage(1)}}><option value="open">Open</option><option value="all">All statuses</option><option value="inbox">Inbox</option><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="waiting">Waiting</option><option value="blocked">Blocked</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><label className="compact-select"><span>Priority</span><select aria-label="Filter tasks by priority" value={priorityFilter} onChange={(event) => {setPriorityFilter(event.target.value);setPage(1)}}><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="none">No priority</option></select></label><label className="compact-select"><span>Sort</span><select aria-label="Sort tasks" value={taskSort} onChange={(event) => {setTaskSort(event.target.value);setPage(1)}}><option value="updated">Recently updated</option><option value="due">Due date</option><option value="priority">Priority</option><option value="title">Task name</option></select></label></> : null}{domain === "calendar" ? <div className="view-switch" aria-label="Calendar view"><button className={calendarView === "month" ? "active" : ""} onClick={() => setCalendarView("month")}>Month</button><button className={calendarView === "agenda" ? "active" : ""} onClick={() => setCalendarView("agenda")}>Agenda</button></div> : null}{domain !== "tasks" ? <span className="record-count">{total} {total === 1 ? "item" : "items"}</span> : null}</div></div>
        {error && !open ? <ErrorState error={error} retry={load}/> : null}
        {loading ? <div className="loading-state" aria-live="polite"><span className="loading-spinner"/><p>Loading {config.title.toLowerCase()}…</p></div> : domain === "projects" ? <ProjectGrid rows={rows} onEdit={begin}/> : domain === "tasks" ? taskView === "list" ? <TaskTable rows={rows} onEdit={begin} onToggle={toggleTask} empty={<EmptyState query={query} title={config.title} action={config.action} clear={() => setQuery("")} create={() => begin()}/>}/> : <TaskBoard rows={rows} onEdit={begin} onToggle={toggleTask} empty={<EmptyState query={query} title={config.title} action={config.action} clear={() => setQuery("")} create={() => begin()}/>}/> : domain === "inbox" ? <InboxList rows={rows} onEdit={begin} onResolve={resolveInbox} empty={<EmptyState query={query} title={config.title} action={config.action} clear={() => setQuery("")} create={() => begin()}/>}/> : domain === "calendar" ? <CalendarWorkspace rows={rows} view={calendarView} onEdit={begin} empty={<EmptyState query={query} title={config.title} action={config.action} clear={() => setQuery("")} create={() => begin()}/>}/> : <StandardTable columns={config.columns} rows={rows} config={config} onEdit={begin} empty={<EmptyState query={query} title={config.title} action={config.action} clear={() => setQuery("")} create={() => begin()}/>}/>}
        {total > 50 || page > 1 ? <nav className="dataset-pagination" aria-label={`${config.title} pagination`}><p className="dataset-note">Showing {rows.length?((page-1)*50)+1:0}–{Math.min(page*50,total)} of {total}</p><div><Button emphasis="ghost" disabled={page===1} onClick={()=>setPage((current)=>Math.max(1,current-1))}>Previous</Button><Button emphasis="ghost" disabled={page*50>=total} onClick={()=>setPage((current)=>current+1)}>Next</Button></div></nav> : null}
        <Modal open={open} onClose={() => setOpen(false)} variant={domain === "tasks" ? "task" : "default"} title={editing ? domain === "tasks" ? "Task details" : `Edit ${config.title.toLowerCase().replace(/s$/, "")}` : config.action} description={domain === "tasks" ? "Update the work, its urgency, timing, and relationships." : "Changes are saved to your private workspace."}>
            {editing && domain === "calendar" ? <div className="meeting-capture-entry"><Link className="button button--outline button--neutral" href={`/meeting/${editing.id}/capture`}>Capture meeting outcome</Link><Link className="button button--ghost button--neutral" href={`/meeting/${editing.id}`}>Open meeting brief</Link></div> : null}
            {domain === "tasks" ? (
                <TaskDetailForm
                    fields={config.fields}
                    values={values}
                    setValues={setValues}
                    editing={editing}
                    saving={saving}
                    error={error}
                    archiveArmed={archiveArmed}
                    onArchive={archive}
                    onClose={() => setOpen(false)}
                    onSubmit={save}
                    attachments={editing && domain in attachmentEntities ? <AttachmentSection entityType={attachmentEntities[domain as keyof typeof attachmentEntities]} entityId={editing.id}/> : null}
                />
            ) : (
                <>
                    <form className="simple-form" onSubmit={save} noValidate>
                        {config.fields.map((field) => <FormField field={field} value={values[field.key] ?? ""} setValue={(value) => setValues((current) => ({ ...current, [field.key]: value }))} key={field.key}/>)}
                        {error ? <p className="field-error" role="alert">{error}</p> : null}
                        <div className="modal__actions">
                            {editing ? <Button emphasis="danger" onClick={() => void archive(editing)}>{archiveArmed ? "Confirm archive" : "Archive"}</Button> : null}
                            <Button emphasis="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button intent="brand" type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
                        </div>
                    </form>
                    {editing && domain in attachmentEntities ? <div className="domain-related-attachments"><AttachmentSection entityType={attachmentEntities[domain as keyof typeof attachmentEntities]} entityId={editing.id}/></div> : null}
                </>
            )}
        </Modal>
    </div>;
}
function renderCellValue(value: unknown, key: string) {
    if (value == null || value === "") return <span className="cell-muted">—</span>;
    const str = String(value);
    if (key === "status" || key.endsWith("_status") || key === "stage" || key === "potential") {
        return <span className={`status status--${str}`}>{display(str)}</span>;
    }
    if (key === "priority" || key === "impact") {
        return <span className={`priority priority--${str}`}>{display(str)}</span>;
    }
    if (key.includes("date") || key.includes("_at") || key.includes("due") || key.includes("expected") || key.includes("created")) {
        return <time>{formatDate(str)}</time>;
    }
    return <span>{display(str)}</span>;
}
function StandardTable({ columns, rows, config, onEdit, empty }: { columns: string[]; rows: DomainRecord[]; config: Config; onEdit: (record: DomainRecord) => void; empty: ReactNode }) {
    if (!rows.length) return <div className="data-surface">{empty}</div>;
    return <div className="table-frame domain-list-frame"><table className="work-table domain-list-table"><caption className="sr-only">{config.title} records</caption><thead><tr><th scope="col">{columns[0] ?? "Name"}</th><th scope="col">{columns[1] ?? "Secondary"}</th><th scope="col">{columns[2] ?? "Tertiary"}</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map((record) => (<tr key={record.id} onClick={() => onEdit(record)} className="clickable-row"><td><button type="button" className="table-title" onClick={() => onEdit(record)}><strong>{display(record[config.titleField])}</strong>{record.description && config.titleField !== "description" ? <small>{display(record.description)}</small> : null}</button></td><td>{renderCellValue(record[config.secondary], config.secondary)}</td><td>{renderCellValue(record[config.tertiary], config.tertiary)}</td><td><button type="button" className="icon-button" onClick={(e) => { e.stopPropagation(); onEdit(record); }} aria-label={`Open ${display(record[config.titleField])}`}><Icons.MoreHorizontal size={16}/></button></td></tr>))}</tbody></table></div>;
}
function TaskTable({ rows, onEdit, onToggle, empty }: { rows: DomainRecord[]; onEdit: (record: DomainRecord) => void; onToggle: (record: DomainRecord) => Promise<void>; empty: ReactNode }) {
    if (!rows.length) return <div className="data-surface">{empty}</div>;
    const statuses = ["inbox", "planned", "in_progress", "waiting", "blocked", "completed", "cancelled"];
    return <div className="table-frame task-list-frame"><table className="work-table task-list-table"><caption className="sr-only">Tasks grouped by status</caption><thead><tr><th scope="col"><span className="sr-only">Complete</span></th><th scope="col">Task</th><th scope="col">Priority</th><th scope="col">Due</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>{statuses.map((status) => { const group = rows.filter((record) => String(record.status) === status); if (!group.length) return null; return <tbody key={status}><tr className="task-group-row"><th colSpan={5} scope="rowgroup"><span className={`status status--${status}`}>{display(status)}</span><small>{group.length}</small></th></tr>{group.map((record) => { const done = record.status === "completed"; return <tr className={done ? "is-complete" : ""} key={record.id}><td><button className="task-check" aria-label={`${done ? "Reopen" : "Complete"} ${record.title}`} onClick={() => void onToggle(record)}>{done ? <Icons.Check size={14}/> : null}</button></td><td><button className="table-title" onClick={() => onEdit(record)}><strong>{display(record.title)}</strong>{record.description ? <small>{display(record.description)}</small> : null}</button></td><td><span className={`priority priority--${String(record.priority ?? "none")}`}>{display(record.priority)}</span></td><td><time>{formatDate(record.due_date)}</time></td><td><button className="icon-button" onClick={() => onEdit(record)} aria-label={`Open ${record.title}`}><Icons.MoreHorizontal size={16}/></button></td></tr>; })}</tbody>; })}</table></div>;
}
function TaskBoard({ rows, onEdit, onToggle, empty }: { rows: DomainRecord[]; onEdit: (record: DomainRecord) => void; onToggle: (record: DomainRecord) => Promise<void>; empty: ReactNode }) {
    if (!rows.length) return <div className="data-surface">{empty}</div>;
    const columns = ["inbox", "planned", "in_progress", "waiting", "blocked", "completed", "cancelled"] as const;
    return <section className="task-board" aria-label="Task board">
        {columns.map((status) => {
            const columnRows = rows.filter((record) => String(record.status) === status);
            return <section className="task-board__column" key={status}>
                <header><span className={`status status--${status}`}>{display(status)}</span><small>{columnRows.length}</small></header>
                <div className="task-board__cards">{columnRows.map((record) => { const done = record.status === "completed"; return <article className="task-card" key={record.id}><div className="task-card__head"><button className="task-check" aria-label={`${done ? "Reopen" : "Complete"} ${record.title}`} onClick={() => void onToggle(record)}>{done ? <Icons.Check size={13}/> : null}</button><button className="task-card__menu" onClick={() => onEdit(record)} aria-label={`Open ${record.title}`}><Icons.MoreHorizontal size={16}/></button></div><button className="task-card__title" onClick={() => onEdit(record)}><strong>{display(record.title)}</strong>{record.description ? <span>{display(record.description)}</span> : null}</button><footer><span className={`priority priority--${String(record.priority ?? "none")}`}>{display(record.priority)}</span>{record.due_date ? <time>{formatDate(record.due_date)}</time> : null}</footer></article>; })}</div>
            </section>;
        })}
    </section>;
}
function TaskDetailForm({ fields, values, setValues, editing, saving, error, archiveArmed, onArchive, onClose, onSubmit, attachments }: {
    fields: Field[];
    values: Record<string, string>;
    setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    editing: DomainRecord | null;
    saving: boolean;
    error: string;
    archiveArmed: boolean;
    onArchive: (record: DomainRecord) => Promise<void>;
    onClose: () => void;
    onSubmit: (event: React.FormEvent) => Promise<void>;
    attachments?: ReactNode;
}) {
    const byKey = Object.fromEntries(fields.map((field) => [field.key, field]));
    const renderField = (key: string, className?: string) => byKey[key] ? <FormField className={className} field={byKey[key]} value={values[key] ?? ""} setValue={(value) => setValues((current) => ({ ...current, [key]: value }))}/> : null;
    return <form className="task-detail-workspace" onSubmit={onSubmit} noValidate>
        <section className="task-detail-main" aria-label="Task content">
            {renderField("title", "task-title-field")}
            <div className="task-detail-section-heading"><Icons.FileText size={15}/><div><strong>Description</strong><span>Add the context needed to complete this task.</span></div></div>
            {renderField("description", "task-description-field")}
        </section>
        <aside className="task-detail-metadata" aria-label="Task metadata">
            <p className="task-detail-label">Task properties</p>
            <div className="task-detail-property-grid">
                {renderField("status")}
                {renderField("priority")}
                {renderField("due_date")}
                {renderField("daily_position")}
                {renderField("project_id")}
                {renderField("client_id")}
                {renderField("goal_id")}
            </div>
        </aside>
        {attachments ? <div className="task-related">{attachments}</div> : null}
        {error ? <p className="field-error task-detail-error" role="alert">{error}</p> : null}
        <div className="modal__actions task-detail-actions">
            {editing ? <Button emphasis="danger" onClick={() => void onArchive(editing)}>{archiveArmed ? "Confirm archive" : "Archive"}</Button> : null}
            <span className="task-detail-actions__spacer"/>
            <Button emphasis="ghost" onClick={onClose}>Cancel</Button>
            <Button intent="brand" type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create task"}</Button>
        </div>
    </form>;
}
function InboxList({ rows, onEdit, onResolve, empty }: { rows: DomainRecord[]; onEdit: (record: DomainRecord) => void; onResolve: (record: DomainRecord) => Promise<void>; empty: ReactNode }) {
    if (!rows.length) return <div className="data-surface">{empty}</div>;
    const unprocessed = rows.filter((record) => record.status !== "processed" && record.status !== "archived");
    return <div className="inbox-workbench"><div className="inbox-summary"><strong>{unprocessed.length}</strong><span>to triage</span><p>Clarify the type, then clear the item when it has a home.</p></div><div className="inbox-list">{rows.map((record) => <article className={record.status === "processed" ? "inbox-item is-processed" : "inbox-item"} key={record.id}><div className="inbox-item__mark"><Icons.Inbox size={15}/></div><div><p>{display(record.raw_text)}</p><span>{display(record.detected_type)} · {new Date(String(record.created_at)).toLocaleDateString()}</span></div><div className="inbox-item__actions"><Button emphasis="ghost" onClick={() => onEdit(record)}>Organize</Button>{record.status !== "processed" ? <Button emphasis="outline" onClick={() => void onResolve(record)}><Icons.Check size={14}/> Clear</Button> : <span className="status status--completed">Cleared</span>}</div></article>)}</div></div>;
}

function CalendarWorkspace({ rows, view, onEdit, empty }: { rows: DomainRecord[]; view: "month" | "agenda"; onEdit: (record: DomainRecord) => void; empty: ReactNode }) {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const gridStart = new Date(monthStart); gridStart.setDate(1 - monthStart.getDay());
    const days = Array.from({ length: 42 }, (_, index) => { const date = new Date(gridStart); date.setDate(gridStart.getDate() + index); return date; });
    const eventMap = new Map<string, DomainRecord[]>();
    rows.forEach((record) => { const key = String(record.starts_at ?? "").slice(0, 10); if (!key) return; eventMap.set(key, [...(eventMap.get(key) ?? []), record]); });
    if (view === "agenda") return <div className="calendar-agenda">{rows.length ? rows.slice().sort((a,b) => String(a.starts_at).localeCompare(String(b.starts_at))).map((record) => <button className="calendar-agenda__row" onClick={() => onEdit(record)} key={record.id}><time><strong>{new Date(String(record.starts_at)).toLocaleDateString([], { month: "short", day: "numeric" })}</strong><span>{new Date(String(record.starts_at)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></time><span className="calendar-event-mark"/><span><strong>{display(record.title)}</strong><small>{display(record.description ?? record.timezone)}</small></span><Icons.ChevronRight size={16}/></button>) : empty}</div>;
    return <><section className="calendar-board" aria-label={`${today.toLocaleDateString([], { month: "long", year: "numeric" })} calendar`}><div className="calendar-board__heading"><div><strong>{today.toLocaleDateString([], { month: "long" })}</strong><span>{today.getFullYear()}</span></div><span>{rows.length} scheduled</span></div><div className="calendar-weekdays" aria-hidden="true">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-month">{days.map((date) => { const key = localDateKey(date); const events = eventMap.get(key) ?? []; const outside = date.getMonth() !== today.getMonth(); const isToday = key === localDateKey(today); return <div className={`calendar-day ${outside ? "is-outside" : ""} ${isToday ? "is-today" : ""}`} key={key}><time dateTime={key}>{date.getDate()}</time><div>{events.slice(0,3).map((record) => <button onClick={() => onEdit(record)} title={String(record.title)} key={record.id}><span>{new Date(String(record.starts_at)).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span>{display(record.title)}</button>)}{events.length > 3 ? <small>+{events.length - 3} more</small> : null}</div></div>; })}</div></section>{rows.length ? <div className="calendar-mobile-agenda">{rows.slice().sort((a,b) => String(a.starts_at).localeCompare(String(b.starts_at))).map((record) => <button className="calendar-agenda__row" onClick={() => onEdit(record)} key={record.id}><time><strong>{new Date(String(record.starts_at)).toLocaleDateString([], { month: "short", day: "numeric" })}</strong><span>{new Date(String(record.starts_at)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></time><span className="calendar-event-mark"/><span><strong>{display(record.title)}</strong><small>{display(record.description ?? record.timezone)}</small></span><Icons.ChevronRight size={16}/></button>)}</div> : <div className="calendar-zero-prompt">{empty}</div>}</>;
}

function localDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function formatDate(value: unknown) { if (!value) return "No date"; const date = new Date(`${String(value).slice(0,10)}T12:00:00`); return date.toLocaleDateString([], { month: "short", day: "numeric" }); }
function FormField({ field, value, setValue, className }: {
    field: Field;
    value: string;
    setValue: (value: string) => void;
    className?: string;
}) { const id = `record-${field.key}`; const [relations, setRelations] = useState<DomainRecord[]>([]); useEffect(() => { if (!field.relation)
    return; let active = true; fetch(`/api/entities/${field.relation}`, { cache: "no-store" }).then((response) => response.json()).then((data) => { if (active)
    setRelations(data.records ?? []); }).catch(() => { if (active)
    setRelations([]); }); return () => { active = false; }; }, [field.relation]); return <div className={className}><label htmlFor={id}>{field.label}{!field.required ? <span> Optional</span> : null}</label>{field.type === "textarea" ? <textarea className="resize-none" id={id} rows={4} required={field.required} value={value} onChange={(event) => setValue(event.target.value)}/> : field.type === "select" ? <select id={id} value={value} onChange={(event) => setValue(event.target.value)}>{field.options?.map((option) => <option value={option} key={option}>{display(option)}</option>)}</select> : field.type === "relation" ? <select id={id} value={value} onChange={(event) => setValue(event.target.value)}><option value="">No {field.label.toLowerCase()}</option>{relations.map((record) => <option value={record.id} key={record.id}>{String(record.name ?? record.title)}</option>)}</select> : <input id={id} type={field.type ?? "text"} required={field.required} value={value} onChange={(event) => setValue(event.target.value)}/>}</div>; }
function normalizeInput(value: string, field: Field) { if (field.type === "number" || field.key === "daily_position")
    return normalizeOptionalNumberInput(value); if(value==="true"||value==="false")return value==="true"; if (field.type === "datetime-local")
    return value ? new Date(value).toISOString() : null; return value || null; }
function toInputValue(value: unknown, type: Field["type"]) { if (value == null)
    return ""; if (type === "datetime-local") {
    const date = new Date(String(value));
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
} return String(value); }
function ProjectGrid({ rows, onEdit }: {
    rows: DomainRecord[];
    onEdit: (record: DomainRecord) => void;
}) { return <div className="project-grid">{rows.map((record) => <article className="project-card" key={record.id}><span className="project-card__accent" style={{ background: String(record.color ?? "#3157D5") }}/><div className="project-card__top"><span className="status">{display(record.status)}</span><button className="icon-button" onClick={() => onEdit(record)} aria-label={`Edit ${record.name}`}><Icons.MoreHorizontal size={17}/></button></div><Link href={`/projects/${record.id}`}><h2>{display(record.name)}</h2><p>{display(record.description)}</p><div className="project-progress"><span><i style={{ width: `${Number(record.progress ?? 0)}%` }}/></span><strong>{display(record.progress)}%</strong></div><small>Open project workspace →</small></Link></article>)}</div>; }
function EmptyState({ query, title, action, clear, create }: {
    query: string;
    title: string;
    action: string;
    clear: () => void;
    create: () => void;
}) { return <div className="empty-state"><span>∅</span><h2>{query ? `No matches for “${query}”` : `No ${title.toLowerCase()} yet`}</h2><p>{query ? "Clear the search or try a broader phrase." : `Use “${action}” to create the first one.`}</p><Button emphasis="outline" onClick={query ? clear : create}>{query ? "Clear search" : action}</Button></div>; }
function ErrorState({ error, retry }: {
    error: string;
    retry: () => Promise<void>;
}) { return <div className="inline-error" role="alert"><p>{error}</p><Button emphasis="outline" onClick={() => void retry()}>Try again</Button></div>; }
function AssistantView({ config }: {
    config: Config;
}) { const [message, setMessage] = useState(""); const [messages, setMessages] = useState<{
    user: string;
    assistant: string;
}[]>([]); const [busy, setBusy] = useState(false); async function send(event: React.FormEvent) { event.preventDefault(); const value = message.trim(); if (!value || busy)
    return; setMessage(""); setBusy(true); try {
    const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: value }) });
    const data = await response.json();
    setMessages((current) => [...current, { user: value, assistant: response.ok ? data.text : data.error ?? "The assistant could not respond." }]);
}
catch {
    setMessages((current) => [...current, { user: value, assistant: "The connection failed. Try again when online." }]);
}
finally {
    setBusy(false);
} }
    return <div className="domain-page assistant-page"><header className="task-context-header"><div><nav className="task-context-header__breadcrumb" aria-label="Breadcrumb"><span>Workspace</span><span>/</span><span className="current">{config.title}</span></nav><div className="task-context-header__title-row"><h1>{config.title}</h1><span className="task-context-header__total-badge">AI Assistant</span><span className="status status--blue"><span className="live-dot"/> Server protected</span></div><p className="task-context-header__description">{config.intro}</p></div></header><div className="assistant-layout"><section className="assistant-thread"><div className="assistant-welcome"><Icons.Sparkles size={22}/><h2>What deserves your attention?</h2><p>I can reason across your private workspace. I will ask before destructive or high-impact changes.</p></div>{messages.map((item, index) => <div key={`${item.user}-${index}`}><p className="user-message">{item.user}</p><div className="assistant-message"><span>AI</span><p>{item.assistant}</p></div></div>)}<form className="assistant-composer" onSubmit={send} noValidate><label className="sr-only" htmlFor="assistant-message">Ask the assistant</label><textarea className="resize-none" id="assistant-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={2} placeholder="What should I work on right now?"/><Button intent="brand" type="submit" disabled={busy}>{busy ? "Thinking…" : "Send"}</Button></form></section><aside className="assistant-suggestions"><p className="eyebrow">Try asking</p>{["What am I forgetting?", "Who should I follow up with?", "Plan tomorrow."].map((prompt) => <button onClick={() => setMessage(prompt)} key={prompt}><strong>{prompt}</strong><span>Uses live workspace data</span></button>)}</aside></div></div>;
}
function SettingsView({ config }: {
    config: Config;
}) { return <div className="domain-page"><header className="task-context-header"><div><nav className="task-context-header__breadcrumb" aria-label="Breadcrumb"><span>Workspace</span><span>/</span><span className="current">{config.title}</span></nav><div className="task-context-header__title-row"><h1>{config.title}</h1></div><p className="task-context-header__description">{config.intro}</p></div></header><div className="data-surface"><Link className="data-row" href="/settings/integrations"><strong>Integrations</strong><span>Calendar, mail, files, code, and fitness services</span><span>Manage</span><Icons.MoreHorizontal size={17}/></Link><Link className="data-row" href="/settings/notifications"><strong>Notifications</strong><span>Control which signals can enter Today</span><span>Manage</span><Icons.MoreHorizontal size={17}/></Link></div></div>; }
