import { LearningLessonDetailView } from "@/features/learning/learning-lesson-detail-view";

export const metadata = {
  title: "Lesson Detail | Daily Command Center",
  description: "Lesson details, evidence ledger, and impact confirmation",
};

export default async function LearningLessonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LearningLessonDetailView id={id} />;
}
