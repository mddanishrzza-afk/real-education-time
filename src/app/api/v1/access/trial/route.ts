import { NextResponse } from "next/server";
import { activateOneTimeTrial } from "@/lib/access";
import { ApiError, errorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const user = await requireApiUser();
    if (user.role !== "STUDENT" || !user.studentProfile) throw new ApiError(403, "STUDENT_ONLY", "A student account is required.");
    await enforceRateLimit(request, `trial-activate:${user.id}`, 5, 60 * 60_000);
    const trial = await activateOneTimeTrial(user.id);
    return NextResponse.json({
      trial: { status: "ACTIVE", startsAt: trial.startsAt, expiresAt: trial.expiresAt },
      message: "Your one-time unlimited demo is active for one hour.",
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
