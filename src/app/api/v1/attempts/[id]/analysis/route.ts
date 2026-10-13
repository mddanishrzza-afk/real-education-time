import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/api";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import {
  analyseAttempt,
  getStoredAnalysisResponse,
  type AnalysisLanguage,
} from "@/lib/ai/attempt-analysis";

function requireStudent(user: Awaited<ReturnType<typeof requireApiUser>>) {
  if (user.role !== "STUDENT" || !user.studentProfile) {
    throw new ApiError(403, "STUDENT_ONLY", "A student account is required.");
  }
  return { userId: user.id, studentId: user.studentProfile.id };
}

function studentLanguage(preferred: string | null | undefined): AnalysisLanguage {
  return preferred === "HINDI" || preferred === "HINGLISH" ? preferred : "ENGLISH";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const student = requireStudent(user);
    const { id: attemptId } = await params;
    return NextResponse.json({ analysis: await getStoredAnalysisResponse(attemptId, student.studentId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedMutation(request);
    const user = await requireApiUser();
    const student = requireStudent(user);
    const { id: attemptId } = await params;
    await enforceRateLimit(request, `attempt-analysis:${student.userId}`, 12, 60 * 60_000);
    const analysis = await analyseAttempt({
      attemptId,
      studentId: student.studentId,
      userId: student.userId,
      language: studentLanguage(user.preferredLanguage),
    });
    return NextResponse.json({ analysis }, { status: analysis.cached ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
