import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const [sessions, emailTokens, resetTokens, guardianTokens, loginOtpChallenges] = await prisma.$transaction([
    prisma.session.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.emailVerificationToken.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.guardianConsentToken.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.loginOtpChallenge.deleteMany({ where: { expiresAt: { lte: now } } }),
  ]);
  console.info("Expired authentication records cleaned", {
    sessions: sessions.count,
    emailTokens: emailTokens.count,
    resetTokens: resetTokens.count,
    guardianTokens: guardianTokens.count,
    loginOtpChallenges: loginOtpChallenges.count,
  });
  return NextResponse.json({ success: true }, { headers: { "cache-control": "no-store" } });
}
