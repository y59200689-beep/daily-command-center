"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import { notificationRoute } from "@/lib/v4-notifications";

type Item = Record<string, unknown> & { id: string };

const ago = (value: unknown) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(String(value)).getTime()) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
};

export function NotificationCenter({ mobile = false }: { mobile?: boolean }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const router = useRouter();
  const load = useCallback(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    const body = await response.json();
    if (response.ok) setItems(body.items ?? []);
  }, []);

  useDeferredEffect(useCallback(() => {
    void load();
  }, [load]));

  const unread = items.filter((item) => !item.read_at).length;
  const mutate = async (action: "read" | "read_all" | "dismiss", id?: string) => {
    setItems((current) => action === "dismiss"
      ? current.filter((item) => item.id !== id)
      : current.map((item) => action === "read_all" || item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...(id ? { id } : {}) }),
    });
  };
  const openItem = async (item: Item) => {
    if (!item.read_at) await mutate("read", item.id);
    setOpen(false);
    router.push(notificationRoute(String(item.type), item.entity_type ? String(item.entity_type) : null, item.entity_id ? String(item.entity_id) : null));
  };

  return <>
    <button type="button" className="icon-button notification-trigger" onClick={() => { setOpen(true); void load(); }} aria-label={unread ? `${unread} unread notifications` : "Notifications"} aria-haspopup="dialog">
      <Icons.Bell size={mobile ? 19 : 18} />
      {unread ? <span>{unread > 9 ? "9+" : unread}</span> : null}
    </button>
    <Modal open={open} onClose={() => setOpen(false)} title="Notifications" description="Signals that need a decision or your attention.">
      <div className="notification-center">
        <div className="notification-center__actions"><span>{unread ? `${unread} unread` : "Recent"}</span>{unread ? <button type="button" onClick={() => void mutate("read_all")}>Mark all read</button> : null}</div>
        {items.length ? items.map((item) => <article className={`notification-item ${item.read_at ? "" : "notification-item--unread"}`} key={item.id}>
          <button type="button" className="notification-item__open" onClick={() => void openItem(item)}><strong>{String(item.title)}</strong><span>{String(item.body ?? "")}</span><small>{String(item.type)} · {ago(item.created_at)} · {String(item.severity ?? "attention")}</small></button>
          <div><button type="button" onClick={() => void openItem(item)}>Open</button>{!item.read_at ? <button type="button" onClick={() => void mutate("read", item.id)}>Mark read</button> : null}<button type="button" onClick={() => void mutate("dismiss", item.id)}>Dismiss</button></div>
        </article>) : <div className="empty-state"><span>✓</span><h2>You&apos;re all caught up.</h2></div>}
      </div>
    </Modal>
  </>;
}
