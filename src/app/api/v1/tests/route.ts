import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { getPublishedTests } from "@/lib/queries";

export async function GET() {
  try {
    await requireApiUser();
    const tests = await getPublishedTests();
    return NextResponse.json({ tests });
  } catch (error) {
    return errorResponse(error);
  }
}
