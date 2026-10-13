import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { ApiError, getClientIp } from "@/lib/api";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "ret_session";
const SESSION_DAYS = 30;

type SessionCookiePolicy = { sameSite: "lax" | "none"; secure: boolean };

/**
 * The public production app is served top-level, so the session cookie keeps
 * the strict SameSite=Lax policy. Hosted development previews (e.g. the Arena
 * live preview) render the app inside a cross-site iframe where browsers do not
 * attach SameSite=Lax cookies; sign-in would silently fail there. Over HTTPS in
 * development the cookie therefore uses SameSite=None + Secure, which is the
 * only combination browsers accept for embedded, cross-site requests.
 */
function sessionCookiePolicy(request: Request): SessionCookiePolicy {
  if (process.env.NODE_ENV === "production") return { sameSite: "lax", secure: true };
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  let requestProto = "";
  try {
    requestProto = new URL(request.url).protocol;
  } catch {
    requestProto = "";
  }
  const secure = forwardedProto ? forwardedProto === "https" : requestProto === "https:";
  return secure ? { sameSite: "none", secure: true } : { sameSite: "lax", secure: false };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, request: Request) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: request.headers.get("user-agent")?.slice(0, 500),
      ipAddress: getClientIp(request).slice(0, 64),
    },
  });

  const store = await cookies();
  const cookiePolicy = sessionCookiePolicy(request);
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: cookiePolicy.sameSite,
    secure: cookiePolicy.secure,
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyCurrentSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          studentProfile: { include: { board: true, academicClass: true, targetExam: true } },
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    store.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
    return null;
  }

  return session.user;
}

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  return user;
}
