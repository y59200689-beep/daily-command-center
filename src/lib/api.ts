import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(error: unknown, fallback = "The request could not be completed.") {
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid data.", issues: error.flatten() }, { status: 400 });
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "23505") return NextResponse.json({ error: "This relationship or record already exists." }, { status: 409 });
  if (code === "23514") return NextResponse.json({ error: "The record violates a validation or ownership rule." }, { status: 400 });
  if (code === "23503") return NextResponse.json({ error: "The record is referenced by other work, or a selected relationship is unavailable." }, { status: 409 });
  const message = error instanceof Error ? error.message : fallback;
  const status = message === "AUTH_REQUIRED" ? 401 : 500;
  return NextResponse.json({ error: status === 500 ? fallback : "Authentication required." }, { status });
}

export function isMissingOptionalSchema(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown };
  return candidate.code === "PGRST205" || candidate.code === "42P01";
}
