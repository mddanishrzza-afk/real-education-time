import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { ApiError, errorResponse, parseJsonBody } from "@/lib/api";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { createTutorConversationSchema } from "@/lib/validation";
import { createTutorConversation, listTutorConversations } from "@/lib/ai/tutor";

function requireStudent(user: Awaited<ReturnType<typeof requireApiUser>>) {
  if (user.role !== "STUDENT" || !user.studentProfile) {
    throw new ApiError(403, "STUDENT_ONLY", "A student account is required.");
  }
  return { userId: user.id, boardId: user.studentProfile.boardId, classId: user.studentProfile.classId };
}

export async function GET() {
  try {
    const user = await requireApiUser();
    requireStudent(user);
    return NextResponse.json({ conversations: await listTutorConversations(user.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const user = await requireApiUser();
    const student = requireStudent(user);
    await enforceRateLimit(request, `tutor-conversation:${user.id}`, 20, 60 * 60_000);
    const input = createTutorConversationSchema.parse(await parseJsonBody(request));
    const conversation = await createTutorConversation(student, input);
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
