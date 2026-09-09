import type { Metadata } from "next";
import { OperationsCalendar } from "@/features/operations/operations-calendar";

export const metadata: Metadata = {
  title: "Operations · Schedule & Deadlines",
  description: "Operational calendar for recurring processes and review deadlines",
};

export default function OperationsCalendarPage() {
  return <OperationsCalendar />;
}
