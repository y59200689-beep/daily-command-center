import { TeamReview } from "@/features/team/team-review";

export const metadata = {
  title: "Team Review · Team OS",
  description: "Weekly and monthly coordination reviews and delegation retrospectives",
};

export default function ReviewPage() {
  return <TeamReview />;
}
