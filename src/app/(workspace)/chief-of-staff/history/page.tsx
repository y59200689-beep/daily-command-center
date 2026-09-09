import { ActionHistoryView } from "@/features/chief-of-staff/action-history-view";

export const metadata = {
  title: "Action History | Chief of Staff",
  description: "Immutable execution history, audit logs, and receipts",
};

export default function ActionHistoryPage() {
  return <ActionHistoryView />;
}
