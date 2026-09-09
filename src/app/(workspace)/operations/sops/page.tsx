import type { Metadata } from "next";
import { SopLibrary } from "@/features/operations/sop-library";

export const metadata: Metadata = {
  title: "Operations · SOP Library",
  description: "Documented standard operating procedures and version history",
};

export default function OperationsSopsPage() {
  return <SopLibrary />;
}
