import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/api";
import { getTutorProviderStatus, listTutorTopics } from "@/lib/ai/tutor";

export async function GET() {
  try {
    const user = await requireApiUser();
    if (user.role !== "STUDENT" || !user.studentProfile) {
      throw new ApiError(403, "STUDENT_ONLY", "A student account is required.");
    }
    const topics = await listTutorTopics({
      userId: user.id,
      boardId: user.studentProfile.boardId,
      classId: user.studentProfile.classId,
    });
    return NextResponse.json({ topics, provider: getTutorProviderStatus() });
  } catch (error) {
    return errorResponse(error);
  }
}
