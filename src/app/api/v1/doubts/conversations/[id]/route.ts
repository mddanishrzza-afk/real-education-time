import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/api";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { getTutorConversation } from "@/lib/ai/tutor";
import { prisma } from "@/lib/db";

function requireStudent(user: Awaited<ReturnType<typeof requireApiUser>>) {
  if (user.role !== "STUDENT" || !user.studentProfile) {
    throw new ApiError(403, "STUDENT_ONLY", "A student account is required.");
  }
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    requireStudent(user);
    const { id } = await params;
    return NextResponse.json({ conversation: await getTutorConversation(user.id, id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedMutation(request);
    const user = await requireApiUser();
    requireStudent(user);
    await enforceRateLimit(request, `tutor-delete:${user.id}`, 20, 60 * 60_000);
    const { id } = await params;
    await getTutorConversation(user.id, id);
    await prisma.aiConversation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
