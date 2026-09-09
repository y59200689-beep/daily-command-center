import type { Metadata } from "next";
import { SystemsRegistry } from "@/features/operations/systems-registry";

export const metadata: Metadata = {
  title: "Operations · Systems Registry",
  description: "Internal software, services, criticality tiers and blast radiuses",
};

export default function OperationsSystemsPage() {
  return <SystemsRegistry />;
}
