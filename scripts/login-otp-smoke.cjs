/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const email = "browser-login-otp@example.test";
const password = "Browser123";

// The development rate limiter is keyed per client IP and allows 10 verify-otp
// calls per 15 minutes - exactly one smoke run's budget. Give each simulated
// client its own bucket so consecutive runs never inherit a 429, which the
// reuse assertion would otherwise misreport as an OTP-reuse regression.
const runSalt = 1 + Math.floor(Math.random() * 254);
const clientIps = {
  negative: `10.${runSalt}.11.7`,
  limit: `10.${runSalt}.12.7`,
  primary: `10.${runSalt}.13.7`,
};
let currentIp = clientIps.negative;

async function useClient(context, tag) {
  currentIp = clientIps[tag] || clientIps.negative;
  await context.setExtraHTTPHeaders({ "x-forwarded-for": currentIp });
}

async function postOtp(page, challengeId, code) {
  return page.evaluate(
    async ({ challengeId, code, ip }) => {
      const response = await fetch("/api/v1/auth/login/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ challengeId, code }),
      });
      const payload = { status: response.status, body: await response.json() };
      if (response.status === 429) {
        throw new Error("verify-otp returned 429: a development rate-limit bucket was exhausted");
      }
      return payload;
    },
    { challengeId, code, ip: currentIp },
  );
}

async function startOtp(page) {
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue to OTP" }).click();
  await page.getByText("Email OTP verification").waitFor();
  const code = (await page.getByTestId("development-login-otp").textContent())?.trim();
  if (!code || !/^\d{6}$/.test(code)) throw new Error("Development OTP was not exposed in safe local mode");
  const challenge = await prisma.loginOtpChallenge.findFirst({
    where: { user: { email } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) throw new Error("Persisted login OTP challenge is missing");
  return { challengeId: challenge.id, code };
}

async function returnToCredentials(page) {
  await page.getByRole("button", { name: "Use another account" }).click();
  await page.getByRole("button", { name: "Continue to OTP" }).waitFor();
}

(async () => {
  let browser;
  try {
    await prisma.user.deleteMany({ where: { email } });
    const user = await prisma.user.create({
      data: {
        name: "Browser OTP Learner",
        email,
        passwordHash: await bcrypt.hash(password, 4),
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        studentProfile: { create: {} },
      },
    });

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await useClient(context, "negative");
    await page.goto(`${base}/login`);

    const expired = await startOtp(page);
    if ((await prisma.session.count({ where: { userId: user.id } })) !== 0) {
      throw new Error("A session was created before OTP verification");
    }

    const missing = await postOtp(page, "missing-challenge-id-that-is-long-enough", "123456");
    if (missing.status !== 400 || missing.body?.error?.code !== "INVALID_OTP") {
      throw new Error("Missing OTP challenge was not rejected generically");
    }

    const incorrectCode = expired.code === "000000" ? "111111" : "000000";
    const incorrect = await postOtp(page, expired.challengeId, incorrectCode);
    if (incorrect.status !== 400 || incorrect.body?.error?.code !== "INVALID_OTP") {
      throw new Error("Incorrect OTP was not rejected generically");
    }
    if ((await prisma.loginOtpChallenge.findUniqueOrThrow({ where: { id: expired.challengeId } })).attempts !== 1) {
      throw new Error("Incorrect OTP attempt was not persisted");
    }

    await prisma.loginOtpChallenge.update({
      where: { id: expired.challengeId },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const expiredResult = await postOtp(page, expired.challengeId, expired.code);
    if (expiredResult.status !== 400 || expiredResult.body?.error?.code !== "INVALID_OTP") {
      throw new Error("Expired OTP was not rejected generically");
    }
    if ((await prisma.loginOtpChallenge.count({ where: { id: expired.challengeId } })) !== 0) {
      throw new Error("Expired OTP challenge was not consumed");
    }

    await returnToCredentials(page);
    await useClient(context, "limit");
    const limited = await startOtp(page);
    const limitedIncorrectCode = limited.code === "999999" ? "888888" : "999999";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const rejected = await postOtp(page, limited.challengeId, limitedIncorrectCode);
      if (rejected.status !== 400 || rejected.body?.error?.code !== "INVALID_OTP") {
        throw new Error(`OTP attempt ${attempt + 1} was not rejected generically`);
      }
    }
    if ((await prisma.loginOtpChallenge.count({ where: { id: limited.challengeId } })) !== 0) {
      throw new Error("Attempt-limited OTP challenge was not invalidated");
    }
    if ((await prisma.session.count({ where: { userId: user.id } })) !== 0) {
      throw new Error("Rejected OTP attempts created a session");
    }

    await returnToCredentials(page);
    await useClient(context, "primary");
    const accepted = await startOtp(page);
    await page.getByLabel("6-digit OTP").fill(accepted.code);
    await page.getByRole("button", { name: "Verify OTP and sign in" }).click();
    await page.waitForURL("**/onboarding");

    if ((await prisma.loginOtpChallenge.count({ where: { id: accepted.challengeId } })) !== 0) {
      throw new Error("Successful OTP was not consumed");
    }
    if ((await prisma.session.count({ where: { userId: user.id } })) !== 1) {
      throw new Error("Successful OTP did not create exactly one session");
    }

    const reused = await postOtp(page, accepted.challengeId, accepted.code);
    if (reused.status !== 400 || reused.body?.error?.code !== "INVALID_OTP") {
      throw new Error("Consumed OTP was reusable");
    }
    if ((await prisma.session.count({ where: { userId: user.id } })) !== 1) {
      throw new Error("Reused OTP changed the authenticated session count");
    }

    const auditActions = await prisma.auditLog.findMany({
      where: { actorId: user.id, action: { in: ["AUTH_LOGIN_OTP_SENT", "AUTH_LOGIN_OTP_REJECTED", "AUTH_LOGIN_OTP_VERIFIED"] } },
      select: { action: true },
    });
    const actions = new Set(auditActions.map(({ action }) => action));
    for (const required of ["AUTH_LOGIN_OTP_SENT", "AUTH_LOGIN_OTP_REJECTED", "AUTH_LOGIN_OTP_VERIFIED"]) {
      if (!actions.has(required)) throw new Error(`Missing OTP audit action: ${required}`);
    }

    console.log("LOGIN_OTP_E2E_OK: no pre-OTP session; missing, incorrect, expired, attempt-limited and reused OTPs rejected; one-time OTP created authenticated session");
  } finally {
    await prisma.user.deleteMany({ where: { email } }).catch(() => undefined);
    await prisma.$disconnect();
    if (browser) await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
