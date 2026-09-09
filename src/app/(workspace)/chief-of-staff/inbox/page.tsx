import { ActionInboxView } from "@/features/chief-of-staff/action-inbox-view";

export const metadata = {
  title: "Action Inbox | Chief of Staff",
  description: "Prepared action proposals waiting for staging or review",
};

export default function ActionInboxPage() {
  return <ActionInboxView />;
}
