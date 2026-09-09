import type { Metadata } from "next";
import { ExecutiveAttentionView } from "@/features/executive/executive-attention-view";

export const metadata: Metadata = { title: "Attention Allocation | Executive" };

export default function ExecutiveAttentionPage() {
  return <ExecutiveAttentionView />;
}
