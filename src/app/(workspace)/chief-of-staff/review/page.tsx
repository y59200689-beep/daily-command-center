import { ChiefOfStaffReviewView } from "@/features/chief-of-staff/chief-of-staff-review-view";

export const metadata = {
  title: "Action Review | Chief of Staff",
  description: "Comprehensive review of pending approvals, failed executions, and completed work",
};

export default function ChiefOfStaffReviewPage() {
  return <ChiefOfStaffReviewView />;
}
