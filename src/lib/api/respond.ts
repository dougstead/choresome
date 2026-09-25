import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(status: number, message: string, details?: unknown, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}), ...(details ? { details } : {}) }, { status });
}

/** Converts a caught error from a route handler into an appropriate JSON response. */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return jsonError(400, "Invalid request", error.flatten());
  }
  if (error instanceof SyntaxError) {
    return jsonError(400, "Malformed JSON body");
  }
  if (isPrismaNotFoundError(error)) {
    return jsonError(404, "Not found");
  }
  console.error(error);
  return jsonError(500, "Internal server error");
}

function isPrismaNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2025"
  );
}
