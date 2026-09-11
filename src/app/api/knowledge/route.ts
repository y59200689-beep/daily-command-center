import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { isMissingKnowledgeSchema, rankResearchQueue, sourceFreshness, topicHealth } from "@/lib/knowledge";
import { apiError } from "@/lib/api";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    const [topics, sources, findings, questions, briefs, watches] = await Promise.all([
      supabase.from("research_topics").select("*").eq("user_id", userId).neq("status", "archived").order("updated_at", { ascending: false }).limit(30),
      supabase.from("knowledge_sources").select("*").eq("user_id", userId).is("archived_at", null).order("updated_at", { ascending: false }).limit(60),
      supabase.from("research_findings").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(50),
      supabase.from("research_questions").select("*").eq("user_id", userId).in("status", ["open", "researching"]).order("created_at", { ascending: false }).limit(30),
      supabase.from("research_briefs").select("*").eq("user_id", userId).neq("status", "archived").order("updated_at", { ascending: false }).limit(20),
      supabase.from("watch_entities").select("*").eq("user_id", userId).eq("status", "active").order("next_check_at", { ascending: true }).limit(20),
    ]);
    const failed = [topics, sources, findings, questions, briefs, watches].find((result) => result.error); if (failed?.error) throw failed.error;
    const today = new Date().toISOString().slice(0, 10);
    const stale = (sources.data ?? []).filter((source) => sourceFreshness(source.freshness_expires_at, today) === "stale");
    const health = (topics.data ?? []).map((topic) => {
      const rows = (findings.data ?? []).filter((finding) => finding.topic_id === topic.id);
      const qs = (questions.data ?? []).filter((question) => question.topic_id === topic.id);
      return { ...topic, health: topicHealth({ findings: rows.length, supported: rows.filter((row) => row.status === "supported").length, contradictions: rows.filter((row) => row.status === "contradicted" || row.status === "mixed").length, openQuestions: qs.length, staleSources: stale.length, nextReviewAt: topic.next_review_at }, today) };
    });
    const queue = rankResearchQueue([
      ...(questions.data ?? []).filter((item) => item.priority === "high").map((item) => ({ id: `question:${item.id}`, title: item.question, reason: "High-priority research question remains open.", route: `/knowledge/topics/${item.topic_id}#question-${item.id}`, score: 90 })),
      ...(findings.data ?? []).filter((item) => ["mixed", "contradicted"].includes(item.status)).map((item) => ({ id: `finding:${item.id}`, title: item.title, reason: "This Finding contains contradictory evidence.", route: `/knowledge/findings/${item.id}`, score: 85 })),
      ...stale.map((item) => ({ id: `source:${item.id}`, title: item.title, reason: "A linked source needs a freshness review.", route: `/knowledge/sources/${item.id}`, score: 70 })),
      ...health.filter((item) => item.next_review_at && item.next_review_at <= today).map((item) => ({ id: `review:${item.id}`, title: item.title, reason: "Topic review is due.", route: `/knowledge/topics/${item.id}`, score: 75 })),
    ]);
    return NextResponse.json({ overview: { topics: health, sources: sources.data ?? [], findings: findings.data ?? [], questions: questions.data ?? [], briefs: briefs.data ?? [], watches: watches.data ?? [], stale, queue } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (isMissingKnowledgeSchema(error)) {
      return NextResponse.json({
        overview: {
          schemaStatus: "unavailable",
          schemaDependency: "V9 knowledge schema",
          topics: [], sources: [], findings: [], questions: [], briefs: [], watches: [], stale: [], queue: [],
        },
      }, { headers: { "Cache-Control": "private, no-store" } });
    }
    return apiError(error, "Knowledge could not be loaded.");
  }
}
