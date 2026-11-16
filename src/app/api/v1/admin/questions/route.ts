import { NextResponse } from "next/server";
import { ApiError, errorResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createOrImportQuestion } from "@/lib/question-intelligence/admin";
import { createQuestionInputSchema, questionSearchFilterSchema } from "@/lib/question-intelligence/contracts";
import { searchQuestions } from "@/lib/question-intelligence/search";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    if (user.role !== "ADMIN") throw new ApiError(403, "ADMIN_ONLY", "Administrator access is required.");
    await enforceRateLimit(request, `admin:questions:list:${user.id}`, 60, 60_000);
    const { searchParams } = new URL(request.url);
    const filters = questionSearchFilterSchema.parse(Object.fromEntries(searchParams.entries()));
    const result = await searchQuestions(filters, { isAdmin: true });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const user = await requireApiUser();
    if (user.role !== "ADMIN") throw new ApiError(403, "ADMIN_ONLY", "Administrator access is required.");
    await enforceRateLimit(request, `admin:questions:create:${user.id}`, 30, 60_000);
    const input = createQuestionInputSchema.parse(await parseJsonBody(request));
    const question = await createOrImportQuestion(user.id, input);
    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
