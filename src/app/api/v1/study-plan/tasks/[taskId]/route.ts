import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { updateStudyPlanTask } from "@/lib/study-plan/service";

const updateTaskSchema = z.object({
  isCompleted: z.boolean().optional(),
  durationMinutes: z.number().int().min(5).max(180).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    assertTrustedMutation(request);
    const user = await requireApiUser();
    if (!user.studentProfile) throw new ApiError(403, "STUDENT_ONLY", "Student profile is required.");
    await enforceRateLimit(request, `study-plan:task:${user.id}`, 60, 60_000);
    const { taskId } = await context.params;
    const input = updateTaskSchema.parse(await parseJsonBody(request));
    const task = await updateStudyPlanTask(user.studentProfile.id, taskId, input);
    return NextResponse.json({ task });
  } catch (error) {
    return errorResponse(error);
  }
}
