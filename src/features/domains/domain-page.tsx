"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { DatePicker } from "@/components/ui/date-picker";
import { CalendarConflicts } from "@/features/calendar/calendar-conflicts";
import { CalendarDashboard } from "@/features/calendar/calendar-dashboard";
import { ProjectDashboard } from "@/features/domains/project-dashboard";
import { InboxWorkbench } from "@/features/inbox/inbox-workbench";
import "./task-board-design.css";
import "./task-list-design.css";
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
    tasks: c("Execution", "Tasks", "A deliberate list of commitments—not a graveyard of good intentions.", "New task", ["Task", "Status", "Due"], "title", "status", "due_date", [f("title", "Task", "text", undefined, true), f("description", "Notes", "textarea"), f("status", "Status", "select", ["inbox", "planned", "in_progress", "waiting", "blocked", "completed", "cancelled"]), f("priority", "Priority", "select", ["none", "low", "medium", "high", "urgent"]), f("work_classification", "Work classification", "select", ["standard", "founder_only", "delegate", "automate_candidate"]), f("due_date", "Due date", "date")]),
    inbox: c("Triage", "Inbox", "Capture quickly, then decide what each item becomes.", "Capture", ["Captured item", "Detected as", "Captured"], "raw_text", "detected_type", "created_at", [f("raw_text", "Capture", "textarea", undefined, true), f("detected_type", "Type", "select", ["inbox", "task", "note", "idea", "decision", "follow-up", "issue", "risk", "commitment", "contact", "experiment"]), f("status", "Triage status", "select", ["unprocessed", "processed", "archived"])]),
    projects: c("Workspace", "Projects", "See momentum, risk, and the next meaningful move.", "New project", ["Project", "Status", "Progress"], "name", "status", "progress", [f("name", "Project name", "text", undefined, true), f("description", "Description", "textarea"), f("status", "Status", "select", ["idea", "planning", "active", "paused", "completed", "archived"]), f("progress", "Progress", "number"), f("value_amount", "Project value", "number"), f("currency", "Currency"), f("target_date", "Target date", "date")]),
    clients: c("Relationships", "Clients", "Keep promises, context, and follow-ups close together.", "New client", ["Client", "Company", "Next contact"], "name", "company", "next_follow_up_at", [f("name", "Client name", "text", undefined, true), f("company", "Company"), f("email", "Email"), f("phone", "Phone"), f("notes", "Notes", "textarea")]),
    followups: c("Relationships", "Follow-ups", "Keep every promised check-in visible.", "New follow-up", ["Follow-up", "Status", "Due"], "title", "status", "due_at", [f("title", "Follow-up", "text", undefined, true), f("due_at", "Due", "datetime-local"), f("status", "Status", "select", ["open", "done", "cancelled"]), f("notes", "Notes", "textarea")]),
    waiting: c("Open loops", "Waiting", "Know exactly where momentum depends on someone else.", "Track request", ["Waiting for", "Contact", "Expected"], "title", "contact", "expected_by", [f("title", "Waiting for", "text", undefined, true), f("contact", "Contact"), f("expected_by", "Expected by", "datetime-local"), f("status", "Status", "select", ["waiting", "received", "cancelled"]), f("notes", "Notes", "textarea")]),
    notes: c("Second brain", "Notes", "Working knowledge with context and a way back to the source.", "New note", ["Note", "Category", "Updated"], "title", "category", "updated_at", [f("title", "Title", "text", undefined, true), f("content", "Note", "textarea"), f("category", "Category")]),
    goals: c("Direction", "Goals", "Connect the week in front of you to the quarter you want.", "New goal", ["Goal", "Period", "Progress"], "title", "period", "progress", [f("title", "Goal", "text", undefined, true), f("description", "Description", "textarea"), f("period", "Period", "select", ["year", "quarter", "month", "week"]), f("target_date", "Target date", "date"), f("progress", "Progress", "number")]),
    ideas: c("Possibilities", "Idea vault", "Interesting is enough. Ideas do not need to become obligations.", "Capture idea", ["Idea", "Potential", "State"], "title", "potential", "status", [f("title", "Idea", "text", undefined, true), f("description", "Description", "textarea"), f("potential", "Potential", "select", ["low", "medium", "high", "huge"]), f("status", "State")]),
    decisions: c("Memory", "Decision log", "Keep the why, impact, and review point—not just the outcome.", "Log decision", ["Decision", "Impact", "Review"], "title", "impact", "review_date", [f("title", "Decision title", "text", undefined, true), f("decision", "Outcome", "textarea", undefined, true), f("reasoning", "Reasoning", "textarea"), f("impact", "Impact", "select", ["low","medium","high","critical"]), f("confidence", "Confidence", "select", ["low","medium","high"]), f("status", "Status", "select", ["active","review_due","superseded","reversed","archived","proposed","under_review","decided","implemented","validated"]), f("decision_date", "Date", "date"), f("review_date", "Review date", "date")]),
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
configs.decisions.fields.push(f("options_considered", "Options considered", "textarea"), f("selected_option", "Selected option"), f("assumptions", "Assumptions", "textarea"), f("expected_outcome", "Expected outcome", "textarea"), f("expected_metric", "Expected metric"), f("actual_outcome", "Actual outcome", "textarea"), f("variance", "Variance from expectation", "textarea"), f("lesson_learned", "Lesson (proposed to Operating Memory)", "textarea"), f("owner_label", "Owner"), f("deadline", "Decision deadline", "date"), f("reversibility", "Reversibility", "select", ["reversible", "costly", "irreversible"]), f("financial_exposure", "Financial exposure", "number"), f("currency", "Currency"));
configs.waiting.fields.push(f("followup_date", "Follow-up date", "date"), f("importance", "Importance", "select", ["medium", "low", "high", "critical"]), f("direction", "Direction", "select", ["owed_to_me", "owed_by_me"]), f("owner_label", "Owner"), f("impact", "Impact", "textarea"), f("blocking_revenue", "Blocking revenue", "select", ["false", "true"]));
configs.content.fields.push(f("audience", "Audience"), f("impressions", "Impressions / views", "number"), f("clicks", "Clicks", "number"), f("leads", "Leads", "number"), f("conversions", "Conversions", "number"), f("attributed_revenue", "Attributed revenue", "number"), f("production_cost", "Production cost", "number"), f("metric_currency", "Metrics currency"), f("learning", "Learning", "textarea"));
configs.fitness.fields.push(f("perceived_exertion", "Perceived exertion (1–10)", "number"));
configs.tasks.fields.push(f("daily_position", "Today’s win position", "select", ["", "1", "2", "3"]));
configs.tasks.fields.push(f("target_count", "Target total", "number"), f("current_count", "Current progress", "number"), f("daily_target", "Daily target", "number"));
for (const [key, fields] of Object.entries(relationshipFields))
    configs[key as DomainKey].fields.push(...fields);
