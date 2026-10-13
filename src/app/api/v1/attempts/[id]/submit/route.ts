import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/api";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { submitAttemptSchema } from "@/lib/validation";
import { submitAttempt } from "@/lib/assessment";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedMutation(request);
    await enforceRateLimit(request, "attempt-submit", 20, 60_000);
    const user = await requireApiUser();
    if (user.role !== "STUDENT" || !user.studentProfile) throw new ApiError(403, "STUDENT_ONLY", "A student account is required.");
    const { id } = await params;
    const input = submitAttemptSchema.parse(await request.json());
    const attempt = await submitAttempt(user.studentProfile.id, id, input.answers);
    return NextResponse.json({ attempt: { id: attempt.id, score: attempt.score, maxScore: attempt.maxScore, accuracy: attempt.accuracy }, next: `/results/${attempt.id}` });
  } catch (error) {
    return errorResponse(error);
  }
}
