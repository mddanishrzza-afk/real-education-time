/**
 * Promote one existing account to administrator (used for the /admin/payments review queue).
 *
 * A production database starts empty and the seed never creates privileged users, so the very
 * first administrator has to be named explicitly. Set ADMIN_EMAIL in the deployment environment
 * (Vercel → Settings → Environment Variables, Production scope) and redeploy: the account with
 * that address is promoted to ADMIN. Nothing happens when ADMIN_EMAIL is unset.
 *
 * Safety notes:
 * - The address must already belong to a signed-up account; unknown addresses only log a warning
 *   and never fail the build, so a typo cannot break a deployment.
 * - The promotion is idempotent and audit-logged. Remove ADMIN_EMAIL afterwards so later builds
 *   cannot silently re-promote an account.
 */
if (!process.env.ADMIN_EMAIL?.trim()) {
  console.log("[promote-admin] ADMIN_EMAIL is not set — nothing to promote.");
  process.exit(0);
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const email = process.env.ADMIN_EMAIL.trim().toLowerCase();

try {
  const user = await prisma.user.findFirst({ where: { email }, select: { id: true, role: true, emailVerifiedAt: true } });
  if (!user) {
    console.warn(`[promote-admin] No account exists for ${email} yet. Sign up on the live site first, then redeploy with ADMIN_EMAIL set.`);
  } else if (user.role === "ADMIN") {
    console.log(`[promote-admin] ${email} is already an administrator.`);
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN", emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
    });
    await prisma.auditLog.create({
      data: {
        actorId: null,
        action: "ADMIN_PROMOTED_BY_DEPLOY",
        resourceType: "User",
        resourceId: user.id,
        metadataJson: { email, via: "ADMIN_EMAIL build variable" },
      },
    });
    console.log(`[promote-admin] ${email} is now an administrator. Remove ADMIN_EMAIL and redeploy.`);
  }
} catch (error) {
  console.error("[promote-admin] Could not complete the promotion:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
