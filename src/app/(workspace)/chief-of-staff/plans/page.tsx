import { ActionPlansView } from "@/features/chief-of-staff/action-plans-view";

export const metadata = {
  title: "Action Plans | Chief of Staff",
  description: "Multi-step structured action sequences and dependencies",
};

export default function ActionPlansPage() {
  return <ActionPlansView />;
}