const emptyValues = (config: Config) => Object.fromEntries(config.fields.map((field) => [field.key, field.options?.[0] ?? (["currency", "metric_currency"].includes(field.key) ? "MAD" : field.key === "timezone" ? "Africa/Casablanca" : "")]));
const display = (value: unknown) => value == null || value === "" ? "—" : String(value).replaceAll("_", " ");
export function isTaskPastDue(record: DomainRecord): boolean {
    const status = String(record.status ?? "");
    if (status === "completed" || status === "cancelled") return false;
    if (!record.due_date) return false;
    const dueDateStr = String(record.due_date).slice(0, 10);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (dueDateStr < todayStr) return true;
    if (dueDateStr === todayStr && record.due_time) {
        const [hours, minutes] = String(record.due_time).split(":").map(Number);
        const taskDue = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours || 0, minutes || 0);
        return taskDue < now;
    }
    return false;
}
export function isTaskCompletedExpired(record: DomainRecord): boolean {
    if (record.status !== "completed") return false;
    const time = record.completed_at
        ? new Date(String(record.completed_at)).getTime()
        : (record.updated_at ? new Date(String(record.updated_at)).getTime() : null);
    if (!time || isNaN(time)) return false;
    return Date.now() - time > 24 * 60 * 60 * 1000;
}
export function DomainPage({ domain, embedded = false, onMutationSuccess, refreshToken }: {
    domain: DomainKey;
    embedded?: boolean;
    onMutationSuccess?: () => void | Promise<void>;
    refreshToken?: number;
}) {
    const router = useRouter();
    const config = configs[domain];
    const [records, setRecords] = useState<DomainRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("open");
    const [priorityFilter, setPriorityFilter] = useState("all");
    const [taskSort, setTaskSort] = useState("updated");
    const [taskView, setTaskView] = useState<"list" | "board">(() => {
        if (typeof window !== "undefined") {
            try {
                const params = new URLSearchParams(window.location.search);
                const viewParam = params.get("view");
                if (viewParam === "board" || viewParam === "list") return viewParam;
            } catch {}
        }
        return "board";
    });
    const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
    const [calendarView, setCalendarView] = useState<"day" | "week" | "month" | "agenda">(() => {
        if (typeof window !== "undefined") {
            try {
                const params = new URLSearchParams(window.location.search);
                const calParam = params.get("calView");
                if (calParam === "day" || calParam === "week" || calParam === "month" || calParam === "agenda") return calParam;
            } catch {}
        }
        return "day";
    });

    useDeferredEffect(useCallback(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const viewParam = params.get("view");
            if (viewParam === "board" || viewParam === "list") {
                setTaskView(viewParam);
            } else setTaskView(window.matchMedia("(max-width: 767px)").matches ? "list" : "board");
            const calParam = params.get("calView");
            if (calParam === "day" || calParam === "week" || calParam === "month" || calParam === "agenda") {
                setCalendarView(calParam);
            } else setCalendarView("day");
        } catch {}
    }, []));

    const handleSetTaskView = (view: "list" | "board") => {
        setTaskView(view);
        try {
            const url = new URL(window.location.href);
            url.searchParams.set("view", view);
            window.history.replaceState({}, "", url.toString());
        } catch {}
    };

    const handleSetCalendarView = (view: "day" | "week" | "month" | "agenda") => {
        setCalendarView(view);
        try {
            localStorage.setItem("dcc-calendar-view", view);
            const url = new URL(window.location.href);
            url.searchParams.set("calView", view);
            window.history.replaceState({}, "", url.toString());
        } catch {}
    };
    const deferredQuery=useDeferredValue(query);
    const [page,setPage]=useState(1);
    const [total,setTotal]=useState(0);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<DomainRecord | null>(null);
    const [values, setValues] = useState<Record<string, string>>(emptyValues(config));
    const [saving, setSaving] = useState(false);
    const [archiveArmed, setArchiveArmed] = useState(false);
    const [deleteArmed, setDeleteArmed] = useState(false);
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
    const rows = useMemo(() => {
        if (domain !== "tasks") return records;
        return records.filter((record) => !isTaskCompletedExpired(record));
    }, [records, domain]);
    if (domain === "assistant")
        return <AssistantView config={config}/>;
    if (domain === "settings")
        return <SettingsView config={config}/>;
    function begin(record?: DomainRecord, defaultValues?: Record<string, string>) {
        setError("");
        setArchiveArmed(false);
        setDeleteArmed(false);
        setEditing(record ?? null);
        if (record) {
            setValues(Object.fromEntries(config.fields.map((field) => [field.key, toInputValue(record[field.key], field.type)])));
        } else {
            const initial = emptyValues(config);
            if (defaultValues) {
                Object.assign(initial, defaultValues);
            }
            setValues(initial);
        }
        setOpen(true);
    }
    async function rescheduleCalendarEvent(record: DomainRecord, startsAt: string, endsAt: string) {
        try {
            const response = await fetch(`/api/entities/calendar/${record.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ starts_at: startsAt, ends_at: endsAt }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error ?? "Event could not be updated.");
            setRecords(current => current.map(item => item.id === record.id ? { ...item, ...data.record } : item));
            showToast("Event time updated.", "success");
        } catch (reason) {
            showToast(reason instanceof Error ? reason.message : "Event could not be updated.", "error");
        }
    }
    async function save(event: React.FormEvent) {
        event.preventDefault();
        setSaving(true);
        setError("");
        try {
            const body = Object.fromEntries(config.fields.map((field) => [field.key, normalizeInput(values[field.key], field)]).filter(([, value]) => value !== ""));
            if (domain === "tasks" && editing) {
                body.target_count = values.target_count ? Number(values.target_count) : null;
                body.daily_target = values.daily_target ? Number(values.daily_target) : null;
            }
            if (domain === "tasks" && body.status === "completed" && !body.completed_at) {
                body.completed_at = new Date().toISOString();
            }
            const response = await fetch(`/api/entities/${domain}${editing ? `/${editing.id}` : ""}`, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.error);
            setRecords((current) => editing ? current.map((item) => item.id === editing.id ? data.record : item) : [data.record, ...current]);
            if(!editing) setTotal((current)=>current+1);
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
        }
    }
    async function archive(record: DomainRecord) { if (!archiveArmed) { setArchiveArmed(true); setDeleteArmed(false); showToast(`Click Archive again to confirm archiving “${display(record[config.titleField])}”.`, "warning"); return; } const response = await fetch(`/api/entities/${domain}/${record.id}`, { method: "DELETE" }); if (response.ok) {
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
    async function removePermanent(record: DomainRecord) { if (!deleteArmed) { setDeleteArmed(true); setArchiveArmed(false); showToast(`Click "Confirm permanent delete" to delete “${display(record[config.titleField])}”.`, "warning"); return; } const response = await fetch(`/api/entities/${domain}/${record.id}?permanent=true`, { method: "DELETE" }); if (response.ok) {
        setRecords((current) => current.filter((item) => item.id !== record.id));
        setTotal((current)=>Math.max(0,current-1));
        await onMutationSuccess?.();
        if(domain!=="assistant"&&domain!=="settings")announceWorkspaceMutation(domain);
        setOpen(false);
        showToast("Permanently deleted.");
    }
    else {
        const data = await response.json();
        setError(data.error ?? "Record could not be deleted.");
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
    async function moveTask(record: DomainRecord, newStatus: string, targetIndex?: number) {
        let targetStatus = newStatus;
        let newDueDate = record.due_date;

        if (newStatus === "still_waiting") {
            targetStatus = "waiting";
            if (!isTaskPastDue(record)) {
                const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
                newDueDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
            }
        } else if (isTaskPastDue(record)) {
            const today = new Date();
            newDueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        }

        if (record.status === targetStatus && newDueDate === record.due_date && targetIndex === undefined) return;
        const prevRecords = [...records];
        const prevStatus = String(record.status ?? "");
        const completed = targetStatus === "completed";

        // Optimistically update records in state
        setRecords((current) => {
            const item = current.find((r) => r.id === record.id);
            if (!item) return current;
            const updatedItem: DomainRecord = {
                ...item,
                status: targetStatus,
                due_date: newDueDate,
                completed_at: completed ? new Date().toISOString() : (prevStatus === "completed" ? null : item.completed_at),
            };
            const without = current.filter((r) => r.id !== record.id);
            if (targetIndex !== undefined && targetIndex >= 0) {
                const targetIndices = without
                    .map((r, idx) => ({ id: r.id, status: r.status, idx }))
                    .filter((r) => r.status === targetStatus);
                if (targetIndex < targetIndices.length) {
                    const insertAt = targetIndices[targetIndex].idx;
                    const copy = [...without];
                    copy.splice(insertAt, 0, updatedItem);
                    return copy;
                } else if (targetIndices.length > 0) {
                    const insertAfter = targetIndices[targetIndices.length - 1].idx + 1;
                    const copy = [...without];
                    copy.splice(insertAfter, 0, updatedItem);
                    return copy;
                }
            }
            return [updatedItem, ...without];
        });

        const movedLabel = newStatus === "still_waiting" ? "Still Waiting" : display(targetStatus);
        if (prevStatus !== targetStatus) {
            showToast(`Moved to ${movedLabel}.`);
        }

        const patchBody: Record<string, unknown> = {
            status: targetStatus,
            completed_at: completed ? new Date().toISOString() : (prevStatus === "completed" ? null : record.completed_at),
        };
        if (newDueDate !== record.due_date) {
            patchBody.due_date = newDueDate;
        }

        const response = await fetch(`/api/entities/tasks/${record.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patchBody),
        });
        const data = await response.json();
        if (!response.ok) {
            setRecords(prevRecords);
            showToast(data.error ?? "Failed to move task.", "error");
            return;
        }
        setRecords((current) => current.map((item) => item.id === record.id ? data.record : item));
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
        const operatingRoutes: Record<string, string> = { issue: "/issues", risk: "/risks/register", commitment: "/commitments", contact: "/relationships", experiment: "/experiments" };
        if (operatingRoutes[detectedType]) { router.push(`${operatingRoutes[detectedType]}?capture=${record.id}`); return; }
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
    function handleAddTaskInStatus(status: string) {
        if (status === "still_waiting") {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const yDateStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
            begin(undefined, { status: "waiting", due_date: yDateStr });
        } else {
            begin(undefined, { status });
        }
    }
    return <div className={`domain-page ${embedded ? "domain-page--embedded" : ""} ${domain === "inbox" ? "domain-page--inbox" : ""}`}>
        {domain === "inbox" ? null : embedded ? <div className="embedded-heading"><div><p className="eyebrow">Manage records</p><h2>{config.title}</h2></div><Button intent="brand" onClick={() => begin()}><Icons.Plus size={16}/>{config.action}</Button></div> : domain === "tasks" ? <header className="task-context-header"><div><div className="task-context-header__path"><Icons.ListTodo size={15}/><span>My work</span><Icons.ChevronRight size={13}/><strong>Tasks</strong></div><h1>Tasks</h1><p>Plan, prioritize, and move work forward.</p></div><div className="task-context-header__actions"><span className="task-total"><strong>{total}</strong> total</span><Button intent="brand" onClick={() => begin()}><Icons.Plus size={16}/>New task</Button></div></header> : <header className="task-context-header domain-context-header"><div><div className="task-context-header__path"><span>{config.eyebrow}</span><Icons.ChevronRight size={13}/><strong>{config.title}</strong></div><h1>{config.title}</h1><p>{config.intro}</p></div><div className="task-context-header__actions"><span className="task-total"><strong>{total}</strong> total</span><Button intent="brand" onClick={() => begin()}><Icons.Plus size={16}/>{config.action}</Button></div></header>}
        {domain === "calendar" ? <CalendarConflicts onEdit={begin} onResolved={load} /> : null}
        {domain === "inbox" || domain === "calendar" || domain === "projects" ? null : <div className={`domain-toolbar ${domain === "tasks" ? "task-toolbar" : ""}`}><SearchInput ref={inputRef} id={`${domain}-search`} label={`Search ${domain}`} value={query} onChange={(event) => {setQuery(event.target.value);setPage(1)}} onClear={() => {setQuery("");setPage(1)}} placeholder={`Search ${domain}…`}/><div className="domain-toolbar__controls">{domain === "tasks" ? <><div className="view-switch task-view-switch" aria-label="Task view"><button type="button" className={taskView === "list" ? "active" : ""} aria-pressed={taskView === "list"} onClick={() => handleSetTaskView("list")}><Icons.ListTodo size={14}/>List</button><button type="button" className={taskView === "board" ? "active" : ""} aria-pressed={taskView === "board"} onClick={() => handleSetTaskView("board")}><Icons.BriefcaseBusiness size={14}/>Board</button></div><label className="compact-select"><span>Status</span><select aria-label="Filter tasks by status" value={statusFilter} onChange={(event) => {setStatusFilter(event.target.value);setPage(1)}}><option value="open">Open</option><option value="all">All statuses</option><option value="inbox">Inbox</option><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="waiting">Waiting</option><option value="still_waiting">Still Waiting</option><option value="blocked">Blocked</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><label className="compact-select"><span>Priority</span><select aria-label="Filter tasks by priority" value={priorityFilter} onChange={(event) => {setPriorityFilter(event.target.value);setPage(1)}}><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="none">No priority</option></select></label><label className="compact-select"><span>Sort</span><select aria-label="Sort tasks" value={taskSort} onChange={(event) => {setTaskSort(event.target.value);setPage(1)}}><option value="updated">Recently updated</option><option value="due">Due date</option><option value="priority">Priority</option><option value="title">Task name</option></select></label></> : null}{domain !== "tasks" ? <span className="record-count">{total} {total === 1 ? "item" : "items"}</span> : null}</div></div>}
        {error && !open ? <ErrorState error={error} retry={load}/> : null}
        {loading ? <div className="loading-state" aria-live="polite"><span className="loading-spinner"/><p>Loading {config.title.toLowerCase()}…</p></div> : domain === "projects" ? <ProjectDashboard rows={rows} onEdit={begin} onCreate={() => begin()}/> : domain === "tasks" ? taskView === "list" ? <TaskTable rows={rows} onEdit={begin} onToggle={toggleTask} empty={<EmptyState query={query} title={config.title} action={config.action} clear={() => setQuery("")} create={() => begin()}/>}/> : <TaskBoard rows={rows} onEdit={begin} onToggle={toggleTask} onMoveTask={moveTask} onAddTaskInStatus={handleAddTaskInStatus} empty={<EmptyState query={query} title={config.title} action={config.action} clear={() => setQuery("")} create={() => begin()}/>}/> : domain === "inbox" ? <InboxWorkbench rows={rows} query={query} setQuery={setQuery} onEdit={begin} onResolve={resolveInbox} onCapture={() => begin()} loading={loading}/> : domain === "calendar" ? <CalendarDashboard rows={rows} view={calendarView} onViewChange={handleSetCalendarView} monthOffset={calendarMonthOffset} changeMonth={setCalendarMonthOffset} onEdit={begin} onCreate={(defaults) => begin(undefined, defaults)} onReschedule={rescheduleCalendarEvent}/> : <StandardTable columns={config.columns} rows={rows} config={config} onEdit={begin} empty={<EmptyState query={query} title={config.title} action={config.action} clear={() => setQuery("")} create={() => begin()}/>}/>}
        {total > 50 || page > 1 ? <nav className="dataset-pagination" aria-label={`${config.title} pagination`}><p className="dataset-note">Showing {rows.length?((page-1)*50)+1:0}–{Math.min(page*50,total)} of {total}</p><div><Button emphasis="ghost" disabled={page===1} onClick={()=>setPage((current)=>Math.max(1,current-1))}>Previous</Button><Button emphasis="ghost" disabled={page*50>=total} onClick={()=>setPage((current)=>current+1)}>Next</Button></div></nav> : null}
        <Modal open={open} onClose={() => setOpen(false)} variant={domain === "tasks" ? "task" : "default"} title={editing ? domain === "tasks" ? "Task details" : `Edit ${config.title.toLowerCase().replace(/s$/, "")}` : config.action} description={domain === "tasks" ? "Update the work, its urgency, timing, and relationships." : "Changes are saved to your private workspace."}>
            {editing && domain === "calendar" ? <div className="meeting-capture-entry"><Link className="button button--outline button--neutral" href={`/meeting/${editing.id}/capture`}>Capture meeting outcome</Link><Link className="button button--ghost button--neutral" href={`/meeting/${editing.id}`}>Open meeting brief</Link></div> : null}
            {domain === "tasks" ? (
                <TaskDetailForm
                    key={editing?.id ?? "new-task"}
                    fields={config.fields}
                    values={values}
                    setValues={setValues}
                    editing={editing}
                    saving={saving}
                    error={error}
                    archiveArmed={archiveArmed}
                    deleteArmed={deleteArmed}
                    onArchive={archive}
                    onDelete={removePermanent}
                    onClose={() => setOpen(false)}
                    onSubmit={save}
                    attachments={editing && domain in attachmentEntities ? <AttachmentSection entityType={attachmentEntities[domain as keyof typeof attachmentEntities]} entityId={editing.id}/> : null}
                    onProgressLogged={(updated) => {
                        setRecords((current) => current.map((r) => r.id === updated.id ? { ...r, ...updated } : r));
                        if (editing && updated.id === editing.id) setEditing({ ...editing, ...updated });
                    }}
                />
            ) : (
                <>
                    <form className="simple-form" onSubmit={save} noValidate>
                        {config.fields.map((field) => <FormField field={field} value={values[field.key] ?? ""} setValue={(value) => setValues((current) => ({ ...current, [field.key]: value }))} key={field.key}/>)}
                        {error ? <p className="field-error" role="alert">{error}</p> : null}
                        <div className="modal__actions">
                            {editing ? (
                                <div className="task-destructive-actions">
                                    <Button emphasis="danger" type="button" onClick={() => void removePermanent(editing)}>{deleteArmed ? "Confirm delete" : "Delete"}</Button>
                                    <Button emphasis="outline" type="button" onClick={() => void archive(editing)}>{archiveArmed ? "Confirm archive" : "Archive"}</Button>
                                </div>
                            ) : null}
                            <span className="task-detail-actions__spacer"/>
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
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [panelTab, setPanelTab] = useState<"details" | "files">("details");
    const selected = rows.find((record) => record.id === selectedId) ?? null;
    if (!rows.length) return <div className="data-surface">{empty}</div>;
    const statuses = ["inbox", "planned", "in_progress", "waiting", "still_waiting", "blocked", "completed", "cancelled"];
    return <div className={`task-list-workspace ${selected ? "task-list-workspace--open" : ""}`}><div className="table-frame task-list-frame"><table className="work-table task-list-table"><caption className="sr-only">Tasks grouped by status</caption><thead><tr><th scope="col"><span className="sr-only">Complete</span></th><th scope="col">Task</th><th scope="col">Status</th><th scope="col">Priority</th><th scope="col">Assignee</th><th scope="col">Due date</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>{statuses.map((status) => {
        const group = status === "still_waiting"
            ? rows.filter((record) => isTaskPastDue(record))
            : rows.filter((record) => String(record.status) === status && !isTaskPastDue(record));
        if (!group.length) return null;
        return <tbody key={status}><tr className="task-group-row" data-status={status}><th colSpan={7} scope="rowgroup"><span className="task-list-group-icon">{status === "inbox" ? <Icons.Inbox size={16}/> : status === "still_waiting" ? <Icons.Clock3 size={16}/> : status === "planned" ? <Icons.CalendarDays size={16}/> : status === "in_progress" ? <Icons.Focus size={16}/> : status === "waiting" ? <Icons.Clock3 size={16}/> : <Icons.Check size={16}/>}</span><strong>{status === "still_waiting" ? "Still Waiting" : display(status)}</strong><small>{group.length}</small></th></tr>{group.map((record) => { const done = record.status === "completed"; return <tr className={`${done ? "is-complete" : ""} ${selected?.id === record.id ? "is-selected" : ""}`} key={record.id} onClick={() => { setSelectedId(record.id); setPanelTab("details"); }}><td><button className="task-check" aria-label={`${done ? "Reopen" : "Complete"} ${record.title}`} onClick={(event) => { event.stopPropagation(); void onToggle(record); }}>{done ? <Icons.Check size={14}/> : null}</button></td><td><button className="table-title" onClick={(event) => { event.stopPropagation(); setSelectedId(record.id); setPanelTab("details"); }}><strong>{display(record.title)}</strong>{record.description ? <small>{display(record.description)}</small> : null}</button></td><td><span className={`task-list-status task-list-status--${status}`}>{status === "still_waiting" ? "Open" : done ? "Done" : status === "inbox" ? "Open" : display(status)}</span></td><td><span className={`priority priority--${String(record.priority ?? "none")}`}>{display(record.priority)}</span></td><td><span className="task-list-owner"><i>{String(record.assigned_to_name ?? record.owner_name ?? "Y").slice(0,1).toUpperCase()}</i>{display(record.assigned_to_name ?? record.owner_name ?? "You")}</span></td><td><time><Icons.CalendarDays size={14}/>{record.due_date ? formatDate(record.due_date) : "No date"}</time></td><td><button className="icon-button" onClick={(event) => { event.stopPropagation(); onEdit(record); }} aria-label={`Edit ${record.title}`}><Icons.MoreHorizontal size={16}/></button></td></tr>; })}</tbody>; })}</table></div>
        {selected && <aside className="task-list-panel" aria-label="Selected task details"><div className="task-list-panel__top"><span><Icons.ListTodo size={14}/> Task</span><div><button onClick={() => onEdit(selected)} aria-label="Edit selected task"><Icons.MoreHorizontal size={18}/></button><button onClick={() => setSelectedId(null)} aria-label="Close task details"><Icons.X size={18}/></button></div></div><h2>{display(selected.title)}</h2><p className="task-list-panel__summary">{selected.description ? display(selected.description) : "No description yet."}</p><div className="task-list-panel__properties"><button onClick={() => onEdit(selected)}><span className={`task-list-status task-list-status--${String(selected.status)}`}>{display(selected.status)}</span><Icons.ChevronDown size={13}/></button><button onClick={() => onEdit(selected)}><span className={`priority priority--${String(selected.priority ?? "none")}`}>{display(selected.priority)}</span><Icons.ChevronDown size={13}/></button><button onClick={() => onEdit(selected)}><span className="task-list-owner"><i>{String(selected.assigned_to_name ?? selected.owner_name ?? "Y").slice(0,1).toUpperCase()}</i>{display(selected.assigned_to_name ?? selected.owner_name ?? "You")}</span><Icons.ChevronDown size={13}/></button><button onClick={() => onEdit(selected)}><Icons.CalendarDays size={14}/>{selected.due_date ? formatDate(selected.due_date) : "No date"}</button></div><div className="task-list-panel__tabs" role="tablist" aria-label="Task details"><button role="tab" aria-selected={panelTab === "details"} onClick={() => setPanelTab("details")}>Details</button><button role="tab" aria-selected={panelTab === "files"} onClick={() => setPanelTab("files")}>Files</button></div>{panelTab === "details" ? <div className="task-list-panel__body"><section><h3><Icons.FileText size={16}/> Description</h3><p>{selected.description ? display(selected.description) : "Add a description to capture the context for this task."}</p><button onClick={() => onEdit(selected)}>Edit description</button></section>{Number(selected.target_count ?? 0) > 0 && <section><h3><Icons.Target size={16}/> Progress target</h3><p>{Number(selected.current_count ?? 0).toLocaleString()} of {Number(selected.target_count).toLocaleString()} complete</p><div className="task-list-panel__track"><span style={{width:`${Math.min(100,Number(selected.current_count ?? 0)/Number(selected.target_count)*100)}%`}}/></div><button onClick={() => onEdit(selected)}>Log progress</button></section>}</div> : <div className="task-list-panel__files"><AttachmentSection entityType="task" entityId={selected.id}/></div>}</aside>}
    </div>;
}
const COLUMN_COLORS_KEY = "dcc-task-column-colors";

const COLUMN_PALETTE_PRESETS = [
    { name: "Indigo", hex: "#5B5BD6" },
    { name: "Blue", hex: "#3B82F6" },
    { name: "Sky", hex: "#0EA5E9" },
    { name: "Cyan", hex: "#06B6D4" },
    { name: "Teal", hex: "#14B8A6" },
    { name: "Emerald", hex: "#10B981" },
    { name: "Green", hex: "#22C55E" },
    { name: "Lime", hex: "#84CC16" },
    { name: "Amber", hex: "#F59E0B" },
    { name: "Orange", hex: "#F97316" },
    { name: "Coral", hex: "#FF6B6B" },
    { name: "Crimson", hex: "#E5484D" },
    { name: "Pink", hex: "#EC4899" },
    { name: "Purple", hex: "#8B5CF6" },
    { name: "Slate", hex: "#64748B" },
    { name: "Zinc", hex: "#71717A" },
];

function ColumnColorPalette({
    status,
    currentColor,
    onSelect,
    onReset,
    onClose,
}: {
    status: string;
    currentColor?: string;
    onSelect: (hex: string) => void;
    onReset: () => void;
    onClose: () => void;
}) {
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose();
            }
        }
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose]);

    return (
        <div className="task-board__palette-popover" ref={popoverRef} role="dialog" aria-label={`Color palette for ${display(status)}`}>
            <div className="task-board__palette-header">
                <div className="task-board__palette-title">
                    <Icons.Palette size={12} />
                    <span>Column color</span>
                    <span className="task-board__palette-status-pill">{display(status)}</span>
                </div>
                <button type="button" className="task-board__palette-close" onClick={onClose} aria-label="Close color palette">
                    <Icons.X size={12} />
                </button>
            </div>

            <div className="task-board__palette-grid">
                {COLUMN_PALETTE_PRESETS.map((item) => {
                    const isSelected = currentColor?.toLowerCase() === item.hex.toLowerCase();
                    return (
                        <button
                            key={item.hex}
                            type="button"
                            className={`task-board__palette-swatch ${isSelected ? "is-active" : ""}`}
                            style={{ backgroundColor: item.hex }}
                            onClick={() => {
                                onSelect(item.hex);
                                onClose();
                            }}
                            title={item.name}
                            aria-label={`Select ${item.name}`}
                        >
                            {isSelected ? <Icons.Check size={11} strokeWidth={3} className="task-board__swatch-check" /> : null}
                        </button>
                    );
                })}
            </div>

            <div className="task-board__palette-footer">
                <label className="task-board__palette-custom-btn" title="Pick custom color">
                    <span className="task-board__palette-rainbow-dot" style={currentColor ? { backgroundColor: currentColor } : undefined} />
                    <span>Custom</span>
                    <input
                        type="color"
                        value={currentColor || "#5B5BD6"}
                        onChange={(e) => onSelect(e.target.value)}
                        className="sr-only"
                    />
                </label>

                <button
                    type="button"
                    className="task-board__palette-reset-btn"
                    onClick={() => {
                        onReset();
                        onClose();
                    }}
                    disabled={!currentColor}
                    title="Reset to default color"
                >
                    <Icons.RotateCcw size={11} />
                    <span>Reset</span>
                </button>
            </div>
        </div>
    );
}

