import { NextResponse } from "next/server";
import { ApiError, errorResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { verifyQuestion } from "@/lib/question-intelligence/admin";
import { verifyQuestionInputSchema } from "@/lib/question-intelligence/contracts";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";

export async function PATCH(request: Request, context: { params: Promise<{ questionId: string }> }) {
  try {
    assertTrustedMutation(request);
    const user = await requireApiUser();
    if (user.role !== "ADMIN") throw new ApiError(403, "ADMIN_ONLY", "Administrator access is required.");
    await enforceRateLimit(request, `admin:questions:verify:${user.id}`, 60, 60_000);
    const { questionId } = await context.params;
    const input = verifyQuestionInputSchema.parse(await parseJsonBody(request));
    const question = await verifyQuestion(user.id, questionId, input);
    return NextResponse.json({ question });
  } catch (error) {
    return errorResponse(error);
  }
}
