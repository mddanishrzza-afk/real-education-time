import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { markNotificationRead } from "@/lib/notifications/service";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";

export async function PATCH(request: Request, context: { params: Promise<{ notificationId: string }> }) {
  try {
    assertTrustedMutation(request);
    const user = await requireApiUser();
    await enforceRateLimit(request, `notifications:read:${user.id}`, 60, 60_000);
    const { notificationId } = await context.params;
    const notification = await markNotificationRead(user.id, notificationId);
    return NextResponse.json({ notification });
  } catch (error) {
    return errorResponse(error);
  }
}
