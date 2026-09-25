import Link from "next/link";
import type { Metadata } from "next";
import { RisksPage } from "@/features/intelligence/intelligence-pages";
export const metadata: Metadata = { title: "Risks — Daily Command Center" };
export default function Page() { return <><nav className="founder-module-links"><Link href="/risks/register">Open managed risk register →</Link><Link href="/state">Founder State →</Link></nav><RisksPage/></>; }
