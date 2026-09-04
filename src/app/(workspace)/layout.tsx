import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/supabase/server";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const {supabase,userId}=await requireUser();
  const profile=await supabase.from("profiles").select("display_name").eq("id",userId).maybeSingle();
  const claims=await supabase.auth.getClaims();
  const email=typeof claims.data?.claims?.email==="string"?claims.data.claims.email:"";
  const name=String(profile.data?.display_name?.trim()||email.split("@")[0]||"Workspace owner");
  const initials=name.split(/\s+/).slice(0,2).map((part)=>part[0]?.toUpperCase()).join("")||"DC";
  return <AppShell user={{name,initials}}>{children}</AppShell>;
}
