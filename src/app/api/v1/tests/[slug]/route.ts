import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/api";
import { getTestForRunner } from "@/lib/queries";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await requireApiUser();
    const { slug } = await params;
    const test = await getTestForRunner(slug);
    if (!test) throw new ApiError(404, "TEST_NOT_FOUND", "Test was not found.");
    return NextResponse.json({ test });
  } catch (error) {
    return errorResponse(error);
  }
}
