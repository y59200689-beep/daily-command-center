import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";
import { loadOperatingMemory } from "@/lib/learning-server";
import type { MemoryScope } from "@/lib/learning";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const { searchParams } = new URL(request.url);
    const scope = (searchParams.get("scope") as MemoryScope) || "business";

    const memory = await loadOperatingMemory(supabase, userId, scope);
    return NextResponse.json(memory);
  } catch (error) {
    return apiError(error, "Failed to load operating memory.");
  }
}
