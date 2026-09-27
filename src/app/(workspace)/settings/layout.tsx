import { requireUser } from "@/lib/supabase/server";
import { SettingsShell } from "@/features/settings/settings-shell";
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { supabase, userId } = await requireUser();
  const [{ data: profile, error }, { data: auth, error: authError }] = await Promise.all([
    supabase.from("profiles").select("display_name,timezone,week_starts_on").eq("id", userId).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if (error || authError) throw error || authError;
  return <SettingsShell profile={{ name: profile?.display_name || auth.user?.email?.split("@")[0] || "Your profile", email: auth.user?.email || "", timezone: profile?.timezone || "Africa/Casablanca", weekStartsOn: profile?.week_starts_on ?? 1, providers: auth.user?.app_metadata?.providers || [], lastSignIn: auth.user?.last_sign_in_at || null }}>{children}</SettingsShell>;
}
