import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/api";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { startAttemptSchema } from "@/lib/validation";
import { startAttempt } from "@/lib/assessment";

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    await enforceRateLimit(request, "attempt-start", 30, 60_000);
    const user = await requireApiUser();
    if (user.role !== "STUDENT" || !user.studentProfile) throw new ApiError(403, "STUDENT_ONLY", "A student account is required.");
    const input = startAttemptSchema.parse(await request.json());
    const attempt = await startAttempt(user.id, user.studentProfile.id, input.testId);
    return NextResponse.json({ attempt: { id: attempt.id, startedAt: attempt.startedAt } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
