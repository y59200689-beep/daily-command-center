import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { validateForeignOwnership } from "@/lib/team";

const linkSchema = z.object({
  entity_type: z.string().min(1).max(100),
  entity_id: z.string().uuid(),
  person_id: z.string().uuid(),
  ownership_role: z.enum(["owner", "backup", "contributor", "reviewer", "consulted"]).default("owner"),
});

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();

    const [
      peopleRes,
      responsibilitiesRes,
      ownershipLinksRes,
      projectsRes,
      clientsRes,
      sopsRes,
      processesRes,
      oppsRes,
    ] = await Promise.all([
      supabase.from("team_people").select("id, name, role_title, status").eq("user_id", userId).neq("status", "archived"),
      supabase.from("team_responsibilities").select("id, name, criticality, status, primary_owner_id, backup_owner_id").eq("user_id", userId).neq("status", "archived"),
      supabase.from("team_entity_ownership").select("*, person:team_people(id, name, role_title)").eq("user_id", userId),
      supabase.from("projects").select("id, name, status").eq("user_id", userId).is("deleted_at", null).limit(30),
      supabase.from("clients").select("id, name, status").eq("user_id", userId).is("deleted_at", null).limit(30),
      supabase.from("operational_sops").select("id, title, criticality, owner_label, status").eq("user_id", userId).limit(30),
      supabase.from("process_templates").select("id, name, category, status").eq("user_id", userId).limit(30),
      supabase.from("opportunities").select("id, title, stage").eq("user_id", userId).is("archived_at", null).limit(30),
    ]);

    const people = peopleRes.data ?? [];
    const peopleMap = new Map(people.map((p) => [p.id, p]));
    const links = ownershipLinksRes.data ?? [];

    const items: Array<{
      id: string;
      entity_type: string;
      entity_id: string;
      entity_title: string;
      primary_owner?: { id: string; name: string } | null;
      backup_owner?: { id: string; name: string } | null;
      contributors?: Array<{ id: string; name: string }>;
      status: string;
      criticality?: string;
    }> = [];

    // Responsibilities
    for (const r of responsibilitiesRes.data ?? []) {
      const primary = r.primary_owner_id ? peopleMap.get(r.primary_owner_id) : null;
      const backup = r.backup_owner_id ? peopleMap.get(r.backup_owner_id) : null;
      items.push({
        id: `resp:${r.id}`,
        entity_type: "responsibility",
        entity_id: r.id,
        entity_title: r.name,
        primary_owner: primary ? { id: primary.id, name: primary.name } : null,
        backup_owner: backup ? { id: backup.id, name: backup.name } : null,
        status: r.status,
        criticality: r.criticality,
      });
    }

    // Projects
    for (const p of projectsRes.data ?? []) {
      const pLinks = links.filter((l) => l.entity_type === "project" && l.entity_id === p.id);
      const primaryLink = pLinks.find((l) => l.ownership_role === "owner");
      const backupLink = pLinks.find((l) => l.ownership_role === "backup");
      items.push({
        id: `proj:${p.id}`,
        entity_type: "project",
        entity_id: p.id,
        entity_title: p.name,
        primary_owner: primaryLink?.person ? { id: primaryLink.person.id, name: primaryLink.person.name } : null,
        backup_owner: backupLink?.person ? { id: backupLink.person.id, name: backupLink.person.name } : null,
        contributors: pLinks.filter((l) => l.ownership_role === "contributor").map((l) => ({ id: l.person.id, name: l.person.name })),
        status: p.status,
      });
    }

    // Clients
    for (const c of clientsRes.data ?? []) {
      const cLinks = links.filter((l) => l.entity_type === "client" && l.entity_id === c.id);
      const primaryLink = cLinks.find((l) => l.ownership_role === "owner");
      const backupLink = cLinks.find((l) => l.ownership_role === "backup");
      items.push({
        id: `client:${c.id}`,
        entity_type: "client",
        entity_id: c.id,
        entity_title: c.name,
        primary_owner: primaryLink?.person ? { id: primaryLink.person.id, name: primaryLink.person.name } : null,
        backup_owner: backupLink?.person ? { id: backupLink.person.id, name: backupLink.person.name } : null,
        status: c.status,
      });
    }

    // SOPs
    for (const s of sopsRes.data ?? []) {
      const sLinks = links.filter((l) => l.entity_type === "sop" && l.entity_id === s.id);
      const primaryLink = sLinks.find((l) => l.ownership_role === "owner");
      items.push({
        id: `sop:${s.id}`,
        entity_type: "sop",
        entity_id: s.id,
        entity_title: s.title,
        primary_owner: primaryLink?.person ? { id: primaryLink.person.id, name: primaryLink.person.name } : (s.owner_label ? { id: "", name: s.owner_label } : null),
        status: s.status,
        criticality: s.criticality,
      });
    }

    // Process Templates
    for (const pr of processesRes.data ?? []) {
      const prLinks = links.filter((l) => l.entity_type === "process" && l.entity_id === pr.id);
      const primaryLink = prLinks.find((l) => l.ownership_role === "owner");
      items.push({
        id: `proc:${pr.id}`,
        entity_type: "process",
        entity_id: pr.id,
        entity_title: pr.name,
        primary_owner: primaryLink?.person ? { id: primaryLink.person.id, name: primaryLink.person.name } : null,
        status: pr.status,
      });
    }

    // Opportunities
    for (const o of oppsRes.data ?? []) {
      const oLinks = links.filter((l) => l.entity_type === "opportunity" && l.entity_id === o.id);
      const primaryLink = oLinks.find((l) => l.ownership_role === "owner");
      items.push({
        id: `opp:${o.id}`,
        entity_type: "opportunity",
        entity_id: o.id,
        entity_title: o.title,
        primary_owner: primaryLink?.person ? { id: primaryLink.person.id, name: primaryLink.person.name } : null,
        status: o.stage,
      });
    }

    return NextResponse.json({
      items,
      totalTracked: items.length,
      unownedCount: items.filter((i) => !i.primary_owner).length,
    });
  } catch (error) {
    return apiError(error, "Ownership map could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json();
    const parsed = linkSchema.parse(body);

    const isValid = await validateForeignOwnership(supabase, userId, parsed.entity_type, parsed.entity_id);
    if (!isValid) {
      return NextResponse.json({ error: "Target entity does not exist or does not belong to you." }, { status: 400 });
    }

    const { data: person } = await supabase.from("team_people").select("id").eq("id", parsed.person_id).eq("user_id", userId).maybeSingle();
    if (!person) {
      return NextResponse.json({ error: "Person does not belong to you." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("team_entity_ownership")
      .upsert({
        user_id: userId,
        entity_type: parsed.entity_type,
        entity_id: parsed.entity_id,
        person_id: parsed.person_id,
        ownership_role: parsed.ownership_role,
      }, { onConflict: "user_id,entity_type,entity_id,person_id,ownership_role" })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Ownership link could not be created.");
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const url = new URL(request.url);
    const linkId = url.searchParams.get("id");

    if (!linkId) return NextResponse.json({ error: "Link ID required." }, { status: 400 });

    const { error } = await supabase
      .from("team_entity_ownership")
      .delete()
      .eq("id", linkId)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Ownership link could not be removed.");
  }
}
