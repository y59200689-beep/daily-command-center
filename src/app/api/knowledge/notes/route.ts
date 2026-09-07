import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const targets = {
  topic: { table: "research_topics", entityType: "research_topic" },
  source: { table: "knowledge_sources", entityType: "knowledge_source" },
  finding: { table: "research_findings", entityType: "research_finding" },
  question: { table: "research_questions", entityType: "research_question" },
} as const;
const targetType = z.enum(["topic", "source", "finding", "question"]);
const linkInput = z.object({ target_type: targetType, target_id: z.uuid(), note_id: z.uuid() });
const createInput = z.object({ target_type: targetType, target_id: z.uuid(), title: z.string().trim().min(1).max(240), content: z.string().max(20_000).default("") });

async function verifyTarget(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, type: z.infer<typeof targetType>, id: string) {
  const target = await supabase.from(targets[type].table).select("id").eq("id", id).eq("user_id", userId).maybeSingle();
  if (target.error) throw target.error;
  if (!target.data) throw new Error("Choose a knowledge record from your own workspace.");
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { supabase, userId } = await requireUser();
    if (url.searchParams.get("available") === "true") {
      const notes = await supabase.from("notes").select("id,title,content,updated_at").eq("user_id", userId).is("deleted_at", null).order("updated_at", { ascending: false }).limit(100);
      if (notes.error) throw notes.error;
      return NextResponse.json({ items: notes.data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const type = targetType.parse(url.searchParams.get("target_type"));
    const id = z.uuid().parse(url.searchParams.get("target_id"));
    await verifyTarget(supabase, userId, type, id);
    const links = await supabase.from("note_links").select("id,note_id,created_at").eq("user_id", userId).eq("entity_type", targets[type].entityType).eq("entity_id", id);
    if (links.error) throw links.error;
    const noteIds = (links.data ?? []).map((link) => link.note_id);
    const notes = noteIds.length ? await supabase.from("notes").select("id,title,content,updated_at").eq("user_id", userId).in("id", noteIds).is("deleted_at", null).order("updated_at", { ascending: false }) : { data: [], error: null };
    if (notes.error) throw notes.error;
    return NextResponse.json({ items: (notes.data ?? []).map((note) => ({ ...note, link_id: (links.data ?? []).find((link) => link.note_id === note.id)?.id })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error, "Linked notes could not be loaded."); }
}

export async function POST(request: Request) {
  try {
    const input = linkInput.parse(await request.json());
    const { supabase, userId } = await requireUser();
    await verifyTarget(supabase, userId, input.target_type, input.target_id);
    const note = await supabase.from("notes").select("id").eq("id", input.note_id).eq("user_id", userId).is("deleted_at", null).maybeSingle();
    if (note.error) throw note.error;
    if (!note.data) return NextResponse.json({ error: "Choose a note from your own workspace." }, { status: 404 });
    const saved = await supabase.from("note_links").insert({ user_id: userId, note_id: input.note_id, entity_type: targets[input.target_type].entityType, entity_id: input.target_id }).select("*").single();
    if (saved.error) throw saved.error;
    return NextResponse.json({ item: saved.data }, { status: 201 });
  } catch (error) { return apiError(error, "Note could not be linked."); }
}

export async function PUT(request: Request) {
  try {
    const input = createInput.parse(await request.json());
    const { supabase, userId } = await requireUser();
    await verifyTarget(supabase, userId, input.target_type, input.target_id);
    const note = await supabase.from("notes").insert({ user_id: userId, title: input.title, content: input.content, category: "note", created_by: "user" }).select("*").single();
    if (note.error) throw note.error;
    const link = await supabase.from("note_links").insert({ user_id: userId, note_id: note.data.id, entity_type: targets[input.target_type].entityType, entity_id: input.target_id }).select("*").single();
    if (link.error) throw link.error;
    return NextResponse.json({ item: { ...note.data, link_id: link.data.id } }, { status: 201 });
  } catch (error) { return apiError(error, "Linked note could not be created."); }
}

export async function DELETE(request: Request) {
  try {
    const input = z.object({ link_id: z.uuid() }).parse(await request.json());
    const { supabase, userId } = await requireUser();
    const removed = await supabase.from("note_links").delete().eq("id", input.link_id).eq("user_id", userId).select("id").maybeSingle();
    if (removed.error) throw removed.error;
    if (!removed.data) return NextResponse.json({ error: "Note link is unavailable." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error, "Note could not be unlinked."); }
}
