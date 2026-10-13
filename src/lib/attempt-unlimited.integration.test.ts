import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { startAttempt } from "@/lib/assessment";

const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const email = `unlimited-trial-${token}@example.test`;
const slug = `unlimited-trial-${token}`;

async function cleanup() {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.test.deleteMany({ where: { slug } });
}

afterEach(cleanup);

describe("one-hour unlimited test demo", () => {
  it("bypasses a configured per-test cap while active and blocks new attempts after expiry", async () => {
    const now = new Date();
    const test = await prisma.test.create({
      data: {
        slug,
        titleEn: "Unlimited trial policy integration test",
        mode: "PRACTICE",
        durationMinutes: 10,
        totalMarks: 1,
        maxAttempts: 1,
        status: "PUBLISHED",
        accessCategory: "SCHOOL_6_12",
      },
    });
    const user = await prisma.user.create({
      data: {
        email,
        name: "Unlimited Trial Learner",
        passwordHash: "integration-test-only",
        status: "ACTIVE",
        emailVerifiedAt: now,
        studentProfile: { create: { onboardingCompleted: true } },
        freeTrial: {
          create: {
            startsAt: new Date(now.getTime() - 60_000),
            expiresAt: new Date(now.getTime() + 59 * 60_000),
          },
        },
      },
      include: { studentProfile: true },
    });
    const studentId = user.studentProfile!.id;

    await prisma.testAttempt.createMany({
      data: Array.from({ length: 3 }, (_, index) => ({
        testId: test.id,
        studentId,
        status: "SUBMITTED",
        submittedAt: new Date(now.getTime() - (index + 1) * 1_000),
      })),
    });

    const activeAttempt = await startAttempt(user.id, studentId, test.id);
    expect(activeAttempt.status).toBe("IN_PROGRESS");
    expect(await prisma.testAttempt.count({ where: { testId: test.id, studentId } })).toBe(4);

    await prisma.testAttempt.delete({ where: { id: activeAttempt.id } });
    await prisma.freeTrial.update({
      where: { userId: user.id },
      data: { expiresAt: new Date(now.getTime() - 1) },
    });

    await expect(startAttempt(user.id, studentId, test.id)).rejects.toMatchObject({
      status: 402,
      code: "ACCESS_REQUIRED",
    });
  });
});
