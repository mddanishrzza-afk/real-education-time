import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { updateRevisionItemStatus } from "@/lib/study-plan/service";

const updateRevisionSchema = z.object({
  status: z.enum(["IN_PROGRESS", "COMPLETED", "SNOOZED"]),
  recallQuality: z.enum(["HARD", "GOOD", "EASY"]).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ revisionId: string }> }) {
  try {
    assertTrustedMutation(request);
    const user = await requireApiUser();
    if (!user.studentProfile) throw new ApiError(403, "STUDENT_ONLY", "Student profile is required.");
    await enforceRateLimit(request, `study-plan:revision:${user.id}`, 60, 60_000);
    const { revisionId } = await context.params;
    const input = updateRevisionSchema.parse(await parseJsonBody(request));
    const revision = await updateRevisionItemStatus(user.studentProfile.id, revisionId, input);
    return NextResponse.json({ revision });
  } catch (error) {
    return errorResponse(error);
  }
}
