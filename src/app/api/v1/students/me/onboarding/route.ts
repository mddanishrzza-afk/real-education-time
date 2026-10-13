import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/api";
import { assertTrustedMutation } from "@/lib/security";
import { onboardingSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  try {
    assertTrustedMutation(request);
    const user = await requireApiUser();
    if (user.role !== "STUDENT" || !user.studentProfile) throw new ApiError(403, "STUDENT_ONLY", "A student account is required.");
    const input = onboardingSchema.parse(await request.json());

    const [board, academicClass] = await Promise.all([
      prisma.board.findFirst({ where: { id: input.boardId, isActive: true }, select: { id: true } }),
      prisma.academicClass.findFirst({ where: { id: input.classId, isActive: true }, select: { id: true } }),
    ]);
    if (!board || !academicClass) throw new ApiError(422, "INVALID_ACADEMIC_SELECTION", "Selected board or class is not available.");

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { preferredLanguage: input.preferredLanguage } }),
      prisma.studentProfile.update({
        where: { id: user.studentProfile.id },
        data: {
          boardId: input.boardId,
          classId: input.classId,
          preparationLevel: input.preparationLevel,
          dailyStudyMinutes: input.dailyStudyMinutes,
          onboardingCompleted: true,
        },
      }),
      prisma.auditLog.create({ data: { actorId: user.id, action: "STUDENT_ONBOARDING_COMPLETE", resourceType: "StudentProfile", resourceId: user.studentProfile.id } }),
    ]);

    return NextResponse.json({ success: true, next: "/tests/class-9-foundation-diagnostic" });
  } catch (error) {
    return errorResponse(error);
  }
}
