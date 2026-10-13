import { NextResponse } from "next/server";
import { destroyCurrentSession } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { assertTrustedMutation } from "@/lib/security";

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    await destroyCurrentSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
