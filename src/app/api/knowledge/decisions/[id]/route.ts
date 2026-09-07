import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { decisionReadiness } from "@/lib/knowledge";
import { requireUser } from "@/lib/supabase/server";

type Row = Record<string, unknown> & { id: string };

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireUser();
    const decision = await supabase.from("decisions").select("id,title").eq("id", id).eq("user_id", userId).maybeSingle();
    if (decision.error) throw decision.error;
    if (!decision.data) return NextResponse.json({ error: "Decision is unavailable." }, { status: 404 });

    const linkResult = await supabase.from("knowledge_entity_links").select("knowledge_type,knowledge_id").eq("entity_type", "decision").eq("entity_id", id).eq("user_id", userId);
    if (linkResult.error) throw linkResult.error;
    const links = linkResult.data ?? [];
    const ids = (type: string) => links.filter((link) => link.knowledge_type === type).map((link) => link.knowledge_id);
    const ownedRows = async (table: string, selectedIds: string[]) => {
      if (!selectedIds.length) return [] as Row[];
      const result = await supabase.from(table).select("*").eq("user_id", userId).in("id", selectedIds);
      if (result.error) throw result.error;
      return (result.data ?? []) as Row[];
    };
    const [topics, findings, questions, briefs] = await Promise.all([
      ownedRows("research_topics", ids("topic")),
      ownedRows("research_findings", ids("finding")),
      ownedRows("research_questions", ids("question")),
      ownedRows("research_briefs", ids("brief")),
    ]);
    const evidenceResult = findings.length
      ? await supabase.from("finding_evidence").select("*").eq("user_id", userId).in("finding_id", findings.map((finding) => finding.id))
      : { data: [] as Row[], error: null };
    if (evidenceResult.error) throw evidenceResult.error;
    const evidence = (evidenceResult.data ?? []) as Row[];
    const sourceIds = [...new Set(evidence.map((item) => String(item.source_id)))];
    const sources = await ownedRows("knowledge_sources", sourceIds);
    const sourceMap = new Map(sources.map((source) => [source.id, source]));
    const enrich = (rows: Row[]) => rows.map((row) => ({ ...row, source: sourceMap.get(String(row.source_id)) }));
    const supporting = enrich(evidence.filter((item) => ["supports", "weak_support"].includes(String(item.relation_type))));
    const contradicting = enrich(evidence.filter((item) => item.relation_type === "contradicts"));
    const openQuestions = questions.filter((question) => ["open", "researching"].includes(String(question.status)));
    const readiness = decisionReadiness({ findings: findings.length, supporting: supporting.length, contradicting: contradicting.length, openQuestions: openQuestions.length });
    const reason = readiness === "contradictory_evidence"
      ? `Linked evidence includes ${supporting.length} supporting and ${contradicting.length} contradicting source${contradicting.length === 1 ? "" : "s"}.`
      : readiness === "open_questions_remain"
        ? `${openQuestions.length} linked research question${openQuestions.length === 1 ? " is" : "s are"} unanswered.`
        : readiness === "needs_evidence"
          ? "No supported Finding is linked to this decision."
          : `${findings.length} supported Finding${findings.length === 1 ? " is" : "s are"} linked and no open research questions remain.`;
    return NextResponse.json({ topics, findings, supporting, contradicting, questions: openQuestions, briefs, readiness, reason }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Decision research could not be loaded.");
  }
}
