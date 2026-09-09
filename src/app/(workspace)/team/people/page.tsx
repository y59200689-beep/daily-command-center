import { PeopleList } from "@/features/team/people-list";

export const metadata = {
  title: "People Directory · Team OS",
  description: "Directory of collaborators, contractors, and team members",
};

export default function PeoplePage() {
  return <PeopleList />;
}
