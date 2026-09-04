import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DomainPage } from "@/features/domains/domain-page";
const domains = ["tasks", "inbox", "projects", "clients", "followups", "notes", "goals", "waiting", "content", "campaigns", "ideas", "decisions", "prompts", "invoices", "expenses", "subscriptions", "finance", "fitness", "fitness-targets", "calendar", "assistant", "settings"] as const;
type Domain = (typeof domains)[number];
export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }): Promise<Metadata> { const { domain } = await params; return { title: domain[0].toUpperCase() + domain.slice(1) }; }
export default async function DynamicDomainPage({ params }: { params: Promise<{ domain: string }> }) { const { domain } = await params; if (!domains.includes(domain as Domain)) notFound(); return <DomainPage domain={domain as Domain} />; }
