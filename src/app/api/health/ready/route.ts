import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProductionConfigErrors } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const configErrors = getProductionConfigErrors();
  if (configErrors.length) {
    return NextResponse.json({ status: "not_ready", checks: { configuration: "failed" } }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ready", checks: { configuration: "ok", database: "ok" } }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Readiness database check failed", error);
    return NextResponse.json({ status: "not_ready", checks: { configuration: "ok", database: "failed" } }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
