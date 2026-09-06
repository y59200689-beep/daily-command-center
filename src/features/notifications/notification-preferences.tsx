"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import { notificationCategories } from "@/lib/v4-notifications";

const labels: Record<string, string> = { tasks: "Tasks", calendar: "Calendar", clients: "Clients", finance: "Finance", content: "Content", decisions: "Decisions", fitness: "Fitness", integrations: "Integrations", automations: "Automations" };
type Level = "off" | "important" | "all";

export function NotificationPreferences() {
  const [values, setValues] = useState<Record<string, Level>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error();
    const next: Record<string, Level> = {};
    for (const category of notificationCategories) {
      const item = body.preferences?.find((row: { category: string }) => row.category === category);
      next[category] = !item || item.enabled === false ? "off" : item.minimum_severity === "low" ? "all" : "important";
    }
    setValues(next);
  }, []);

  useDeferredEffect(useCallback(() => {
    void load().catch(() => setError("Preferences could not be loaded."));
  }, [load]));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: notificationCategories.map((category) => ({ category, level: values[category] ?? "off" })) }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setError("Preferences could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="domain-page notification-settings"><header className="page-header"><div><p className="eyebrow">Settings · Attention</p><h1>Notifications</h1><p>Choose which signals can interrupt your day. Important only keeps the attention layer quiet.</p></div></header><section className="data-surface">{notificationCategories.map((category) => <div className="notification-preference" key={category}><div><strong>{labels[category]}</strong><small>Important only includes overdue, blocked, or time-sensitive signals.</small></div><fieldset aria-label={`${labels[category]} notification level`}>{(["off", "important", "all"] as Level[]).map((level) => <label key={level}><input type="radio" name={category} checked={values[category] === level} onChange={() => setValues({ ...values, [category]: level })} />{level === "off" ? "Off" : level === "important" ? "Important only" : "All"}</label>)}</fieldset></div>)}{error ? <p className="field-error">{error}</p> : null}<Button disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save preferences"}</Button></section></div>;
}
