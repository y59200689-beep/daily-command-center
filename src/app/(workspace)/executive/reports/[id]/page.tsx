import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { requireUser } from "@/lib/supabase/server";
import { z } from "zod";
import "@/features/executive/executive.css";
import "@/features/executive/report-detail.css";

const storedReport = z.object({
  title: z.string(), created_at: z.string(), period_start: z.string().nullable(), period_end: z.string().nullable(), summary: z.string(),
  sections: z.array(z.object({ title: z.string(), content: z.string() }).passthrough()),
  immutable_data: z.object({ contentMarkdown: z.string().optional(), sources: z.array(z.object({ title: z.string(), url: z.string(), publishedAt: z.string().nullish() })).optional() }).passthrough(),
});
export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase.from("executive_reports").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
  if (error) throw new Error("Report could not be loaded.");
  if (!data) notFound();
  const report = storedReport.parse(data);
  const sections = report.immutable_data.contentMarkdown ? [{ title: "Briefing", content: report.immutable_data.contentMarkdown }] : report.sections;
  const sources = (report.immutable_data.sources ?? []).filter(source => { try { const url = new URL(source.url); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; } });
  return <div className="executive-surface report-detail">
    <Link href="/executive/reports">← Reports</Link>
    <header className="report-detail__header"><p className="eyebrow">Saved report</p><h1>{report.title}</h1>
      <p>{report.period_start && report.period_end ? `${report.period_start} — ${report.period_end}` : "No reporting period"}</p>
      <p>Received <time dateTime={report.created_at}>{new Date(report.created_at).toLocaleDateString("en-GB", { timeZone: "Africa/Casablanca" })}</time></p>
    </header>
    {sections.length ? sections.map((section, index) => <article key={index} className="report-detail__content data-surface">
      {!report.immutable_data.contentMarkdown && <h2>{section.title}</h2>}
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{ a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{section.content}</ReactMarkdown>
    </article>) : <p>{report.summary}</p>}
    {sources.length > 0 && <section className="data-surface report-detail__sources"><h2>Sources</h2><ol>{sources.map((source, index) => <li key={index}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>{source.publishedAt && <span> · Published <time dateTime={source.publishedAt}>{source.publishedAt.slice(0, 10)}</time></span>}</li>)}</ol></section>}
  </div>;
}
