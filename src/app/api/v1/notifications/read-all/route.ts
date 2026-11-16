import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { markAllNotificationsRead } from "@/lib/notifications/service";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";

export async function PATCH(request: Request) {
  try {
    assertTrustedMutation(request);
    const user = await requireApiUser();
    await enforceRateLimit(request, `notifications:read-all:${user.id}`, 20, 60_000);
    const result = await markAllNotificationsRead(user.id);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
