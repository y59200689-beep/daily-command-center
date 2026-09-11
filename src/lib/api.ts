import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(error: unknown, fallback = "The request could not be completed.") {
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid data.", issues: error.flatten() }, { status: 400 });
  const message = error instanceof Error ? error.message : fallback;
  const status = message === "AUTH_REQUIRED" ? 401 : 500;
  return NextResponse.json({ error: status === 500 ? fallback : "Authentication required." }, { status });
}

export function isMissingOptionalSchema(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown };
  return candidate.code === "PGRST205" || candidate.code === "42P01";
}
