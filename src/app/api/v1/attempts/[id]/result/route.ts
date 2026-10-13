import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/api";
import { getAttemptResult } from "@/lib/queries";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    if (!user.studentProfile) throw new ApiError(403, "STUDENT_ONLY", "A student account is required.");
    const { id } = await params;
    const result = await getAttemptResult(id, user.studentProfile.id);
    if (!result) throw new ApiError(404, "RESULT_NOT_FOUND", "Result was not found.");
    return NextResponse.json({ result });
  } catch (error) {
    return errorResponse(error);
  }
}
