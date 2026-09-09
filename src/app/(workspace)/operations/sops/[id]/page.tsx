import type { Metadata } from "next";
import { SopDetail } from "@/features/operations/sop-detail";

export const metadata: Metadata = {
  title: "Operations · SOP Detail",
  description: "View and execute standard operating procedure",
};

export default async function OperationsSopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SopDetail id={id} />;
}
