import { NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import {
  certificateEligibility,
  getCertificateForAttempt,
  getTestRank,
  issueCertificateForAttempt,
} from "@/lib/certificates";
import { prisma } from "@/lib/db";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";

function requireStudent(user: Awaited<ReturnType<typeof requireApiUser>>) {
  if (user.role !== "STUDENT" || !user.studentProfile) {
    throw new ApiError(403, "STUDENT_ONLY", "A student account is required.");
  }
  return { userId: user.id, studentId: user.studentProfile.id };
}

async function loadAttempt(attemptId: string, studentId: string) {
  const attempt = await prisma.testAttempt.findFirst({
    where: { id: attemptId, studentId },
    include: { test: { select: { id: true, titleEn: true, passPercentage: true } } },
  });
  if (!attempt) throw new ApiError(404, "ATTEMPT_NOT_FOUND", "No attempt of this account matches that id.");
  return attempt;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const student = requireStudent(user);
    const { id: attemptId } = await params;
    const attempt = await loadAttempt(attemptId, student.studentId);
    const eligibility = certificateEligibility({
      status: attempt.status,
      score: attempt.score,
      maxScore: attempt.maxScore,
      passPercentage: attempt.test.passPercentage,
    });
    const certificate = await getCertificateForAttempt(attempt.id, student.studentId);
    const rank = eligibility.eligible || certificate
      ? await getTestRank(attempt.test.id, {
          id: attempt.id,
          score: attempt.score,
          accuracy: attempt.accuracy,
          submittedAt: attempt.submittedAt,
        })
      : null;
    return NextResponse.json({ certificate, eligibility, rank });
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
    await enforceRateLimit(request, `certificate-issue:${student.userId}`, 20, 60 * 60_000);
    const { certificate, created } = await issueCertificateForAttempt({
      attemptId,
      studentId: student.studentId,
      userId: student.userId,
    });
    return NextResponse.json({ certificate, created }, { status: created ? 201 : 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
