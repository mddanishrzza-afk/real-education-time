/* eslint-disable @typescript-eslint/no-require-imports */
// Real end-to-end proof for the manual net-banking (NEFT/IMPS bank transfer) path.
// Runs against a dev/preview server started WITH BANK_* configured for the test:
//   BANK_ACCOUNT_NAME="RET Test" BANK_ACCOUNT_NUMBER=... BANK_IFSC=... BANK_NAME=... npx next dev -p 3100
const crypto = require("node:crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const base = process.env.SMOKE_BASE_URL || "http://localhost:3100";
const suffix = `${Date.now()}`;
const emails = [`bank-student-${suffix}@example.test`, `bank-admin-${suffix}@example.test`, `bank-ui-${suffix}@example.test`];
const rawStudent = `bank-student-${suffix}-${crypto.randomBytes(20).toString("hex")}`;
const rawAdmin = `bank-admin-${suffix}-${crypto.randomBytes(20).toString("hex")}`;
const rawUi = `bank-ui-${suffix}-${crypto.randomBytes(20).toString("hex")}`;
const uiUtr = `7${suffix.slice(-10)}`;
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const utr = `9${suffix.slice(-10)}`;
const cookieName = process.env.SESSION_COOKIE_NAME || "ret_session";
const xff = `10.${Number(suffix.slice(-6)) % 250}.77.5`;
let created = [];
let browser = null;

function call(path, { cookie, method = "GET", body } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: { cookie: `${cookieName}=${cookie}`, origin: base, "x-forwarded-for": xff, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (response) => ({ status: response.status, json: await response.json().catch(() => null) }));
}

function check(condition, label, detail) {
  if (!condition) throw new Error(`${label}${detail ? ` — ${JSON.stringify(detail)}` : ""}`);
  console.log(`  ok  ${label}`);
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = users.map((user) => user.id);
  if (!ids.length) return;
  await prisma.entitlement.deleteMany({ where: { userId: { in: ids } } });
  await prisma.paymentOrder.deleteMany({ where: { userId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

(async () => {
  await cleanup();
  const [plan, board, academicClass] = await Promise.all([
    prisma.accessPlan.findFirstOrThrow({ where: { code: "SCHOOL_6_12_FULL", isActive: true } }),
    prisma.board.findFirstOrThrow({ where: { isActive: true } }),
    prisma.academicClass.findFirstOrThrow({ where: { levelOrder: 9 } }),
  ]);
  const student = await prisma.user.create({
    data: {
      name: "Bank Transfer Learner", email: emails[0], passwordHash: "smoke-only", role: "STUDENT", status: "ACTIVE",
      emailVerifiedAt: new Date(), termsAcceptedAt: new Date(), privacyAcceptedAt: new Date(),
      studentProfile: { create: { boardId: board.id, classId: academicClass.id, onboardingCompleted: true } },
      sessions: { create: { tokenHash: hash(rawStudent), expiresAt: new Date(Date.now() + 3_600_000) } },
    },
  });
  const admin = await prisma.user.create({
    data: {
      name: "Bank Transfer Admin", email: emails[1], passwordHash: "smoke-only", role: "ADMIN", status: "ACTIVE",
      emailVerifiedAt: new Date(),
      sessions: { create: { tokenHash: hash(rawAdmin), expiresAt: new Date(Date.now() + 3_600_000) } },
    },
  });
  created = [student.id, admin.id];

  // 1. Another student cannot read bank details without signing in.
  const anonymous = await call("/api/v1/payments/netbanking");
  check(anonymous.status === 401, "unauthenticated read is rejected", anonymous);

  // 2. Signed-in student reads the configured destination account.
  const details = await call("/api/v1/payments/netbanking", { cookie: rawStudent });
  check(details.status === 200, "signed-in student reads bank details", details);
  check(details.json?.netbanking?.available === true, "bank transfer is reported available", details.json?.netbanking);
  check(typeof details.json?.netbanking?.accountNumber === "string" && details.json.netbanking.accountNumber.length >= 6, "account number is returned", details.json?.netbanking);
  check(details.json?.netbanking?.reviewWindowHours > 0, "manual review window is disclosed", details.json?.netbanking);

  // 3. A malformed bank reference is rejected before it reaches the review queue.
  const badRef = await call("/api/v1/payments/netbanking", { cookie: rawStudent, method: "POST", body: { planCode: plan.code, utr: "AB1" } });
  check(badRef.status === 422, "too-short bank reference is rejected", badRef);

  // 4. A real-looking reference creates a PENDING_REVIEW net-banking order (never instant access).
  const submitted = await call("/api/v1/payments/netbanking", { cookie: rawStudent, method: "POST", body: { planCode: plan.code, utr } });
  check(submitted.status === 201, "bank reference is accepted", submitted);
  check(submitted.json?.order?.status === "PENDING_REVIEW", "order waits for manual verification", submitted.json?.order);
  const orderId = submitted.json?.order?.id;
  const stored = await prisma.paymentOrder.findUniqueOrThrow({ where: { id: orderId } });
  check(stored.provider === "NETBANKING", "order is recorded as NETBANKING in the database", stored.provider);
  check(stored.manualUtr === utr && stored.amountPaise === plan.amountPaise, "amount and reference are stored exactly", { utr: stored.manualUtr, amountPaise: stored.amountPaise });

  // 5. Access must still be locked while the transfer is unverified.
  const locked = await call("/api/v1/access", { cookie: rawStudent });
  check(locked.status === 200, "access state is readable before approval", locked);
  check(locked.json?.access?.school?.allowed !== true, "access stays locked until an admin verifies the transfer", locked.json?.access);

  // 6. The same bank reference cannot be reused for a second order.
  const duplicate = await call("/api/v1/payments/netbanking", { cookie: rawStudent, method: "POST", body: { planCode: plan.code, utr: utr.toLowerCase() } });
  check(duplicate.status === 409, "duplicate bank reference is refused", duplicate);

  // 7. A student cannot self-approve.
  const selfApprove = await call(`/api/v1/admin/payments/${orderId}`, { cookie: rawStudent, method: "PATCH", body: { approved: true } });
  check(selfApprove.status === 403, "students cannot approve their own bank transfer", selfApprove);

  // 8. Admin verification grants the real entitlement.
  const approved = await call(`/api/v1/admin/payments/${orderId}`, { cookie: rawAdmin, method: "PATCH", body: { approved: true, note: "Bank statement matched (smoke)" } });
  check(approved.status === 200, "admin approves the verified transfer", approved);
  check(approved.json?.order?.status === "PAID", "order is marked paid after verification", approved.json?.order);
  check(Boolean(approved.json?.entitlement), "a real entitlement is issued", approved.json?.entitlement);
  const entitlement = await prisma.entitlement.findFirst({ where: { userId: student.id, revokedAt: null } });
  check(Boolean(entitlement), "entitlement row exists in the database", entitlement);
  const unlocked = await call("/api/v1/access", { cookie: rawStudent });
  check(unlocked.status === 200 && unlocked.json?.access?.school?.allowed === true && unlocked.json?.access?.school?.source === "ENTITLEMENT", "access unlocks only after verification", unlocked.json?.access);

  // 9. Audit trail records the decision.
  const audit = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: { contains: "PAYMENT" } } });
  check(Boolean(audit), "admin decision is written to the audit log", audit?.action);

  // 10. The access center itself must offer the bank-transfer option honestly (real browser interaction).
  if (process.env.SMOKE_BROWSER !== "0") {
    const { chromium } = require("playwright");
    const uiUser = await prisma.user.create({
      data: {
        name: "Bank Transfer Ui", email: emails[2], passwordHash: "smoke-only", role: "STUDENT", status: "ACTIVE",
        emailVerifiedAt: new Date(), termsAcceptedAt: new Date(), privacyAcceptedAt: new Date(),
        studentProfile: { create: { boardId: board.id, classId: academicClass.id, onboardingCompleted: true } },
        sessions: { create: { tokenHash: hash(rawUi), expiresAt: new Date(Date.now() + 3_600_000) } },
      },
    });
    created.push(uiUser.id);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      await context.addCookies([{ name: cookieName, value: rawUi, url: base, httpOnly: true, sameSite: "Lax" }]);
      const page = await context.newPage();
      await page.goto(`${base}/access`);
      await page.getByRole("heading", { name: "Learn first. Pay only once." }).waitFor();
      const summary = page.getByText("Net Banking — NEFT / IMPS bank transfer");
      await summary.waitFor();
      await summary.click();
      await page.getByText(details.json.netbanking.accountNumber).waitFor();
      await page.getByText(/unlocks your category only after an administrator|only after an administrator/i).first().waitFor();
      await page.getByLabel(/Bank reference/i).fill(uiUtr);
      await page.getByRole("button", { name: "Submit for review" }).click();
      const status = page.getByRole("status");
      await status.waitFor();
      const statusText = await status.innerText();
      check(/Bank reference submitted/i.test(statusText), "access center confirms the submission in the browser", statusText);
      check(!/unlocked|access is active/i.test(statusText), "access center never claims instant unlock", statusText);
      await page.reload();
      await page.getByRole("heading", { name: "Payment history" }).waitFor();
      await page.getByText(/PENDING REVIEW/i).first().waitFor();
      check(true, "submitted bank transfer appears as PENDING REVIEW in payment history");
    } finally {
      await context.close();
    }

    // 11. The administrator review queue must show the bank transfer with the right method label, and approval must grant the entitlement.
    const adminContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    try {
      await adminContext.addCookies([{ name: cookieName, value: rawAdmin, url: base, httpOnly: true, sameSite: "Lax" }]);
      const adminPage = await adminContext.newPage();
      adminPage.on("dialog", (dialog) => dialog.accept());
      await adminPage.goto(`${base}/admin/payments`);
      await adminPage.getByRole("heading", { name: "Manual payment review" }).waitFor();
      await adminPage.getByText("Bank transfer (NEFT / IMPS)").first().waitFor();
      await adminPage.getByText(uiUtr).first().waitFor();
      check(true, "admin queue lists the bank transfer with the NEFT/IMPS label and its reference");
      await adminPage.getByRole("button", { name: "Approve" }).first().click();
      const adminStatus = adminPage.getByRole("status");
      await adminStatus.waitFor();
      const adminStatusText = await adminStatus.innerText();
      check(/approved; entitlement granted/i.test(adminStatusText), "admin UI approval grants access", adminStatusText);
      check(Boolean(await prisma.entitlement.findFirst({ where: { userId: uiUser.id, revokedAt: null } })), "database entitlement exists for the bank-transfer student");
    } finally {
      await adminContext.close();
    }
  }

  console.log("\nNETBANKING_SMOKE_PASS");
})().catch(async (error) => {
  console.error("\nNETBANKING_SMOKE_FAIL", error.message);
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close().catch(() => {});
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  // Never leave the process alive on a stray handle: a hidden hang once masked a real failure.
  await new Promise((resolve) => setTimeout(resolve, 50));
  process.exit(process.exitCode || 0);
});
