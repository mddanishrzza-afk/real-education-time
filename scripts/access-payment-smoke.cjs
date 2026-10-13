/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");
const { PrismaClient } = require("@prisma/client");
const crypto = require("node:crypto");

const prisma = new PrismaClient();
const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const suffix = `${Date.now()}`;
const emails = [`access-browser-${suffix}@example.test`, `payment-admin-${suffix}@example.test`];
const rawStudent = `student-session-${suffix}-${crypto.randomBytes(20).toString("hex")}`;
const rawAdmin = `admin-session-${suffix}-${crypto.randomBytes(20).toString("hex")}`;
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const utr = `82026${suffix.slice(-9)}`;

// The smoke resolves the destination from the same environment the dev server reads, so it can
// never "pass" against a hardcoded value that no longer matches the deployment.
try { process.loadEnvFile?.(".env"); } catch { /* .env is optional */ }
const destination = (() => {
  const query = /^upi:\/\/pay\?(.+)$/i.exec((process.env.PAYMENT_QR_URI || "").trim())?.[1];
  if (query) {
    const params = new URLSearchParams(query);
    return { id: params.get("pa") || "", name: params.get("pn") || "", source: "PAYMENT_QR_URI" };
  }
  return { id: (process.env.MANUAL_UPI_ID || "").trim(), name: (process.env.MANUAL_UPI_NAME || "").trim(), source: "MANUAL_UPI_ID" };
})();
const gatewayEnabled = Boolean((process.env.PAYMENT_PROVIDER || "").trim() && (process.env.RAZORPAY_KEY_ID || "").trim());

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = users.map((user) => user.id);
  if (!ids.length) return;
  await prisma.entitlement.deleteMany({ where: { userId: { in: ids } } });
  await prisma.paymentOrder.deleteMany({ where: { userId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

(async () => {
  await cleanup();
  if (!destination.id) throw new Error("No payment destination configured: set PAYMENT_QR_URI (preferred) or MANUAL_UPI_ID in .env before running this smoke.");
  const [board, academicClass, publishedConcept, test] = await Promise.all([
    prisma.board.findFirstOrThrow({ where: { isActive: true } }),
    prisma.academicClass.findFirstOrThrow({ where: { levelOrder: 9 } }),
    prisma.concept.findFirstOrThrow({ where: { status: "PUBLISHED" }, include: { topic: { include: { chapter: true } } } }),
    prisma.test.findFirstOrThrow({ where: { status: "PUBLISHED", questions: { some: {} } }, include: { questions: { take: 1, include: { question: true } } } }),
  ]);
  const student = await prisma.user.create({ data: { name: "Access Browser Learner", email: emails[0], passwordHash: "browser-only", role: "STUDENT", status: "ACTIVE", emailVerifiedAt: new Date(), termsAcceptedAt: new Date(), privacyAcceptedAt: new Date(), studentProfile: { create: { boardId: board.id, classId: academicClass.id, onboardingCompleted: true } }, sessions: { create: { tokenHash: hash(rawStudent), expiresAt: new Date(Date.now() + 60 * 60_000) } } } });
  await prisma.user.create({ data: { name: "Payment Browser Admin", email: emails[1], passwordHash: "browser-only", role: "ADMIN", status: "ACTIVE", emailVerifiedAt: new Date(), sessions: { create: { tokenHash: hash(rawAdmin), expiresAt: new Date(Date.now() + 60 * 60_000) } } } });

  const browser = await chromium.launch({ headless: true });
  try {
    const studentContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await studentContext.addCookies([{ name: process.env.SESSION_COOKIE_NAME || "ret_session", value: rawStudent, url: base, httpOnly: true, sameSite: "Lax" }]);
    const page = await studentContext.newPage();
      // Leaving a live test attempt triggers the app's own "are you sure?" guard, which pauses the
      // page until the dialog is answered: accept it so the smoke can verify the rest of the flow.
      page.on("dialog", (dialog) => dialog.accept());

    const home = await page.goto(`${base}/`);
    const csp = home.headers()["content-security-policy"] || "";
    if (!csp.includes("checkout.razorpay.com") || !csp.includes("api.razorpay.com")) throw new Error("Payment CSP origins missing");
    await page.getByText("₹7", { exact: true }).waitFor();
    if (!(await page.request.get(`${base}/manifest.webmanifest`)).ok()) throw new Error("PWA manifest unavailable");
    if (!(await page.request.get(`${base}/service-worker.js`)).ok()) throw new Error("Service worker unavailable");
    if (!(await page.request.get(`${base}/refund-policy`)).ok()) throw new Error("Refund policy unavailable");

    await page.goto(`${base}/learn`);
    const studentNav = page.getByRole("navigation", { name: "Main navigation" });
    await studentNav.waitFor();
    for (const label of ["Home", "Learn", "Tests", "Tutor", "Stats", "Access"]) await studentNav.getByRole("link", { name: label, exact: true }).waitFor();
    await page.getByRole("heading", { name: "Learn chapter by chapter." }).waitFor();
    await page.getByRole("link", { name: "Class 6", exact: true }).click();
    await page.waitForURL(/learn\?class=6/);
    await page.getByRole("heading", { name: "Mathematics" }).waitFor();
    await page.goto(`${base}/learn/${publishedConcept.topic.chapter.id}`);
    await page.getByText("Activate access to open this lesson").waitFor();

    await page.goto(`${base}/tests/${test.slug}`);
    await page.getByText("Access required before questions load").waitFor();
    if ((await page.locator("body").innerText()).includes(test.questions[0].question.stemEn)) throw new Error("Question stem leaked before access");

    await page.goto(`${base}/access`);
    await page.getByRole("heading", { name: "1-hour unlimited demo" }).waitFor();
    await page.getByText(/you may start unlimited test attempts/).waitFor();
    await page.getByRole("button", { name: "Start my 1-hour demo" }).click();
    await page.getByText("Demo active").waitFor();

    await page.goto(`${base}/learn/${publishedConcept.topic.chapter.id}`);
    await page.getByRole("heading", { name: publishedConcept.titleEn }).waitFor();
    await page.goto(`${base}/tests/${test.slug}`);
    await page.getByRole("button", { name: /Start test/ }).click();
    await page.getByText(/Question 1 of/).waitFor();

    await page.goto(`${base}/access`);
    if (gatewayEnabled) {
      await page.getByRole("button", { name: "Pay securely" }).first().click();
      await page.getByText("Permanent category access is now active").waitFor();
      await page.getByText("Unlocked").first().waitFor();
    } else {
      // Without a gateway the live path is manual UPI: the button must open the QR flow instead
      // of pretending to charge the student.
      await page.getByRole("button", { name: "Pay by UPI / QR" }).first().click();
      await page.getByText(/Choose your plan, pay with any UPI app/).waitFor();
    }

    const manual = page.locator("details#upi-manual");
    await manual.waitFor({ timeout: 15_000 });
    // The plan button already opened this panel; clicking the summary again would close it.
    if (!(await manual.evaluate((element) => element.open))) await manual.locator("summary").click();
    if (!(await manual.evaluate((element) => element.open))) throw new Error("The UPI panel did not open");
    const planSelect = manual.getByLabel("Plan");
    const selectedPlan = await planSelect.inputValue();
    if (gatewayEnabled === false && selectedPlan !== "SCHOOL_6_12_FULL") throw new Error(`The plan button opened the panel on ${selectedPlan} instead of the plan it was clicked for`);
    const selectedLabel = (await planSelect.locator(`option[value="${selectedPlan}"]`).textContent()) || "";
    const rupees = (/₹\s?([\d,]+)/.exec(selectedLabel)?.[1] || "").replaceAll(",", "");
    if (!rupees) throw new Error(`Could not read the price of the selected plan from "${selectedLabel}"`);

    const qrImage = manual.locator("img").first();
    await qrImage.waitFor();
    const qrSrc = await qrImage.getAttribute("src");
    if (qrSrc !== `/payment/qr?plan=${encodeURIComponent(selectedPlan)}`) throw new Error(`Unexpected payment QR source: ${qrSrc}`);
    const qrAlt = (await qrImage.getAttribute("alt")) || "";
    if (!qrAlt.includes(selectedLabel.split(" — ")[0]) && !/₹\d/.test(qrAlt)) throw new Error(`QR is not described for screen readers: ${qrAlt}`);
    if (destination.name && !qrAlt.includes(destination.name)) throw new Error(`QR alt text names the wrong receiver: ${qrAlt}`);

    const qrResponse = await page.request.get(`${base}${qrSrc}`);
    if (qrResponse.status() !== 200) throw new Error(`Payment QR route returned ${qrResponse.status()}`);
    if (!(qrResponse.headers()["content-type"] || "").includes("image/svg+xml")) throw new Error("Payment QR is not served as SVG");
    if (qrResponse.headers()["x-payment-payee"] !== destination.id) throw new Error(`QR payee ${qrResponse.headers()["x-payment-payee"]} does not match the configured ${destination.id}`);
    const qrPayload = qrResponse.headers()["x-payment-uri"] || "";
    if (!qrPayload.startsWith(`upi://pay?pa=${encodeURIComponent(destination.id)}`)) throw new Error(`QR payload targets a different recipient: ${qrPayload}`);
    if (!qrPayload.includes(`am=${rupees}.00`)) throw new Error(`QR payload does not lock the plan amount ${rupees}.00: ${qrPayload}`);
    const qrSvg = await qrResponse.text();
    if (!qrSvg.startsWith("<svg") || qrSvg.includes("<script") || qrSvg.includes("href=")) throw new Error("Payment QR SVG is not self-contained");

    const upiHref = await page.getByRole("link", { name: "Open UPI app" }).getAttribute("href");
    if (!upiHref.startsWith(`upi://pay?pa=${encodeURIComponent(destination.id)}`)) throw new Error(`Unexpected UPI deep link: ${upiHref}`);
    if (destination.name && !upiHref.includes(`pn=${encodeURIComponent(destination.name)}`)) throw new Error(`UPI deep link lost the payee name: ${upiHref}`);
    if (!upiHref.includes(`am=${rupees}.00`)) throw new Error(`UPI deep link does not pre-fill the plan amount: ${upiHref}`);
    const manualText = await manual.innerText();
    if (!manualText.includes(destination.id)) throw new Error("The panel does not print the configured UPI ID");
    if (destination.name && !manualText.includes(`receiver name “${destination.name}”`)) throw new Error("The panel does not name the receiver that the QR pays");

    // The old committed PhonePe screenshot pointed at a different recipient: it must be gone.
    if ((await page.request.get(`${base}/payment/phonepe-qr.jpeg`)).status() !== 404) throw new Error("The stale committed QR screenshot is still being served");
    if ((await page.content()).includes("phonepe-qr.jpeg")) throw new Error("A page still references the stale committed QR screenshot");
    await page.getByLabel("Plan").selectOption("BOARD_COMPETITIVE_FULL");
    await page.getByLabel("UPI transaction reference").fill(utr);
    await page.getByRole("button", { name: "Submit for review" }).click();
    await page.getByText(/administrator verifies receipt/).waitFor();
    if (await prisma.paymentOrder.count({ where: { userId: student.id, manualUtr: utr, status: "PENDING_REVIEW" } }) !== 1) throw new Error("Manual order was not persisted");

    const adminContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await adminContext.addCookies([{ name: process.env.SESSION_COOKIE_NAME || "ret_session", value: rawAdmin, url: base, httpOnly: true, sameSite: "Lax" }]);
    const admin = await adminContext.newPage();
    admin.on("dialog", (dialog) => dialog.accept());
    await admin.goto(`${base}/admin/payments`);
    const adminNav = admin.getByRole("navigation", { name: "Main navigation" });
    await adminNav.getByRole("link", { name: "Payments", exact: true }).waitFor();
    if (await adminNav.getByRole("link", { name: "Learn", exact: true }).count()) throw new Error("Student navigation leaked into admin mobile navigation");
    await admin.getByText(`UTR ${utr}`).waitFor();
    await admin.getByRole("button", { name: "Approve" }).click();
    await admin.getByText(/entitlement granted/).waitFor();

    await page.reload();
    const expectedUnlocked = gatewayEnabled ? 2 : 1;
    if (await page.getByText("Unlocked").count() < expectedUnlocked) throw new Error(`Expected ${expectedUnlocked} unlocked categor${expectedUnlocked === 1 ? "y" : "ies"} to be visible`);
    const [school, boardAccess, trial] = await Promise.all([
      prisma.entitlement.count({ where: { userId: student.id, category: "SCHOOL_6_12", revokedAt: null } }),
      prisma.entitlement.count({ where: { userId: student.id, category: "BOARD_COMPETITIVE", revokedAt: null } }),
      prisma.freeTrial.findUnique({ where: { userId: student.id }, select: { startsAt: true, expiresAt: true } }),
    ]);
    // Without a gateway only the BOARD_COMPETITIVE plan is bought here (through manual UPI review);
    // the SCHOOL_6_12 category is covered by the 1-hour demo record, which is why that must still exist.
    const expectedSchool = gatewayEnabled ? 1 : 0;
    if (school !== expectedSchool || boardAccess !== 1) throw new Error(`Unexpected entitlement counts school=${school} (expected ${expectedSchool}) board=${boardAccess} (expected 1)`);
    if (!trial || trial.expiresAt.getTime() - trial.startsAt.getTime() !== 3_600_000) throw new Error("The one-time 1-hour demo record is missing or is not exactly one hour long");
    console.log(`ACCESS_PAYMENT_E2E_OK (${gatewayEnabled ? "gateway" : "manual UPI"} path, payee ${destination.id} from ${destination.source}): pre-query locks, trial, lesson, test start, live QR payload, manual UPI review, admin approval, entitlement unlock, PWA assets, pricing/legal links`);
    await adminContext.close();
    await studentContext.close();
  } finally {
    await browser.close();
    await cleanup();
    await prisma.$disconnect();
  }
})().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
