import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(error: unknown, fallback = "The request could not be completed.") {
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid data.", issues: error.flatten() }, { status: 400 });
  const message = error instanceof Error ? error.message : fallback;
  const status = message === "AUTH_REQUIRED" ? 401 : 500;
  return NextResponse.json({ error: status === 500 ? fallback : "Authentication required." }, { status });
}
