"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CommandPalette } from "@/components/command-palette";
import { Icons } from "@/components/icons";
import { QuickCapture } from "@/components/quick-capture";
import { ToastProvider } from "@/components/toast-provider";
import { setTheme, useTheme } from "@/lib/theme-store";
import { InboxBadge } from "@/components/inbox-badge";

const groups = [
  { label: "Command center", items: [
    ["Today", "/today", Icons.Zap], ["Inbox", "/inbox", Icons.Inbox], ["Tasks", "/tasks", Icons.ListTodo], ["Calendar", "/calendar", Icons.CalendarDays], ["Focus", "/focus", Icons.Focus], ["Analytics", "/analytics", Icons.ChartNoAxesCombined],
  ] },
  { label: "Workspace", items: [
    ["Projects", "/projects", Icons.BriefcaseBusiness], ["Clients", "/clients", Icons.Users], ["Follow-ups", "/followups", Icons.MessageSquareText], ["Notes", "/notes", Icons.FileText], ["Goals", "/goals", Icons.Target], ["Waiting", "/waiting", Icons.Clock3], ["Content", "/content", Icons.BookOpen], ["Campaigns", "/campaigns", Icons.Zap],
  ] },
  { label: "Knowledge", items: [
    ["Ideas", "/ideas", Icons.Lightbulb], ["Decisions", "/decisions", Icons.MessageSquareText], ["Prompts", "/prompts", Icons.Command],
  ] },
  { label: "Personal", items: [
    ["Finance", "/finance", Icons.CircleDollarSign], ["Invoices", "/finance/invoices", Icons.ReceiptText], ["Fitness", "/fitness", Icons.Dumbbell],
  ] },
] as const;

function Shell({ children,user }: { children: ReactNode;user:{name:string;initials:string} }) {
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const theme = useTheme();
  const dark = theme === "dark";

  const toggleTheme = useCallback(() => {
    setTheme(dark ? "light" : "dark");
  }, [dark]);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const typing = target.matches("input, textarea, select, [contenteditable='true']");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen(true); return; }
      if (!typing && event.key.toLowerCase() === "c") { event.preventDefault(); setCaptureOpen(true); }
      if (!typing && event.key.toLowerCase() === "f") { router.push("/focus"); }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [router]);

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className={`sidebar ${mobileMenu ? "sidebar--open" : ""}`} aria-label="Primary navigation">
        <div className="brand"><span className="brand__mark">DC</span><span><strong>Daily Command</strong><small>Personal operating system</small></span></div>
        <nav className="sidebar__nav">
          {groups.map((group) => <div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map(([label, href, Icon]) => <Link className={pathname === href || pathname.startsWith(`${href}/`) ? "nav-link nav-link--active" : "nav-link"} href={href} key={href} onClick={() => setMobileMenu(false)}><Icon size={16} strokeWidth={1.8} /><span>{label}</span>{label === "Inbox" ? <InboxBadge /> : null}</Link>)}</div>)}
        </nav>
        <div className="sidebar__footer">
          <button className="nav-link" onClick={() => setPaletteOpen(true)}><Icons.Search size={16} /><span>Search</span><kbd>⌘K</kbd></button>
          <Link className="nav-link" href="/settings"><Icons.Settings size={16} /><span>Settings</span></Link>
          <button className="profile-button" onClick={toggleTheme} aria-label={`Switch to ${dark ? "light" : "dark"} theme`}><span className="avatar">{user.initials}</span><span><strong>{user.name}</strong><small>Private workspace</small></span>{dark ? <Icons.Sun size={16} /> : <Icons.Moon size={16} />}</button>
        </div>
      </aside>
      {mobileMenu ? <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileMenu(false)} /> : null}
      <div className="workspace">
        <header className="mobile-header"><button className="icon-button" onClick={() => setMobileMenu(true)} aria-label="Open navigation"><Icons.Menu size={20} /></button><span className="mobile-brand">DAILY COMMAND</span><button className="icon-button" onClick={() => setPaletteOpen(true)} aria-label="Search"><Icons.Search size={19} /></button></header>
        <main id="main-content" className="workspace__content">{children}</main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <Link className={pathname === "/today" ? "active" : ""} href="/today"><Icons.Zap size={19} /><span>Today</span></Link>
        <Link className={pathname === "/tasks" ? "active" : ""} href="/tasks"><Icons.ListTodo size={19} /><span>Tasks</span></Link>
        <button className="capture-button" onClick={() => setCaptureOpen(true)} aria-label="Quick capture"><Icons.Plus size={23} /></button>
        <Link className={pathname === "/calendar" ? "active" : ""} href="/calendar"><Icons.CalendarDays size={19} /><span>Calendar</span></Link>
        <button onClick={() => setMobileMenu(true)}><Icons.MoreHorizontal size={19} /><span>More</span></button>
      </nav>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <QuickCapture open={captureOpen} onClose={() => setCaptureOpen(false)} />
    </div>
  );
}

export function AppShell({ children,user }: { children: ReactNode;user:{name:string;initials:string} }) {
  return <ToastProvider><Shell user={user}>{children}</Shell></ToastProvider>;
}
