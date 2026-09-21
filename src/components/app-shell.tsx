"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CommandPalette } from "@/components/command-palette";
import { Icons } from "@/components/icons";
import { QuickCapture } from "@/components/quick-capture";
import { ToastProvider, useToast } from "@/components/toast-provider";
import { signOutCurrentSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { setTheme, useTheme } from "@/lib/theme-store";
import { InboxBadge } from "@/components/inbox-badge";
import { NotificationCenter } from "@/features/notifications/notification-center";

type NavItem = readonly [string, string, (typeof Icons)[keyof typeof Icons]];
type Area = { label: string; href: string; icon: (typeof Icons)[keyof typeof Icons]; matches: readonly string[]; groups: ReadonlyArray<{ label: string; items: readonly NavItem[] }> };

const areas = [
  { label: "Home", href: "/today", icon: Icons.Zap, matches: ["/today", "/inbox", "/tasks", "/calendar", "/projects", "/clients"], groups: [
    { label: "My work", items: [["Today", "/today", Icons.Zap], ["Inbox", "/inbox", Icons.Inbox], ["Tasks", "/tasks", Icons.ListTodo], ["Calendar", "/calendar", Icons.CalendarDays]] },
    { label: "Workspace", items: [["Projects", "/projects", Icons.BriefcaseBusiness], ["Clients", "/clients", Icons.Users], ["Files", "/files", Icons.Paperclip]] },
  ] },
  { label: "Plan", href: "/plan", icon: Icons.Target, matches: ["/plan", "/focus", "/followups", "/waiting", "/goals", "/review", "/approvals"], groups: [
    { label: "Planning", items: [["Plan", "/plan", Icons.Target], ["Focus", "/focus", Icons.Focus], ["Goals", "/goals", Icons.Target], ["Approvals", "/approvals", Icons.Check]] },
    { label: "Follow through", items: [["Follow-ups", "/followups", Icons.MessageSquareText], ["Waiting", "/waiting", Icons.Clock3], ["Reviews", "/review/weekly", Icons.Check]] },
  ] },
  { label: "Business", href: "/business", icon: Icons.CircleDollarSign, matches: ["/business", "/finance", "/financial-control", "/growth", "/pipeline", "/leads", "/proposals", "/services", "/success", "/commerce", "/founder", "/campaigns"], groups: [
    { label: "Revenue", items: [["Business overview", "/business", Icons.ChartNoAxesCombined], ["Growth", "/growth", Icons.TrendingUp], ["Pipeline", "/pipeline", Icons.BriefcaseBusiness], ["Leads", "/leads", Icons.Users], ["Clients", "/clients", Icons.Users]] },
    { label: "Finance & commerce", items: [["Finance", "/finance", Icons.CircleDollarSign], ["Financial control", "/financial-control", Icons.ReceiptText], ["Commerce", "/commerce", Icons.Package], ["Success", "/success", Icons.HeartHandshake], ["Founder", "/founder", Icons.Sparkles]] },
  ] },
  { label: "Operate", href: "/operations", icon: Icons.ListTodo, matches: ["/operations", "/team", "/control-tower", "/analytics", "/communication", "/risks", "/automations", "/meeting"], groups: [
    { label: "Operations", items: [["Operations", "/operations", Icons.ListTodo], ["Control tower", "/control-tower", Icons.Target], ["Automations", "/automations", Icons.Zap], ["Analytics", "/analytics", Icons.ChartNoAxesCombined]] },
    { label: "People & process", items: [["Team", "/team", Icons.Users], ["Communication", "/communication", Icons.MessageSquareText], ["Risks", "/risks", Icons.Bell], ["Documents", "/documents", Icons.FileText]] },
  ] },
  { label: "Intelligence", href: "/chief-of-staff", icon: Icons.Sparkles, matches: ["/chief-of-staff", "/executive", "/knowledge", "/learning", "/memory", "/strategy", "/portfolio"], groups: [
    { label: "Command", items: [["Chief of staff", "/chief-of-staff", Icons.ShieldCheck], ["Executive", "/executive", Icons.Sparkles], ["Knowledge", "/knowledge", Icons.BookOpen], ["Watchlist", "/knowledge/watch", Icons.Bell], ["Review", "/knowledge/review", Icons.Check], ["Learning", "/learning", Icons.Lightbulb]] },
    { label: "Strategy", items: [["Control tower", "/control-tower", Icons.Target], ["Portfolio", "/portfolio", Icons.BriefcaseBusiness], ["Memory", "/memory", Icons.BookOpen], ["Content", "/content", Icons.FileText]] },
  ] },
  { label: "Personal", href: "/life", icon: Icons.BookOpen, matches: ["/life", "/fitness", "/travel", "/notes", "/ideas", "/decisions", "/prompts", "/settings"], groups: [
    { label: "Personal", items: [["Life", "/life", Icons.BookOpen], ["Fitness", "/fitness", Icons.Dumbbell], ["Travel", "/travel", Icons.CalendarDays], ["Notes", "/notes", Icons.FileText]] },
    { label: "Workspace", items: [["Ideas", "/ideas", Icons.Lightbulb], ["Decisions", "/decisions", Icons.MessageSquareText], ["Prompts", "/prompts", Icons.Command], ["Settings", "/settings", Icons.Settings]] },
  ] },
] as const satisfies readonly Area[];

const workspaceAreas: readonly Area[] = areas;
const allItems: NavItem[] = workspaceAreas.flatMap((area) => area.groups.flatMap((group) => [...group.items]));
const routeLabels = Object.fromEntries(allItems.map(([label, href]) => [href, label]));

type ShellUser = { name: string; email: string; initials: string };

function Shell({ children,user }: { children: ReactNode;user:ShellUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const theme = useTheme();
  const dark = theme === "dark";
  const currentArea = workspaceAreas.find((area) => area.matches.some((href) => pathname === href || pathname.startsWith(`${href}/`))) ?? workspaceAreas[0];
  const currentRoute = Object.keys(routeLabels).sort((a, b) => b.length - a.length).find((href) => pathname === href || pathname.startsWith(`${href}/`));
  const pageTitle = currentRoute ? routeLabels[currentRoute] : "Daily Command";

  const toggleTheme = useCallback(() => {
    setTheme(dark ? "light" : "dark");
  }, [dark]);

  const goToLogin = useCallback(() => {
    setAccountOpen(false);
    setMobileMenu(false);
    router.replace("/login");
    router.refresh();
  }, [router]);

  const signOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOutCurrentSession(createClient());
      goToLogin();
    } catch {
      showToast("Sign out could not be completed. Try again.", "error");
      setSigningOut(false);
    }
  }, [goToLogin, showToast, signingOut]);

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

  useEffect(() => {
    if (!accountOpen) return;
    function dismiss(event: PointerEvent) {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setAccountOpen(false);
      accountButtonRef.current?.focus();
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [accountOpen]);

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") goToLogin();
    });
    return () => subscription.unsubscribe();
  }, [goToLogin]);

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="global-rail" aria-label="Global navigation">
        <Link href="/today" className="rail-brand" aria-label="Daily Command home" title="Daily Command"><Icons.Target size={19} strokeWidth={2.25}/></Link>
        <nav className="global-rail__nav">
          {workspaceAreas.map(({ label, href, icon: Icon, matches }) => <Link className={matches.some((match) => pathname === match || pathname.startsWith(`${match}/`)) ? "rail-link rail-link--active" : "rail-link"} href={href} key={label} title={label}><Icon size={18} strokeWidth={1.8}/><span>{label}</span></Link>)}
        </nav>
        <div className="global-rail__footer"><Link className={pathname.startsWith("/settings") ? "rail-link rail-link--active" : "rail-link"} href="/settings" title="Settings"><Icons.Settings size={18}/><span>Settings</span></Link></div>
      </aside>
      <aside className={`sidebar contextual-sidebar ${mobileMenu ? "sidebar--open" : ""}`} aria-label={`${currentArea.label} navigation`}>
        <div className="contextual-sidebar__heading"><span className="brand__mark"><Icons.Target size={15} strokeWidth={2.2}/></span><span><strong>{currentArea.label}</strong><small>Daily Command</small></span><button className="icon-button contextual-sidebar__close" aria-label="Close navigation" type="button" onClick={() => setMobileMenu(false)}><Icons.X size={17}/></button></div>
        <nav className="mobile-area-switcher" aria-label="Workspace areas">
          {workspaceAreas.map(({ label, href, icon: Icon, matches }) => { const active = matches.some((match) => pathname === match || pathname.startsWith(`${match}/`)); return <Link href={href} key={label} className={active ? "mobile-area-switcher__link is-active" : "mobile-area-switcher__link"} aria-current={active ? "page" : undefined} onClick={() => setMobileMenu(false)}><Icon size={16}/><span>{label}</span></Link>; })}
        </nav>
        <button className="sidebar-create" type="button" onClick={() => setCaptureOpen(true)}><Icons.Plus size={16}/><span>New capture</span><kbd>C</kbd></button>
        <nav className="sidebar__nav">
          <div className="contextual-sidebar__quick"><button type="button" onClick={() => setPaletteOpen(true)}><Icons.Search size={15}/><span>Search</span><kbd>⌘K</kbd></button></div>
          {currentArea.groups.map((group) => {
            const activeGroup = group.items.some(([, href]) => pathname === href || pathname.startsWith(`${href}/`));
            return <details className="nav-group" key={group.label} open={activeGroup}>
              <summary><span>{group.label}</span><Icons.ChevronDown size={13}/></summary>
              <div>{group.items.map(([label, href, Icon]) => <Link className={pathname === href || pathname.startsWith(`${href}/`) ? "nav-link nav-link--active" : "nav-link"} href={href} key={href} onClick={() => setMobileMenu(false)}><Icon size={16} strokeWidth={1.7} /><span>{label}</span>{label === "Inbox" ? <InboxBadge/> : null}</Link>)}</div>
            </details>;
          })}
        </nav>
        <div className="sidebar__footer">
          <button className="nav-link" onClick={toggleTheme}>{dark ? <Icons.Sun size={16}/> : <Icons.Moon size={16}/>}<span>{dark ? "Light mode" : "Dark mode"}</span></button>
        </div>
      </aside>
      {mobileMenu ? <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileMenu(false)} /> : null}
      <div className="workspace">
        <header className="desktop-topbar">
          <div className="topbar-context"><span>Daily Command</span><Icons.ChevronRight size={13}/><strong>{pageTitle}</strong></div>
          <button className="topbar-search" type="button" onClick={() => setPaletteOpen(true)}><Icons.Search size={16}/><span>Search tasks, projects, clients…</span><kbd>⌘K</kbd></button>
          <div className="topbar-actions">
            <button className="icon-button topbar-capture" type="button" onClick={() => setCaptureOpen(true)} aria-label="Quick capture"><Icons.Plus size={18}/></button>
            <NotificationCenter />
            <div className="account-control" ref={accountRef}>
            {accountOpen ? <div className="account-menu" id="account-menu" aria-label="Account">
              <div className="account-menu__identity" role="presentation"><span className="avatar">{user.initials}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div>
              <div className="account-menu__actions">
                <Link href="/settings" onClick={() => { setAccountOpen(false); setMobileMenu(false); }}><Icons.Settings size={16}/><span>Settings</span></Link>
                <button type="button" onClick={toggleTheme}>{dark ? <Icons.Sun size={16}/> : <Icons.Moon size={16}/>}<span>{dark ? "Light mode" : "Dark mode"}</span></button>
                <button className="account-menu__signout" type="button" disabled={signingOut} onClick={() => void signOut()}><Icons.LogOut size={16}/><span>{signingOut ? "Signing out…" : "Sign out"}</span></button>
              </div>
            </div> : null}
            <button ref={accountButtonRef} className="profile-button" type="button" onClick={() => setAccountOpen((open) => !open)} aria-expanded={accountOpen} aria-controls="account-menu"><span className="avatar">{user.initials}</span><span><strong>{user.name}</strong><small>Workspace owner</small></span><Icons.ChevronDown className={accountOpen ? "profile-button__chevron profile-button__chevron--open" : "profile-button__chevron"} size={15}/></button>
          </div>
          </div>
        </header>
        <header className="mobile-header"><button className="icon-button" onClick={() => setMobileMenu(true)} aria-label="Open navigation" aria-expanded={mobileMenu}><Icons.Menu size={20} /></button><span className="mobile-brand"><strong>{currentArea.label}</strong><small>{pageTitle}</small></span><span className="mobile-header__actions"><NotificationCenter mobile/><button className="icon-button" onClick={() => setPaletteOpen(true)} aria-label="Search"><Icons.Search size={19} /></button></span></header>
        <main id="main-content" className="workspace__content">{children}</main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <Link className={pathname === "/today" ? "active" : ""} href="/today"><Icons.Zap size={19} /><span>Today</span></Link>
        <Link className={pathname === "/tasks" ? "active" : ""} href="/tasks"><Icons.ListTodo size={19} /><span>Tasks</span></Link>
        <button className="capture-button" onClick={() => setCaptureOpen(true)} aria-label="Quick capture"><Icons.Plus size={23} /></button>
        <Link className={pathname === "/calendar" ? "active" : ""} href="/calendar"><Icons.CalendarDays size={19} /><span>Calendar</span></Link>
        <button className={mobileMenu ? "active" : ""} onClick={() => setMobileMenu(true)} aria-expanded={mobileMenu}><Icons.MoreHorizontal size={19} /><span>More</span></button>
      </nav>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <QuickCapture open={captureOpen} onClose={() => setCaptureOpen(false)} />
    </div>
  );
}

export function AppShell({ children,user }: { children: ReactNode;user:ShellUser }) {
  return <ToastProvider><Shell user={user}>{children}</Shell></ToastProvider>;
}
