import { ActionApprovalsView } from "@/features/chief-of-staff/action-approvals-view";

export const metadata = {
  title: "Approval Center | Chief of Staff",
  description: "Exact reviewed payload approvals across Gmail, Calendar, and systems",
};

export default function ActionApprovalsPage() {
  return <ActionApprovalsView />;
}