function TaskBoard({
    rows,
    onEdit,
    onToggle,
    onMoveTask,
    onAddTaskInStatus,
    empty
}: {
    rows: DomainRecord[];
    onEdit: (record: DomainRecord) => void;
    onToggle: (record: DomainRecord) => Promise<void>;
    onMoveTask: (record: DomainRecord, newStatus: string, targetIndex?: number) => Promise<void>;
    onAddTaskInStatus: (status: string) => void;
    empty: ReactNode;
}) {
    const columns = ["inbox", "planned", "in_progress", "waiting", "still_waiting", "blocked", "completed", "cancelled"] as const;

    const [columnColors, setColumnColors] = useState<Record<string, string>>({});
    const [openPaletteStatus, setOpenPaletteStatus] = useState<string | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
    const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
    const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(null);

    useDeferredEffect(useCallback(() => {
        try {
            const saved = localStorage.getItem(COLUMN_COLORS_KEY);
            if (saved) {
                setColumnColors(JSON.parse(saved));
            }
        } catch {}
    }, []));

    if (!rows.length) return <div className="data-surface">{empty}</div>;

    const handleSelectColor = (status: string, hex: string) => {
        setColumnColors((prev) => {
            const next = { ...prev, [status]: hex };
            try {
                localStorage.setItem(COLUMN_COLORS_KEY, JSON.stringify(next));
            } catch {}
            return next;
        });
    };

    const handleResetColor = (status: string) => {
        setColumnColors((prev) => {
            const next = { ...prev };
            delete next[status];
            try {
                localStorage.setItem(COLUMN_COLORS_KEY, JSON.stringify(next));
            } catch {}
            return next;
        });
    };

    const handleDragStart = (e: React.DragEvent, recordId: string) => {
        e.dataTransfer.setData("text/plain", recordId);
        e.dataTransfer.effectAllowed = "move";
        setDraggingId(recordId);
    };

    const handleDragEnd = () => {
        setDraggingId(null);
        setDragOverStatus(null);
        setDragOverCardId(null);
        setDropPosition(null);
    };

    const handleColumnDragOver = (e: React.DragEvent, status: string) => {
        if (!draggingId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragOverStatus !== status) setDragOverStatus(status);
    };

    const handleColumnDrop = (e: React.DragEvent, status: string) => {
        e.preventDefault();
        const droppedId = e.dataTransfer.getData("text/plain") || draggingId;
        handleDragEnd();
        if (!droppedId) return;
        const task = rows.find((r) => r.id === droppedId);
        if (!task) return;
        void onMoveTask(task, status);
    };

    const handleCardDragOver = (e: React.DragEvent, status: string, cardId: string) => {
        if (!draggingId || draggingId === cardId) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        const rect = e.currentTarget.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const pos = e.clientY < midY ? "before" : "after";
        if (dragOverStatus !== status) setDragOverStatus(status);
        if (dragOverCardId !== cardId || dropPosition !== pos) {
            setDragOverCardId(cardId);
            setDropPosition(pos);
        }
    };

    const handleCardDrop = (e: React.DragEvent, status: string, targetCardId: string, columnRows: DomainRecord[]) => {
        e.preventDefault();
        e.stopPropagation();
        const droppedId = e.dataTransfer.getData("text/plain") || draggingId;
        const currentPos = dropPosition;
        handleDragEnd();
        if (!droppedId) return;
        const task = rows.find((r) => r.id === droppedId);
        if (!task) return;
        const cardIndex = columnRows.findIndex((r) => r.id === targetCardId);
        const targetIndex = currentPos === "after" ? cardIndex + 1 : cardIndex;
        void onMoveTask(task, status, targetIndex);
    };

    return <section className="task-board" aria-label="Task board">
        {columns.map((status) => {
            const columnRows = status === "still_waiting"
                ? rows.filter((record) => isTaskPastDue(record))
                : rows.filter((record) => String(record.status) === status && !isTaskPastDue(record));
            const customColor = columnColors[status];
            const columnStyle = customColor ? {
                backgroundColor: `color-mix(in srgb, ${customColor} 7.5%, var(--surface-2))`,
                borderColor: `color-mix(in srgb, ${customColor} 24%, var(--line))`
            } : undefined;
            const badgeStyle = customColor ? {
                backgroundColor: `color-mix(in srgb, ${customColor} 14%, var(--surface-2))`,
                color: customColor,
                borderColor: `color-mix(in srgb, ${customColor} 32%, transparent)`
            } : undefined;

            const isColDragOver = dragOverStatus === status && !!draggingId;

            return <section
                className={`task-board__column ${isColDragOver ? "is-drag-over" : ""}`}
                data-status={status}
                key={status}
                style={columnStyle}
                onDragOver={(e) => handleColumnDragOver(e, status)}
                onDragEnter={(e) => {
                    if (draggingId) {
                        e.preventDefault();
                        setDragOverStatus(status);
                    }
                }}
                onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        if (dragOverStatus === status) {
                            setDragOverStatus(null);
                            setDragOverCardId(null);
                            setDropPosition(null);
                        }
                    }
                }}
                onDrop={(e) => handleColumnDrop(e, status)}
                onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (
                        !target.closest(".task-card") &&
                        !target.closest(".task-board__title-anchor") &&
                        !target.closest(".task-board__column-add-btn")
                    ) {
                        onAddTaskInStatus(status);
                    }
                }}
            >
                <header>
                    <div className="task-board__title-anchor">
                        <span className="task-board__lane-icon">{status === "inbox" ? <Icons.Inbox size={19}/> : status === "planned" ? <Icons.CalendarDays size={19}/> : status === "in_progress" ? <Icons.Focus size={19}/> : status === "waiting" ? <Icons.Clock3 size={19}/> : status === "still_waiting" ? <Icons.Clock3 size={19}/> : status === "completed" ? <Icons.Check size={19}/> : status === "blocked" ? <Icons.ShieldCheck size={19}/> : <Icons.X size={19}/>}</span>
                        <div className="task-board__lane-copy">
                        <button
                            type="button"
                            className="task-board__title-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpenPaletteStatus(openPaletteStatus === status ? null : status);
                            }}
                            title="Click to customize column color"
                            aria-expanded={openPaletteStatus === status}
                        >
                            <span className={`status status--${status}`} style={badgeStyle}>
                                {customColor ? <span className="status-color-dot" style={{ backgroundColor: customColor }} /> : null}
                                {status === "still_waiting" ? "Still Waiting" : display(status)}
                                <Icons.Palette size={10} className="task-board__title-palette-icon" />
                            </span>
                        </button>
                        <p>{status === "inbox" ? "New tasks and ideas" : status === "planned" ? "Approved and scheduled" : status === "in_progress" ? "Actively working on" : status === "waiting" ? "Blocked or awaiting input" : status === "still_waiting" ? "Longer term or on hold" : status === "completed" ? "Finished work" : status === "blocked" ? "Needs intervention" : "No longer active"}</p>
                        </div>
                        {openPaletteStatus === status && (
                            <ColumnColorPalette
                                status={status}
                                currentColor={customColor}
                                onSelect={(hex) => handleSelectColor(status, hex)}
                                onReset={() => handleResetColor(status)}
                                onClose={() => setOpenPaletteStatus(null)}
                            />
                        )}
                    </div>
                    <div className="task-board__header-actions">
                        <small>{columnRows.length}</small>
                        <button
                            type="button"
                            className="task-board__column-add-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAddTaskInStatus(status);
                            }}
                            title={`Add task to ${status === "still_waiting" ? "Still Waiting" : display(status)}`}
                            aria-label={`Add task to ${status === "still_waiting" ? "Still Waiting" : display(status)}`}
                        >
                            <Icons.Plus size={11} />
                        </button>
                    </div>
                </header>
                <div
                    className="task-board__cards"
                    onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (!target.closest(".task-card")) {
                            onAddTaskInStatus(status);
                        }
                    }}
                >
                    {columnRows.length === 0 ? (
                        <div className={`task-board__empty-area ${isColDragOver ? "is-drag-over" : ""}`} />
                    ) : (
                        columnRows.map((record) => {
                            const done = record.status === "completed";
                            const isBeingDragged = draggingId === record.id;
                            const isOverThisCard = dragOverCardId === record.id;

                            return <article
                                className={`task-card ${record.target_count != null && Number(record.target_count) > 0 ? "task-card--with-progress" : "task-card--compact"} ${isBeingDragged ? "is-dragging" : ""}`}
                                key={record.id}
                                draggable
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(record);
                                }}
                                onDragStart={(e) => handleDragStart(e, record.id)}
                                onDragEnd={handleDragEnd}
                                onDragOver={(e) => handleCardDragOver(e, status, record.id)}
                                onDrop={(e) => handleCardDrop(e, status, record.id, columnRows)}
                            >
                                {isOverThisCard && dropPosition === "before" && (
                                    <span className="task-card__drop-indicator task-card__drop-indicator--top" />
                                )}
                                <div className="task-card__head">
                                    <div className="task-card__head-left">
                                        <button
                                            className="task-check"
                                            aria-label={`${done ? "Reopen" : "Complete"} ${record.title}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                void onToggle(record);
                                            }}
                                            draggable={false}
                                        >
                                            {done ? <Icons.Check size={13}/> : null}
                                        </button>
                                        <span className="task-card__grip" title="Drag to move task">
                                            <Icons.GripVertical size={13}/>
                                        </span>
                                        <button
                                            className="task-card__title"
                                            onClick={(e) => { e.stopPropagation(); onEdit(record); }}
                                        ><strong>{display(record.title)}</strong></button>
                                    </div>
                                    <button
                                        className="task-card__menu"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit(record);
                                        }}
                                        aria-label={`Open ${record.title}`}
                                        draggable={false}
                                    >
                                        <Icons.MoreHorizontal size={16}/>
                                    </button>
                                </div>
                                <div className="task-card__metadata"><span className={`priority priority--${String(record.priority ?? "none")}`}>{display(record.priority)}</span>{record.due_date ? <time><Icons.CalendarDays size={13}/>{formatDate(record.due_date)}</time> : null}</div>
                                {record.description ? <p className="task-card__description">{display(record.description)}</p> : null}
                                {/* Mini progress bar for goal tasks */}
                                {record.target_count != null && Number(record.target_count) > 0 && (
                                    <div className="task-card__progress-wrap">
                                        <div
                                            className="task-card__progress"
                                            role="progressbar"
                                            aria-valuenow={Math.min(100, (Number(record.current_count ?? 0) / Number(record.target_count)) * 100)}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                        >
                                            <div
                                                className="task-card__progress-fill"
                                                style={{ width: `${Math.min(100, (Number(record.current_count ?? 0) / Number(record.target_count)) * 100)}%` }}
                                            />
                                        </div>
                                        <span className="task-card__progress-label">
                                            {Number(record.current_count ?? 0).toLocaleString()} / {Number(record.target_count).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                <footer>
                                    <span className="task-card__owner"><span>{String(record.assigned_to_name ?? record.owner_name ?? "Y").slice(0,1).toUpperCase()}</span>{display(record.assigned_to_name ?? record.owner_name ?? "You")}</span>
                                    {record.target_count != null && Number(record.target_count) > 0 ? <span className="task-card__goal-count"><Icons.ListTodo size={14}/>{Number(record.current_count ?? 0).toLocaleString()}/{Number(record.target_count).toLocaleString()}</span> : null}
                                    {record.recurrence_frequency ? (
                                        <span className="task-card__repeat-badge" title={`Repeats: ${String(record.recurrence_frequency)}`}>
                                            <Icons.RotateCcw size={10}/>
                                        </span>
                                    ) : null}
                                </footer>

                                {isOverThisCard && dropPosition === "after" && (
                                    <span className="task-card__drop-indicator task-card__drop-indicator--bottom" />
                                )}
                            </article>;
                        })
                    )}
                </div>
            </section>;
        })}
    </section>;
}
function QuickCreateRelationModal({
    open,
    onClose,
    relation,
    label,
    onCreated,
}: {
    open: boolean;
    onClose: () => void;
    relation: Field["relation"];
    label: string;
    onCreated: (record: DomainRecord) => void;
}) {
    const [name, setName] = useState("");
    const [secondary, setSecondary] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useDeferredEffect(useCallback(() => {
        if (open) {
            setName("");
            setSecondary(relation === "goals" ? "quarter" : "");
            setError("");
        }
    }, [open, relation]));

    if (!open || !relation) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            setError("Title or name is required.");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const body: Record<string, unknown> = {};
            if (relation === "goals") {
                body.title = trimmed;
                body.period = secondary || "quarter";
                body.status = "active";
            } else if (relation === "projects") {
                body.name = trimmed;
                if (secondary.trim()) body.description = secondary.trim();
                body.status = "active";
            } else if (relation === "clients") {
                body.name = trimmed;
                if (secondary.trim()) body.company = secondary.trim();
                body.status = "active";
            } else {
                body.name = trimmed;
                body.title = trimmed;
            }

            const response = await fetch(`/api/entities/${relation}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error ?? "Failed to create.");
            onCreated(data.record);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not create record.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={`New ${label}`}
            description={`Create a new ${label.toLowerCase()} directly without leaving this page.`}
        >
            <form className="simple-form" onSubmit={handleSubmit} noValidate>
                <div>
                    <label htmlFor="quick-relation-name">
                        {relation === "goals" ? "Goal title" : `${label} name`} <span>Required</span>
                    </label>
                    <input
                        id="quick-relation-name"
                        type="text"
                        autoFocus
                        required
                        value={name}
                        placeholder={
                            relation === "goals"
                                ? "e.g., Reach $20k MRR"
                                : relation === "projects"
                                ? "e.g., Client Brand Redesign"
                                : "e.g., Acme Studio"
                        }
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>

                {relation === "goals" ? (
                    <div>
                        <label htmlFor="quick-relation-period">Period</label>
                        <select
                            id="quick-relation-period"
                            value={secondary}
                            onChange={(e) => setSecondary(e.target.value)}
                        >
                            <option value="quarter">Quarter</option>
                            <option value="month">Month</option>
                            <option value="week">Week</option>
                        </select>
                    </div>
                ) : relation === "clients" ? (
                    <div>
                        <label htmlFor="quick-relation-company">Company <span>Optional</span></label>
                        <input
                            id="quick-relation-company"
                            type="text"
                            value={secondary}
                            placeholder="e.g., Acme Corp"
                            onChange={(e) => setSecondary(e.target.value)}
                        />
                    </div>
                ) : relation === "projects" ? (
                    <div>
                        <label htmlFor="quick-relation-desc">Description <span>Optional</span></label>
                        <textarea
                            id="quick-relation-desc"
                            rows={3}
                            value={secondary}
                            placeholder="Brief context or milestone"
                            onChange={(e) => setSecondary(e.target.value)}
                        />
                    </div>
                ) : null}

                {error ? <p className="field-error" role="alert">{error}</p> : null}

                <div className="modal__actions">
                    <Button emphasis="ghost" type="button" onClick={onClose}>Cancel</Button>
                    <Button intent="brand" type="submit" disabled={saving}>
                        {saving ? "Creating…" : `Create & select ${label.toLowerCase()}`}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

const RECURRENCE_OPTIONS = [
    { value: "", label: "Does not repeat" },
    { value: "daily", label: "Every day" },
    { value: "weekly", label: "Every week" },
    { value: "monthly", label: "Every month" },
    { value: "mon", label: "Every Monday" },
    { value: "tue", label: "Every Tuesday" },
    { value: "wed", label: "Every Wednesday" },
    { value: "thu", label: "Every Thursday" },
    { value: "fri", label: "Every Friday" },
    { value: "sat", label: "Every Saturday" },
    { value: "sun", label: "Every Sunday" },
];

function TaskDetailForm({ fields, values, setValues, editing, saving, error, archiveArmed, deleteArmed, onArchive, onDelete, onClose, onSubmit, attachments, onProgressLogged }: {
    fields: Field[];
    values: Record<string, string>;
    setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    editing: DomainRecord | null;
    saving: boolean;
    error: string;
    archiveArmed: boolean;
    deleteArmed: boolean;
    onArchive: (record: DomainRecord) => Promise<void>;
    onDelete: (record: DomainRecord) => Promise<void>;
    onClose: () => void;
    onSubmit: (event: React.FormEvent) => Promise<void>;
    attachments?: ReactNode;
    onProgressLogged?: (record: DomainRecord) => void;
}) {
    const byKey = Object.fromEntries(fields.map((field) => [field.key, field]));
    const renderField = (key: string, className?: string, placeholder?: string) => byKey[key] ? <FormField className={className} field={byKey[key]} value={values[key] ?? ""} placeholder={placeholder} setValue={(value) => setValues((current) => ({ ...current, [key]: value }))}/> : null;

    // Recurrence state
    const recurrence = values["recurrence_frequency"] ?? "";
    const isRecurring = recurrence !== "" && recurrence !== "null";

    // Goal task state
    const targetCount = parseFloat(values["target_count"] ?? "") || null;
    const currentCount = parseFloat(values["current_count"] ?? "") || 0;
    const dailyTarget = parseFloat(values["daily_target"] ?? "") || null;
    const isGoalTask = targetCount != null && targetCount > 0;
    const progressPct = isGoalTask ? Math.min(100, (currentCount / targetCount) * 100) : 0;

    // Inline progress log
    const [logAmount, setLogAmount] = useState("");
    const [logSaving, setLogSaving] = useState(false);
    const [logError, setLogError] = useState("");
    const [showGoalPanel, setShowGoalPanel] = useState(isGoalTask);

    async function handleLogProgress(e: React.FormEvent) {
        e.preventDefault();
        const amount = parseFloat(logAmount);
        if (!editing || isNaN(amount) || amount <= 0) { setLogError("Enter a positive number."); return; }
        if (!targetCount || targetCount <= 0) { setLogError("Enter a target total before logging progress."); return; }
        setLogSaving(true); setLogError("");
        try {
            const targetChanged = Number(editing.target_count ?? 0) !== targetCount || Number(editing.daily_target ?? 0) !== Number(dailyTarget ?? 0);
            if (targetChanged) {
                const saveTarget = await fetch(`/api/entities/tasks/${editing.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ target_count: targetCount, daily_target: dailyTarget }),
                });
                const saved = await saveTarget.json();
                if (!saveTarget.ok) throw new Error(saved.error ?? "Progress target could not be saved.");
                onProgressLogged?.(saved.record as DomainRecord);
            }
            const res = await fetch(`/api/tasks/${editing.id}/progress`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Progress could not be recorded.");
            setLogAmount("");
            // Update local values to reflect new count
            const rec = data.record as DomainRecord;
            setValues((current) => ({
                ...current,
                current_count: String(rec.current_count ?? "0"),
                status: String(rec.status ?? current.status),
            }));
            onProgressLogged?.(rec);
        } catch (err) {
            setLogError(err instanceof Error ? err.message : "Error recording progress.");
        } finally {
            setLogSaving(false);
        }
    }

    return <form className="task-detail-workspace" onSubmit={onSubmit} noValidate>
        <section className="task-detail-main" aria-label="Task content">
            <div className="task-title-field">
                <label htmlFor="record-title">
                    <span>Task Name</span>
                    <span className="task-title-required">Required</span>
                </label>
                <input
                    id="record-title"
                    type="text"
                    required
                    autoFocus={!editing}
                    value={values["title"] ?? ""}
                    placeholder="What needs to be done? (Write task name here…)"
                    onChange={(e) => setValues((current) => ({ ...current, title: e.target.value }))}
                />
            </div>
            <div className="task-detail-section-heading"><Icons.FileText size={15}/><div><strong>Description</strong><span>Add the context needed to complete this task.</span></div></div>
            {renderField("description", "task-description-field", "Add notes, checklist, links, or context…")}

            {/* ── Goal Task Panel ─────────────────────────────────── */}
            <div className="task-detail-section-heading task-detail-section-heading--toggle">
                <Icons.Target size={15}/>
                <div><strong>Goal progress</strong><span>Track a cumulative target for this task.</span></div>
                <button
                    type="button"
                    className={`task-panel-toggle ${showGoalPanel ? "is-active" : ""}`}
                    onClick={() => setShowGoalPanel((v) => !v)}
                    aria-expanded={showGoalPanel}
                >
                    {showGoalPanel ? "Hide" : "Set up"}
                </button>
            </div>
            {showGoalPanel && (
                <div className="task-goal-panel">
                    <div className="task-goal-fields">
                        <label className="task-goal-field-label">
                            <span>Target total</span>
                            <input
                                type="number"
                                min="1"
                                step="any"
                                className="task-goal-input"
                                placeholder="e.g. 1000"
                                value={values["target_count"] ?? ""}
                                onChange={(e) => setValues((c) => ({ ...c, target_count: e.target.value }))}
                            />
                        </label>
                        <label className="task-goal-field-label">
                            <span>Daily target</span>
                            <input
                                type="number"
                                min="1"
                                step="any"
                                className="task-goal-input"
                                placeholder="e.g. 20"
                                value={values["daily_target"] ?? ""}
                                onChange={(e) => setValues((c) => ({ ...c, daily_target: e.target.value }))}
                            />
                        </label>
                    </div>

                    {/* Progress bar — only visible when editing an existing goal task */}
                    {editing && isGoalTask && (
                        <div className="task-goal-progress-section">
                            <div className="task-goal-progress-header">
                                <span className="task-goal-progress-label">
                                    <strong>{currentCount.toLocaleString()}</strong>
                                    <span> / {targetCount!.toLocaleString()}</span>
                                </span>
                                <span className="task-goal-progress-pct">{Math.round(progressPct)}%</span>
                            </div>
                            <div className="task-progress-bar" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
                                <div className="task-progress-bar__fill" style={{ width: `${progressPct}%` }} />
                            </div>
                            {dailyTarget && (
                                <p className="task-goal-daily-hint">
                                    At {dailyTarget.toLocaleString()} per day — {Math.ceil((targetCount! - currentCount) / dailyTarget)} days remaining
                                </p>
                            )}
                            {/* Inline log */}
                            {values["status"] !== "completed" && (
                                <div className="task-goal-log-row" onSubmit={handleLogProgress}>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="any"
                                        className="task-goal-log-input"
                                        placeholder={dailyTarget ? `Log amount (target: ${dailyTarget})` : "Enter amount"}
                                        value={logAmount}
                                        onChange={(e) => { setLogAmount(e.target.value); setLogError(""); }}
                                    />
                                    <button
                                        type="button"
                                        className="task-goal-log-btn"
                                        disabled={logSaving || !logAmount}
                                        onClick={(e) => void handleLogProgress(e as unknown as React.FormEvent)}
                                    >
                                        {logSaving ? "Saving…" : "Log progress"}
                                    </button>
                                </div>
                            )}
                            {logError ? <p className="field-error" role="alert">{logError}</p> : null}
                            {values["status"] === "completed" && progressPct >= 100 && (
                                <p className="task-goal-complete-note">🎉 Target reached! Task marked as completed.</p>
                            )}
                        </div>
                    )}
                </div>
            )}
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
                {renderField("goal_id")}{renderField("work_classification")}
            </div>

            {/* ── Recurrence Panel ───────────────────────────────── */}
            <div className="task-recurrence-panel">
                <label className="task-recurrence-toggle-row">
                    <div className="task-recurrence-toggle-label">
                        <Icons.RotateCcw size={13}/>
                        <span>Repeat</span>
                    </div>
                    <input
                        type="checkbox"
                        className="task-recurrence-checkbox sr-only"
                        id="recurrence-toggle"
                        checked={isRecurring}
                        onChange={(e) => setValues((c) => ({ ...c, recurrence_frequency: e.target.checked ? "daily" : "" }))}
                    />
                    <label htmlFor="recurrence-toggle" className="task-recurrence-switch" aria-label="Toggle recurrence"/>
                </label>
                {isRecurring && (
                    <div className="task-recurrence-freq">
                        <select
                            className="task-recurrence-select"
                            value={recurrence}
                            onChange={(e) => setValues((c) => ({ ...c, recurrence_frequency: e.target.value }))}
                            aria-label="Recurrence frequency"
                        >
                            {RECURRENCE_OPTIONS.filter((o) => o.value !== "").map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                        <p className="task-recurrence-hint">A new task will be created automatically when this one is completed.</p>
                    </div>
                )}
            </div>
        </aside>

        {attachments ? <div className="task-related">{attachments}</div> : null}
        {error ? <p className="field-error task-detail-error" role="alert">{error}</p> : null}
        <div className="modal__actions task-detail-actions">
            {editing ? (
                <div className="task-destructive-actions">
                    <Button emphasis="danger" type="button" onClick={() => void onDelete(editing)} title="Permanently delete this task">
                        <Icons.Trash2 size={13}/>
                        <span>{deleteArmed ? "Confirm permanent delete" : "Delete"}</span>
                    </Button>
                    <Button emphasis="outline" type="button" onClick={() => void onArchive(editing)} title="Archive this task">
                        <Icons.Archive size={13}/>
                        <span>{archiveArmed ? "Confirm archive" : "Archive"}</span>
                    </Button>
                </div>
            ) : null}
            <span className="task-detail-actions__spacer"/>
            <Button emphasis="ghost" type="button" onClick={onClose}>Cancel</Button>
            <Button intent="brand" type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create task"}</Button>
        </div>
    </form>;
}

function formatDate(value: unknown) { if (!value) return "No date"; const date = new Date(`${String(value).slice(0,10)}T12:00:00`); return date.toLocaleDateString([], { month: "short", day: "numeric" }); }
function FormField({ field, value, setValue, className, placeholder }: {
    field: Field;
    value: string;
    setValue: (value: string) => void;
    className?: string;
    placeholder?: string;
}) {
    const id = `record-${field.key}`;
    const [relations, setRelations] = useState<DomainRecord[]>([]);
    const [quickModalOpen, setQuickModalOpen] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        if (!field.relation) return;
        let active = true;
        fetch(`/api/entities/${field.relation}`, { cache: "no-store" })
            .then((response) => response.json())
            .then((data) => {
                if (active) setRelations(data.records ?? []);
            })
            .catch(() => {
                if (active) setRelations([]);
            });
        return () => { active = false; };
    }, [field.relation]);

    return (
        <div className={className}>
            {field.type === "relation" ? (
                <div className="field-label-row">
                    <label htmlFor={id}>
                        {field.label}{!field.required ? <span> Optional</span> : null}
                    </label>
                    <button
                        type="button"
                        className="field-inline-create-btn"
                        onClick={() => setQuickModalOpen(true)}
                        title={`Create new ${field.label.toLowerCase()}`}
                    >
                        <Icons.Plus size={11} />
                        <span>New</span>
                    </button>
                </div>
            ) : (
                <label htmlFor={id}>
                    {field.label}{!field.required ? <span> Optional</span> : null}
                </label>
            )}

            {field.type === "textarea" ? (
                <textarea
                    className="resize-none"
                    id={id}
                    rows={4}
                    required={field.required}
                    value={value}
                    placeholder={placeholder}
                    onChange={(event) => setValue(event.target.value)}
                />
            ) : field.type === "select" ? (
                <select id={id} value={value} onChange={(event) => setValue(event.target.value)}>
                    {field.options?.map((option) => (
                        <option value={option} key={option}>{display(option)}</option>
                    ))}
                </select>
            ) : field.type === "relation" ? (
                <>
                    <select
                        id={id}
                        value={value}
                        onChange={(event) => {
                            if (event.target.value === "__create_new__") {
                                setQuickModalOpen(true);
                            } else {
                                setValue(event.target.value);
                            }
                        }}
                    >
                        <option value="">No {field.label.toLowerCase()}</option>
                        {relations.map((record) => (
                            <option value={record.id} key={record.id}>
                                {String(record.name ?? record.title)}
                            </option>
                        ))}
                        <option value="__create_new__">+ Create new {field.label.toLowerCase()}…</option>
                    </select>
                    <QuickCreateRelationModal
                        open={quickModalOpen}
                        onClose={() => setQuickModalOpen(false)}
                        relation={field.relation}
                        label={field.label}
                        onCreated={(record) => {
                            setRelations((current) => [record, ...current]);
                            setValue(record.id);
                            showToast(`Created & selected ${String(record.name ?? record.title)}.`);
                            if (field.relation) announceWorkspaceMutation(field.relation);
                        }}
                    />
                </>
            ) : field.type === "date" ? (
                <DatePicker
                    id={id}
                    value={value}
                    placeholder={placeholder || `Select ${field.label.toLowerCase()}`}
                    required={field.required}
                    onChange={setValue}
                />
            ) : (
                <input
                    id={id}
                    type={field.type ?? "text"}
                    required={field.required}
                    value={value}
                    placeholder={placeholder}
                    onChange={(event) => setValue(event.target.value)}
                />
            )}
        </div>
    );
}
function normalizeInput(value: string, field: Field) { if (field.type === "number" || field.key === "daily_position")
    return normalizeOptionalNumberInput(value); if(value==="true"||value==="false")return value==="true"; if (field.type === "datetime-local")
    return value ? new Date(value).toISOString() : null; return value || null; }
function toInputValue(value: unknown, type: Field["type"]) { if (value == null)
    return ""; if (type === "datetime-local") {
    const date = new Date(String(value));
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
} return String(value); }
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
}) { const areas = [{heading:"Workspace", links:[{href:"/settings/integrations",title:"Integrations",detail:"Review connected calendar, mail, files, code, and fitness services"},{href:"/settings/notifications",title:"Notifications",detail:"Control which signals can enter Today"}]},{heading:"Operating systems",links:[{href:"/settings/business",title:"Business",detail:"Configure business operating preferences"},{href:"/settings/chief-of-staff",title:"Chief of Staff",detail:"Review autonomy and action safety settings"}]}]; return <div className="domain-page"><header className="task-context-header"><div><nav className="task-context-header__breadcrumb" aria-label="Breadcrumb"><span>Workspace</span><span>/</span><span className="current">{config.title}</span></nav><div className="task-context-header__title-row"><h1>{config.title}</h1></div><p className="task-context-header__description">{config.intro}</p></div></header>{areas.map((area)=><section className="settings-area" key={area.heading}><h2>{area.heading}</h2><div className="data-surface">{area.links.map((item)=><Link className="data-row" href={item.href} key={item.href}><strong>{item.title}</strong><span>{item.detail}</span><span>Manage</span><Icons.MoreHorizontal size={17}/></Link>)}</div></section>)}</div>; }
