import { ClientSuccessProfile } from "@/features/success/client-success-profile";

export const metadata = {
  title: "Client Success Profile | Daily Command Center",
  description: "View account health, outcomes, commitments, renewals, and risks for this client.",
};

export default async function ClientSuccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClientSuccessProfile clientId={id} />;
}
