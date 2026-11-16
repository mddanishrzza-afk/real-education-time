import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { listNotifications, listNotificationsQuerySchema } from "@/lib/notifications/service";
import { enforceRateLimit } from "@/lib/security";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    await enforceRateLimit(request, `notifications:list:${user.id}`, 60, 60_000);
    const { searchParams } = new URL(request.url);
    const query = listNotificationsQuerySchema.parse(Object.fromEntries(searchParams.entries()));
    const result = await listNotifications(user.id, query);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
