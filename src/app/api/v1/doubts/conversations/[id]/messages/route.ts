import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { ApiError, errorResponse, parseJsonBody } from "@/lib/api";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { tutorMessageSchema } from "@/lib/validation";
import { askTutor } from "@/lib/ai/tutor";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedMutation(request);
    const user = await requireApiUser();
    if (user.role !== "STUDENT" || !user.studentProfile) {
      throw new ApiError(403, "STUDENT_ONLY", "A student account is required.");
    }
    await enforceRateLimit(request, `tutor-message:${user.id}`, 10, 60_000);
    const input = tutorMessageSchema.parse(await parseJsonBody(request));
    const { id } = await params;
    const result = await askTutor(
      { userId: user.id, boardId: user.studentProfile.boardId, classId: user.studentProfile.classId },
      id,
      input.question,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
