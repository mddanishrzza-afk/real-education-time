import { NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/security";
import { getStudyPlanOverview } from "@/lib/study-plan/service";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user.studentProfile) throw new ApiError(403, "STUDENT_ONLY", "Student profile is required.");
    await enforceRateLimit(request, `study-plan:get:${user.id}`, 60, 60_000);
    const overview = await getStudyPlanOverview(user.studentProfile.id);
    return NextResponse.json(overview);
  } catch (error) {
    return errorResponse(error);
  }
}
