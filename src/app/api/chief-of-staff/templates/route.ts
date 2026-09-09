import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";

const SYSTEM_TEMPLATES = [
  {
    id: "tpl_client_payment",
    name: "Client Payment Follow-up",
    description: "Verify unpaid invoice balance, prepare polite reminder email draft, and schedule 3-day follow-up check.",
    domain: "finance",
    stepCount: 3,
  },
  {
    id: "tpl_client_renewal",
    name: "Client Renewal Preparation",
    description: "Review client outcome progress, draft renewal review email, and prepare calendar check-in.",
    domain: "success",
    stepCount: 4,
  },
  {
    id: "tpl_supplier_reorder",
    name: "Supplier Reorder Preparation",
    description: "Audit current stock levels, prepare supplier order draft with lead times, and notify owner.",
    domain: "commerce",
    stepCount: 3,
  },
  {
    id: "tpl_incident_followup",
    name: "Operational Incident Follow-up",
    description: "Document incident cause, assign corrective task with SOP link, and schedule post-incident review.",
    domain: "operations",
    stepCount: 3,
  },
  {
    id: "tpl_executive_followthrough",
    name: "Executive Review Follow-through",
    description: "Convert top executive priority into discrete delegated tasks with deadline and outcome metrics.",
    domain: "executive",
    stepCount: 3,
  },
];

export async function GET() {
  try {
    await requireUser();
    return NextResponse.json({ templates: SYSTEM_TEMPLATES });
  } catch (error) {
    return apiError(error, "Templates could not be loaded.");
  }
}
