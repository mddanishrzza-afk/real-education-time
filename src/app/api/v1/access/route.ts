import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/api";
import { getAccessSummary } from "@/lib/access";

export async function GET() {
  try {
    const user = await requireApiUser();
    if (user.role !== "STUDENT") throw new ApiError(403, "STUDENT_ONLY", "A student account is required.");
    return NextResponse.json({ access: await getAccessSummary(user.id) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
