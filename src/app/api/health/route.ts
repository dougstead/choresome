import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Unauthenticated liveness + database check for uptime monitors and deploy scripts. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[health] database check failed:", error);
    return NextResponse.json({ status: "error" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
