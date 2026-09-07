import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const findingInput = z.object({ finding_id: z.uuid() });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const questionId = z.uuid().parse((await params).id);
    const { supabase, userId } = await requireUser();
    const question = await supabase.from("research_questions").select("id").eq("id", questionId).eq("user_id", userId).maybeSingle();
    if (question.error) throw question.error;
    if (!question.data) return NextResponse.json({ error: "Question is unavailable." }, { status: 404 });
    const links = await supabase.from("research_question_findings").select("finding_id").eq("question_id", questionId).eq("user_id", userId);
    if (links.error) throw links.error;
    const ids = (links.data ?? []).map((link) => link.finding_id);
    const findings = ids.length ? await supabase.from("research_findings").select("id,title,status").eq("user_id", userId).in("id", ids) : { data: [], error: null };
    if (findings.error) throw findings.error;
    return NextResponse.json({ items: findings.data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error, "Question findings could not be loaded."); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const questionId = z.uuid().parse((await params).id);
    const { finding_id } = findingInput.parse(await request.json());
    const { supabase, userId } = await requireUser();
    const [question, finding] = await Promise.all([
      supabase.from("research_questions").select("id").eq("id", questionId).eq("user_id", userId).maybeSingle(),
      supabase.from("research_findings").select("id").eq("id", finding_id).eq("user_id", userId).maybeSingle(),
    ]);
    if (question.error ?? finding.error) throw question.error ?? finding.error;
    if (!question.data || !finding.data) return NextResponse.json({ error: "Choose a finding from your own workspace." }, { status: 404 });
    const saved = await supabase.from("research_question_findings").upsert({ user_id: userId, question_id: questionId, finding_id }, { onConflict: "question_id,finding_id" }).select("*").single();
    if (saved.error) throw saved.error;
    return NextResponse.json({ item: saved.data }, { status: 201 });
  } catch (error) { return apiError(error, "Finding could not be linked to this question."); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const questionId = z.uuid().parse((await params).id);
    const { finding_id } = findingInput.parse(await request.json());
    const { supabase, userId } = await requireUser();
    const removed = await supabase.from("research_question_findings").delete().eq("question_id", questionId).eq("finding_id", finding_id).eq("user_id", userId).select("finding_id").maybeSingle();
    if (removed.error) throw removed.error;
    if (!removed.data) return NextResponse.json({ error: "Question finding is unavailable." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error, "Finding could not be unlinked from this question."); }
}
