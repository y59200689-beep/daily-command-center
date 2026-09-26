import Link from "next/link";
import type { ReactNode } from "react";

export type WorkspaceTab = { id: string; label: string };

export function WorkspaceTabs({ title, base, tabs, active, children }: { title: string; base: string; tabs: readonly WorkspaceTab[]; active: string; children: ReactNode }) {
  return <div className="consolidated-workspace">
    <nav className="consolidated-workspace__tabs" aria-label={`${title} sections`}>
      {tabs.map((tab) => <Link key={tab.id} href={`${base}?view=${tab.id}`} aria-current={active === tab.id ? "page" : undefined} className={active === tab.id ? "consolidated-workspace__tab is-active" : "consolidated-workspace__tab"}>{tab.label}</Link>)}
    </nav>
    {children}
  </div>;
}

export async function selectedView(searchParams: Promise<{ view?: string | string[] }>, allowed: readonly string[], fallback: string) {
  const view = (await searchParams).view;
  return typeof view === "string" && allowed.includes(view) ? view : fallback;
}
