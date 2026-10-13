import type { AccessCategory, Entitlement, FreeTrial } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";

export const TRIAL_DURATION_MS = 60 * 60 * 1_000;

type AccessEvidence = {
  entitlements: Pick<Entitlement, "category" | "startsAt" | "expiresAt" | "revokedAt">[];
  trial: Pick<FreeTrial, "startsAt" | "expiresAt"> | null;
};

export type AccessDecision =
  | { allowed: true; source: "ENTITLEMENT"; expiresAt: Date | null }
  | { allowed: true; source: "TRIAL"; expiresAt: Date }
  | { allowed: false; source: "NONE"; reason: "NOT_STARTED" | "TRIAL_EXPIRED" };

export function evaluateAccess(category: AccessCategory, evidence: AccessEvidence, now = new Date()): AccessDecision {
  const entitlement = evidence.entitlements.find(
    (item) =>
      item.category === category &&
      item.startsAt <= now &&
      !item.revokedAt &&
      (!item.expiresAt || item.expiresAt > now),
  );
  if (entitlement) return { allowed: true, source: "ENTITLEMENT", expiresAt: entitlement.expiresAt };

  if (evidence.trial && evidence.trial.startsAt <= now && evidence.trial.expiresAt > now) {
    return { allowed: true, source: "TRIAL", expiresAt: evidence.trial.expiresAt };
  }
  return {
    allowed: false,
    source: "NONE",
    reason: evidence.trial ? "TRIAL_EXPIRED" : "NOT_STARTED",
  };
}

export async function getAccessEvidence(userId: string): Promise<AccessEvidence> {
  const [entitlements, trial] = await Promise.all([
    prisma.entitlement.findMany({
      where: { userId },
      select: { category: true, startsAt: true, expiresAt: true, revokedAt: true },
    }),
    prisma.freeTrial.findUnique({
      where: { userId },
      select: { startsAt: true, expiresAt: true },
    }),
  ]);
  return { entitlements, trial };
}

export async function getAccessDecision(userId: string, category: AccessCategory, now = new Date()) {
  return evaluateAccess(category, await getAccessEvidence(userId), now);
}

export async function getAccessSummary(userId: string, now = new Date()) {
  const evidence = await getAccessEvidence(userId);
  return {
    school: evaluateAccess("SCHOOL_6_12", evidence, now),
    boardCompetitive: evaluateAccess("BOARD_COMPETITIVE", evidence, now),
    trial: evidence.trial
      ? {
          status: evidence.trial.expiresAt > now ? "ACTIVE" as const : "EXPIRED" as const,
          startsAt: evidence.trial.startsAt,
          expiresAt: evidence.trial.expiresAt,
        }
      : { status: "AVAILABLE" as const, startsAt: null, expiresAt: null },
  };
}

export async function assertAccess(userId: string, category: AccessCategory) {
  const decision = await getAccessDecision(userId, category);
  if (!decision.allowed) {
    throw new ApiError(
      402,
      "ACCESS_REQUIRED",
      decision.reason === "TRIAL_EXPIRED"
        ? "Your one-hour demo has ended. Choose a one-time access plan to continue."
        : "Activate your one-hour demo or choose a one-time access plan to start.",
    );
  }
  return decision;
}

export async function activateOneTimeTrial(userId: string, now = new Date()) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, emailVerifiedAt: true, freeTrial: { select: { startsAt: true, expiresAt: true } } },
  });
  if (!user || user.status !== "ACTIVE") throw new ApiError(403, "ACCOUNT_INACTIVE", "An active account is required.");
  if (!user.emailVerifiedAt) throw new ApiError(403, "EMAIL_NOT_VERIFIED", "Verify your email before activating the demo.");
  if (user.freeTrial) {
    throw new ApiError(409, "TRIAL_ALREADY_USED", "The one-time demo has already been activated for this email.");
  }

  const expiresAt = new Date(now.getTime() + TRIAL_DURATION_MS);
  try {
    return await prisma.$transaction(async (tx) => {
      const trial = await tx.freeTrial.create({ data: { userId, startsAt: now, expiresAt } });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "FREE_TRIAL_ACTIVATED",
          resourceType: "FreeTrial",
          resourceId: trial.id,
          metadataJson: { startsAt: now.toISOString(), expiresAt: expiresAt.toISOString() },
        },
      });
      return trial;
    });
  } catch (error) {
    const existing = await prisma.freeTrial.findUnique({ where: { userId } });
    if (existing) throw new ApiError(409, "TRIAL_ALREADY_USED", "The one-time demo has already been activated for this email.");
    throw error;
  }
}
