import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok", service: "real-education-time", time: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
