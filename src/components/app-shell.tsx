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
  { label: "Home", href: "/today", icon: Icons.Zap, matches: ["/today", "/inbox", "/tasks", "/calendar", "/projects", "/clients", "/files"], groups: [
    { label: "Daily work", items: [["Today", "/today", Icons.Zap], ["Inbox", "/inbox", Icons.Inbox], ["Tasks", "/tasks", Icons.ListTodo], ["Calendar", "/calendar", Icons.CalendarDays]] },
    { label: "Workspace", items: [["Projects", "/projects", Icons.BriefcaseBusiness], ["Clients", "/clients", Icons.Users], ["Files", "/files", Icons.Paperclip]] },
  ] },
  { label: "Plan", href: "/planning", icon: Icons.Target, matches: ["/planning", "/plan", "/focus", "/followups", "/waiting", "/goals", "/review", "/approvals"], groups: [
    { label: "Priorities", items: [["Planning", "/planning", Icons.Target], ["Focus", "/focus", Icons.Focus], ["Goals", "/goals", Icons.Target]] },
    { label: "Follow through", items: [["Follow-ups", "/followups", Icons.MessageSquareText], ["Waiting", "/waiting", Icons.Clock3], ["Reviews", "/review/weekly", Icons.Check]] },
  ] },
  { label: "Business", href: "/business", icon: Icons.CircleDollarSign, matches: ["/business", "/finance", "/financial-control", "/growth", "/pipeline", "/leads", "/proposals", "/services", "/success", "/commerce", "/founder", "/campaigns"], groups: [
    { label: "Revenue", items: [["Business", "/business", Icons.ChartNoAxesCombined], ["Pipeline", "/pipeline", Icons.BriefcaseBusiness], ["Leads", "/leads", Icons.Users], ["Growth", "/growth", Icons.TrendingUp]] },
    { label: "Money", items: [["Finance", "/finance", Icons.CircleDollarSign], ["Commerce", "/commerce", Icons.Package], ["Success", "/success", Icons.HeartHandshake]] },
  ] },
  { label: "Operate", href: "/operations", icon: Icons.ListTodo, matches: ["/operations", "/team", "/control-tower", "/analytics", "/communication", "/risks", "/automations", "/meeting", "/documents"], groups: [
    { label: "Operations", items: [["Operations", "/operations", Icons.ListTodo], ["Team", "/team", Icons.Users], ["Risks", "/risks", Icons.Bell], ["Documents", "/documents", Icons.FileText]] },
    { label: "Systems", items: [["Control tower", "/control-tower", Icons.Target], ["Automations", "/automations", Icons.Zap]] },
  ] },
  { label: "Intelligence", href: "/executive", icon: Icons.Sparkles, matches: ["/state", "/changes", "/issues", "/dependencies", "/business-pulse", "/infrastructure", "/relationships", "/commitments", "/experiments", "/chief-of-staff", "/executive", "/knowledge", "/learning", "/memory", "/strategy", "/portfolio"], groups: [
    { label: "Insight", items: [["Executive", "/executive", Icons.Sparkles], ["What changed", "/changes", Icons.ChartNoAxesCombined], ["Decisions", "/decisions", Icons.MessageSquareText], ["Knowledge", "/knowledge", Icons.BookOpen], ["Watchlist", "/knowledge/watch", Icons.Bell], ["Review", "/knowledge/review", Icons.Check], ["Learning", "/learning", Icons.Lightbulb]] },
    { label: "Context", items: [["Founder state", "/state", Icons.Zap], ["Saved context", "/memory", Icons.BookOpen], ["Portfolio", "/portfolio", Icons.BriefcaseBusiness]] },
  ] },
  { label: "Personal", href: "/life", icon: Icons.BookOpen, matches: ["/life", "/fitness", "/travel", "/notes", "/ideas", "/prompts", "/settings"], groups: [
    { label: "Personal", items: [["Life", "/life", Icons.BookOpen], ["Fitness", "/fitness", Icons.Dumbbell], ["Travel", "/travel", Icons.CalendarDays], ["Notes", "/notes", Icons.FileText]] },
    { label: "Tools", items: [["Ideas", "/ideas", Icons.Lightbulb], ["Prompts", "/prompts", Icons.Command], ["Settings", "/settings", Icons.Settings]] },
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const theme = useTheme();
  const dark = theme === "dark";
  const currentArea = workspaceAreas.find((area) => area.matches.some((href) => pathname === href || pathname.startsWith(`${href}/`))) ?? workspaceAreas[0];
  const panelArea = mobileMenu ? currentArea : workspaceAreas.find((area) => area.label === selectedArea) ?? currentArea;
  const currentRoute = Object.keys(routeLabels).sort((a, b) => b.length - a.length).find((href) => pathname === href || pathname.startsWith(`${href}/`));
  const pageTitle = currentRoute ? routeLabels[currentRoute] : "Daily Command";

  const toggleSidebar = useCallback(() => {
    setSelectedArea(currentArea.label);
    setSidebarCollapsed((prev) => !prev);
  }, [currentArea.label]);

  const collapseSidebar = useCallback(() => {
    setSidebarCollapsed(true);
  }, []);

  useEffect(() => {
    if (sidebarCollapsed) return;
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") collapseSidebar();
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [sidebarCollapsed, collapseSidebar]);

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
      if ((event.metaKey || event.ctrlKey) && (event.key === "\\" || event.key.toLowerCase() === "b")) {
        event.preventDefault();
        toggleSidebar();
        return;
      }
      if (!typing && event.key === "[") {
        event.preventDefault();
        toggleSidebar();
        return;
      }
      if (!typing && event.key.toLowerCase() === "c") { event.preventDefault(); setCaptureOpen(true); }
      if (!typing && event.key.toLowerCase() === "f") { router.push("/focus"); }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [router, toggleSidebar]);

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
    <div className={`app-frame ${sidebarCollapsed ? "app-frame--sidebar-collapsed" : ""}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="global-rail" aria-label="Global navigation">
        <Link href="/today" className="rail-brand" aria-label="Daily Command home" title="Daily Command"><Icons.Target size={19} strokeWidth={2.25}/></Link>
        <nav className="global-rail__nav">
          {workspaceAreas.map(({ label, icon: Icon }) => {
            const active = !sidebarCollapsed ? panelArea.label === label : currentArea.label === label;
            return (
              <button
                type="button"
                className={active ? "rail-link rail-link--active" : "rail-link"}
                key={label}
                title={label}
                aria-label={`Open ${label} navigation`}
                aria-expanded={!sidebarCollapsed && panelArea.label === label}
                onClick={() => {
                  if (!sidebarCollapsed && panelArea.label === label) collapseSidebar();
                  else { setSelectedArea(label); setSidebarCollapsed(false); }
                }}
              >
                <Icon size={18} strokeWidth={1.8}/>
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
        <div className="global-rail__footer"><button className="rail-account" type="button" aria-label="Open account menu" onClick={() => setAccountOpen((open) => !open)}>{user.initials}</button></div>
      </aside>
      <aside className={`sidebar contextual-sidebar ${mobileMenu ? "sidebar--open" : ""}`} aria-label={`${panelArea.label} navigation`} hidden={sidebarCollapsed && !mobileMenu} inert={sidebarCollapsed && !mobileMenu}>
        <div className="contextual-sidebar__heading">
          <span className="brand__mark"><Icons.Target size={15} strokeWidth={2.2}/></span>
          <span><strong>{panelArea.label}</strong><small>Daily Command</small></span>
          <button
            className="icon-button contextual-sidebar__collapse"
            type="button"
            onClick={collapseSidebar}
            aria-label="Hide sidebar (⌘\)"
            title="Hide sidebar (⌘\)"
          >
            <Icons.PanelLeftClose size={16}/>
          </button>
          <button className="icon-button contextual-sidebar__close" aria-label="Close navigation" type="button" onClick={() => setMobileMenu(false)}><Icons.X size={17}/></button>
        </div>
        <nav className="mobile-area-switcher" aria-label="Workspace areas">
          {workspaceAreas.map(({ label, href, icon: Icon, matches }) => { const active = matches.some((match) => pathname === match || pathname.startsWith(`${match}/`)); return <Link href={href} key={label} className={active ? "mobile-area-switcher__link is-active" : "mobile-area-switcher__link"} aria-current={active ? "page" : undefined} onClick={() => setMobileMenu(false)}><Icon size={16}/><span>{label}</span></Link>; })}
        </nav>
        <nav className="sidebar__nav">
          <button className="sidebar-create" type="button" onClick={() => setCaptureOpen(true)}><span className="sidebar-create__icon"><Icons.Plus size={20}/></span><span>New capture</span><kbd>C</kbd></button>
          <div className="contextual-sidebar__quick"><button type="button" onClick={() => setPaletteOpen(true)}><Icons.Search size={15}/><span>Search</span><kbd>⌘K</kbd></button></div>
          {panelArea.groups.map((group) => {
            const groupKey = `${panelArea.label}-${group.label}`;
            return <details className="nav-group" key={groupKey} open={openGroups[groupKey] ?? true}>
              <summary onClick={(event) => { event.preventDefault(); setOpenGroups((previous) => ({ ...previous, [groupKey]: !(previous[groupKey] ?? true) })); }}><span>{group.label}</span><Icons.ChevronDown size={13}/></summary>
              <div>{group.items.map(([label, href, Icon]) => <Link className={currentRoute === href ? "nav-link nav-link--active" : "nav-link"} href={href} key={href} aria-current={currentRoute === href ? "page" : undefined} onClick={() => { setMobileMenu(false); collapseSidebar(); }}><span className="nav-link__icon"><Icon size={16} strokeWidth={1.7} /></span><span>{label}</span>{label === "Inbox" ? <InboxBadge/> : null}</Link>)}</div>
            </details>;
          })}
        </nav>
        <div className="sidebar__footer">
          <button className="nav-link" onClick={toggleTheme}>{dark ? <Icons.Sun size={16}/> : <Icons.Moon size={16}/>}<span>{dark ? "Light mode" : "Dark mode"}</span></button>
          <div className="sidebar-profile"><span className="sidebar-profile__avatar">{user.initials}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div>
        </div>
      </aside>
      {!sidebarCollapsed ? <button className="desktop-sidebar-scrim" type="button" aria-label="Close navigation" onClick={collapseSidebar} /> : null}
      {mobileMenu ? <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileMenu(false)} /> : null}
      <div className="workspace">
        <header className="desktop-topbar">
          <div className="topbar-left">
            <button
              className="icon-button topbar-sidebar-toggle"
              type="button"
              onClick={toggleSidebar}
              title={sidebarCollapsed ? "Show sidebar (⌘\\)" : "Hide sidebar (⌘\\)"}
              aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
              aria-expanded={!sidebarCollapsed}
            >
              {sidebarCollapsed ? <Icons.PanelLeftOpen size={16} /> : <Icons.PanelLeftClose size={16} />}
            </button>
            <div className="topbar-context"><span>Daily Command</span><Icons.ChevronRight size={13}/><strong>{pageTitle}</strong></div>
          </div>
          <button className="topbar-search" type="button" onClick={() => setPaletteOpen(true)}><Icons.Search size={16}/><span>Search tasks, projects, clients…</span><kbd>⌘K</kbd></button>
          <div className="topbar-actions">
            <button className="icon-button topbar-capture" type="button" onClick={() => setCaptureOpen(true)} aria-label="Quick capture"><Icons.Plus size={18}/></button>
            <NotificationCenter />
            <button className="icon-button topbar-theme" type="button" onClick={toggleTheme} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"} aria-pressed={dark}>{dark ? <Icons.Sun size={17}/> : <Icons.Moon size={17}/>}</button>
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
