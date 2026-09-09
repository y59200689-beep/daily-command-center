import { Suspense } from "react";
import { OneOnOneView } from "@/features/team/one-on-one-view";

export const metadata = {
  title: "1:1 Preparation · Team OS",
  description: "Meeting preparation and follow-through across open loops and commitments",
};

export default function OneOnOnePage() {
  return (
    <Suspense fallback={<div className="page-shell"><p className="muted">Loading 1:1 prep…</p></div>}>
      <OneOnOneView />
    </Suspense>
  );
}
