import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { generateStudentStudyPlan } from "@/lib/study-plan/service";

const generateSchema = z.object({
  availableMinutes: z.number().int().min(15).max(240).optional(),
  focusSubjectId: z.string().min(1).optional(),
  useAi: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const user = await requireApiUser();
    if (!user.studentProfile) throw new ApiError(403, "STUDENT_ONLY", "Student profile is required.");
    await enforceRateLimit(request, `study-plan:generate:${user.id}`, 10, 60_000);
    const body = await parseJsonBody(request).catch(() => ({}));
    const input = generateSchema.parse(body ?? {});
    const result = await generateStudentStudyPlan(user.studentProfile.id, input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
