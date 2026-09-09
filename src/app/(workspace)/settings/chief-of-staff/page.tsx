import { ChiefOfStaffSettingsView } from "@/features/chief-of-staff/chief-of-staff-settings-view";

export const metadata = {
  title: "Chief of Staff Settings | Daily Command Center",
  description: "Autonomy levels, approval policies, and execution limits",
};

export default function ChiefOfStaffSettingsPage() {
  return <ChiefOfStaffSettingsView />;
}
