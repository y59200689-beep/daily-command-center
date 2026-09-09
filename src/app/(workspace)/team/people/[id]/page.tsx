import type { Metadata } from "next";
import { PersonDetail } from "@/features/team/person-detail";

export const metadata: Metadata = {
  title: "Person Detail · Team OS",
  description: "Operational context, delegations, and responsibilities for team member",
};

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PersonDetail id={id} />;
}
