import { ExecutiveBriefing } from "@/features/founder-os/executive-briefing";
import { WeeklyReviewPage } from "@/features/intelligence/intelligence-pages";
import Link from "next/link";
import { WorkspaceTabs, selectedView } from "@/components/workspace-tabs";
export default function Page({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) { return <ReviewContent searchParams={searchParams}/>; }
async function ReviewContent({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
 const view = await selectedView(searchParams, ["executive","reflection"], "executive");
 return <WorkspaceTabs title="Weekly review" base="/review/weekly" tabs={[{id:"executive",label:"Executive review"},{id:"reflection",label:"Personal reflection"}]} active={view}>{view === "reflection" ? <WeeklyReviewPage/> : <ExecutiveBriefing mode="weekly"/>}<nav className="review-directory" aria-label="More reviews"><span>Review by area</span>{[["Monthly strategy","/review/monthly"],["Quarterly strategy","/review/quarterly"],["Founder state","/state/review"],["Learning","/learning/review"],["Knowledge","/knowledge/review"],["Operations","/operations/review"],["Commerce","/commerce/review"],["Success","/success/review"],["Team","/team/review"]].map(([label,href]) => <Link key={href} href={href}>{label}</Link>)}</nav></WorkspaceTabs>;
}
