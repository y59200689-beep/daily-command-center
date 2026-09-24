import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { extractActionsFromCommunication } from "@/lib/founder-os/tier3";

const bodySchema = z
  .object({
    text: z.string().min(5).max(10000),
  })
  .strict();

/**
 * POST /api/communication/extract
 *
 * Parses a block of natural-language communication text and returns proposed
 * structured actions (commitments, tasks, decisions, waiting items).
 *
 * The caller is responsible for confirming before any records are persisted.
 * Nothing is automatically written to the database by this endpoint.
 */
export async function POST(request: Request) {
  try {
    await requireUser(); // authenticate; no cross-user data returned
    const { text } = bodySchema.parse(await request.json());
    const actions = extractActionsFromCommunication(text);
    return NextResponse.json({ actions, source: text.slice(0, 200) });
  } catch (error) {
    return apiError(error, "Communication extraction failed.");
  }
}
