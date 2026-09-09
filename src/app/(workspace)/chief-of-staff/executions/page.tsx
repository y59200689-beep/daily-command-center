import { ActionExecutionsView } from "@/features/chief-of-staff/action-executions-view";

export const metadata = {
  title: "Execution Queue | Chief of Staff",
  description: "Track execution status, retry management, and verification",
};

export default function ActionExecutionsPage() {
  return <ActionExecutionsView />;
}
