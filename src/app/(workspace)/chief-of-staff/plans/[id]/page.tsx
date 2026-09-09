import { ActionPlanDetailView } from "@/features/chief-of-staff/action-plan-detail-view";

export const metadata = {
  title: "Action Plan Details | Chief of Staff",
  description: "Sequential action execution details and dependency graph",
};

export default async function ActionPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ActionPlanDetailView planId={id} />;
}
