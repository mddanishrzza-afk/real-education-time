import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { questionSearchFilterSchema } from "@/lib/question-intelligence/contracts";
import { searchQuestions } from "@/lib/question-intelligence/search";
import { enforceRateLimit } from "@/lib/security";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    await enforceRateLimit(request, `questions:search:${user.id}`, 60, 60_000);
    const { searchParams } = new URL(request.url);
    const raw = Object.fromEntries(searchParams.entries());
    const filters = questionSearchFilterSchema.parse(raw);
    const result = await searchQuestions(filters, { isAdmin: user.role === "ADMIN" });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
