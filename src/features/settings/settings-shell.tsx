"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { UserRound, Building2, Bell, Link2, ShieldCheck, Palette, SlidersHorizontal, ChevronRight, Sparkles, ArrowRight } from "lucide-react";
import "./settings.css";
export type SettingsProfile = { name: string; email: string; timezone: string; weekStartsOn: number; providers: string[]; lastSignIn: string | null };
const ProfileContext = createContext<SettingsProfile | null>(null);
export function useSettingsProfile() { const profile = useContext(ProfileContext); if (!profile) throw new Error("Settings profile is unavailable"); return profile; }
const sections = [
  { href: "/settings", title: "Profile", detail: "Personal info & account", icon: UserRound },
  { href: "/settings/workspace", title: "Workspace", detail: "Business settings", icon: Building2 },
  { href: "/settings/notifications", title: "Notifications", detail: "Your attention & signals", icon: Bell },
  { href: "/settings/integrations", title: "Integrations", detail: "Connect your tools", icon: Link2 },
  { href: "/settings/security", title: "Security", detail: "Password & access", icon: ShieldCheck },
  { href: "/settings/appearance", title: "Appearance", detail: "Theme & display", icon: Palette },
  { href: "/settings/preferences", title: "Preferences", detail: "Your productivity defaults", icon: SlidersHorizontal },
];
export function SettingsShell({ profile, children }: { profile: SettingsProfile; children: ReactNode }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => { const nav = navRef.current; const active = nav?.querySelector<HTMLElement>('[aria-current="page"]'); if (nav && active && nav.scrollWidth > nav.clientWidth) nav.scrollTo({left: active.offsetLeft - nav.offsetLeft - 8, behavior: "instant"}); }, [pathname]);
  return <ProfileContext.Provider value={profile}><div className="personal-settings"><header className="personal-settings__header"><div><p className="personal-settings__eyebrow">WORKSPACE / SETTINGS</p><h1>Settings</h1><p>Tune the command center to the way you work. Manage your account, workspace, integrations and more.</p></div><Link className="settings-personalize" href="/settings/appearance"><span className="settings-icon"><Sparkles size={25}/></span><span><strong>Make it yours</strong><small>Customize your workspace to get<br/>the most out of Daily Command.</small></span><ArrowRight size={21}/></Link></header><div className="personal-settings__layout"><nav ref={navRef} className="settings-nav" aria-label="Settings sections">{sections.map(({href,title,detail,icon:Icon})=>{const active=pathname===href || (href==="/settings/workspace" && pathname==="/settings/business");return <Link key={href} href={href} aria-current={active?"page":undefined} className={active?"active":""}><Icon size={25}/><span><strong>{title}</strong><small>{detail}</small></span><ChevronRight size={17}/></Link>})}</nav><section className="settings-content" aria-label="Settings content">{children}</section></div></div></ProfileContext.Provider>;
}
