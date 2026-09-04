import type { Metadata } from "next";
import { FinanceDashboard } from "@/features/v2/finance-dashboard";
export const metadata:Metadata={title:"Finance — Daily Command Center"};export default function Page(){return <FinanceDashboard/>}
