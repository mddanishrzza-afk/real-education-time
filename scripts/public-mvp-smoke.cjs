/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");
const { PrismaClient } = require("@prisma/client");
const crypto = require("node:crypto");

const prisma = new PrismaClient();
const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const emails = ["browser-adult@example.test", "browser-minor@example.test"];
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const token = (name) => `browser-${name}-security-token-that-is-definitely-long-enough`;

async function completeLocalEmailOtp(page) {
  await page.getByText("Email OTP verification").waitFor();
  const code = (await page.getByTestId("development-login-otp").textContent())?.trim();
  if (!code || !/^\d{6}$/.test(code)) throw new Error("Development login OTP missing");
  await page.getByLabel("6-digit OTP").fill(code);
  await page.getByRole("button", { name: "Verify OTP and sign in" }).click();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    const home = await page.goto(`${base}/`);
    const csp = home.headers()["content-security-policy"] || "";
    if (!csp.includes("'nonce-") || !csp.includes("frame-ancestors 'none'")) throw new Error("Nonce CSP missing");

    await page.goto(`${base}/register`);
    await page.getByLabel("Full name").fill("Browser Adult");
    await page.getByLabel("Email address").fill(emails[0]);
    await page.getByLabel("Date of birth").fill("2000-01-01");
    await page.getByLabel("Create password").fill("Browser123");
    await page.getByLabel(/I accept the Terms/).check();
    await page.getByLabel(/I have read the Privacy/).check();
    await page.getByRole("button", { name: /Create learning profile/ }).click();
    await page.waitForURL("**/check-email?mode=register");
    const adult = await prisma.user.findUnique({ where: { email: emails[0] }, include: { sessions: true, emailVerificationTokens: true } });
    if (!adult || adult.status !== "PENDING_VERIFICATION" || adult.sessions.length || adult.emailVerificationTokens.length !== 1) throw new Error("Adult registration invariant failed");
    await prisma.emailVerificationToken.deleteMany({ where: { userId: adult.id } });
    await prisma.emailVerificationToken.create({ data: { userId: adult.id, tokenHash: hash(token("adult-verify")), expiresAt: new Date(Date.now() + 60_000) } });
    await page.goto(`${base}/verify-email?token=${token("adult-verify")}`);
    await page.getByRole("button", { name: "Verify my email" }).click();
    await page.getByText("Email verified. You can now sign in.").waitFor();
    if ((await prisma.user.findUnique({ where: { id: adult.id } })).status !== "ACTIVE") throw new Error("Adult activation failed");
    await page.goto(`${base}/login`);
    await page.getByLabel("Email address").fill(emails[0]);
    await page.getByLabel("Password", { exact: true }).fill("Browser123");
    await page.getByRole("button", { name: "Continue to OTP" }).click();
    await completeLocalEmailOtp(page);
    await page.waitForURL("**/onboarding");

    await context.clearCookies();
    await page.goto(`${base}/forgot-password`);
    await page.getByLabel("Account email").fill(emails[0]);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await page.getByText(/अगर यह email registered है/).waitFor();
    const developmentResetLink = page.getByRole("link", { name: "Open password-reset page" });
    const developmentResetPath = await developmentResetLink.getAttribute("href");
    if (!developmentResetPath?.startsWith("/reset-password?token=")) throw new Error("Development reset link missing");
    await developmentResetLink.click();
    await page.waitForURL("**/reset-password?token=*");
    await page.getByLabel("New password").fill("Changed456");
    await page.getByLabel("Confirm password").fill("Changed456");
    await page.getByRole("button", { name: "Change password" }).click();
    await page.getByText(/Password changed and existing sessions/).waitFor();

    await page.goto(`${base}/register`);
    await page.getByLabel("Full name").fill("Browser Minor");
    await page.getByLabel("Email address").fill(emails[1]);
    await page.getByLabel("Date of birth").fill("2012-01-01");
    await page.getByLabel("Parent or guardian email").fill("browser-guardian@example.test");
    await page.getByLabel("Create password").fill("Browser123");
    await page.getByLabel(/I accept the Terms/).check();
    await page.getByLabel(/I have read the Privacy/).check();
    await page.getByRole("button", { name: /Create learning profile/ }).click();
    await page.waitForURL("**/check-email?mode=register");
    const minor = await prisma.user.findUnique({ where: { email: emails[1] }, include: { emailVerificationTokens: true, guardianConsentTokens: true } });
    if (!minor || minor.emailVerificationTokens.length !== 1 || minor.guardianConsentTokens.length !== 1) throw new Error("Minor registration invariant failed");
    await prisma.$transaction([
      prisma.emailVerificationToken.deleteMany({ where: { userId: minor.id } }),
      prisma.guardianConsentToken.deleteMany({ where: { userId: minor.id } }),
      prisma.emailVerificationToken.create({ data: { userId: minor.id, tokenHash: hash(token("minor-verify")), expiresAt: new Date(Date.now() + 60_000) } }),
      prisma.guardianConsentToken.create({ data: { userId: minor.id, guardianEmail: "browser-guardian@example.test", tokenHash: hash(token("guardian")), expiresAt: new Date(Date.now() + 60_000) } }),
    ]);
    await page.goto(`${base}/verify-email?token=${token("minor-verify")}`);
    await page.getByRole("button", { name: "Verify my email" }).click();
    await page.getByText(/account will activate after guardian consent/).waitFor();
    if ((await prisma.user.findUnique({ where: { id: minor.id } })).status !== "PENDING_VERIFICATION") throw new Error("Minor activated before guardian");
    await page.goto(`${base}/guardian-consent?token=${token("guardian")}`);
    await page.getByLabel(/I am authorized/).check();
    await page.getByRole("button", { name: "Confirm guardian consent" }).click();
    await page.getByText(/learner account is now active/).waitFor();
    if ((await prisma.user.findUnique({ where: { id: minor.id } })).status !== "ACTIVE") throw new Error("Guardian activation failed");

    const ready = await page.request.get(`${base}/api/health/ready`);
    if (!ready.ok() || (await ready.json()).status !== "ready") throw new Error("Readiness failed");
    for (const path of ["/terms", "/privacy"]) if (!(await page.request.get(`${base}${path}`)).ok()) throw new Error(`${path} failed`);
    console.log("PUBLIC_MVP_E2E_OK: CSP, adult verification/login/recovery, minor guardian gate, policies, readiness");
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
