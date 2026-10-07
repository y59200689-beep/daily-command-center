import Link from "next/link";
import { ResourceWorkspace } from "@/features/founder-os/resource-workspace";
export const metadata = { title: "Training plans" };
export default function Page() { return <><section className="data-surface" style={{margin:"24px 24px 0",padding:"18px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}><div><strong>Build your exercise selection</strong><p className="dataset-note">Explore movements, muscles and instructions before shaping your plan.</p></div><Link className="button button--brand" href="/fitness/exercises">Open exercise library →</Link></section><ResourceWorkspace resource="training-plans" /></>; }
