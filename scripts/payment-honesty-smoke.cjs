/* eslint-disable @typescript-eslint/no-require-imports */
// Payment honesty guard: verifies the access center never advertises a payment method that
// is not actually live, and that it only shows bank details when they are truly configured.
// Run against a dev server started WITHOUT BANK_* configured (the default local setup):
//   npx next dev -H 0.0.0.0 -p 3000
const crypto = require("node:crypto");
const { chromium } = require("playwright");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const hash = (v) => crypto.createHash("sha256").update(v).digest("hex");
const base = "http://localhost:3000";
try { process.loadEnvFile?.(".env"); } catch { /* .env is optional */ }
const destination = (() => {
  const query = /^upi:\/\/pay\?(.+)$/i.exec((process.env.PAYMENT_QR_URI || "").trim())?.[1];
  if (query) {
    const params = new URLSearchParams(query);
    return { id: params.get("pa") || "", name: params.get("pn") || "" };
  }
  return { id: (process.env.MANUAL_UPI_ID || "").trim(), name: (process.env.MANUAL_UPI_NAME || "").trim() };
})();
(async () => {
  const suffix = Date.now();
  const email = `honest-ui-${suffix}@example.test`;
  const raw = `honest-${suffix}-${crypto.randomBytes(20).toString("hex")}`;
  const [board, cls] = await Promise.all([
    prisma.board.findFirstOrThrow({ where: { isActive: true } }),
    prisma.academicClass.findFirstOrThrow({ where: { levelOrder: 9 } }),
  ]);
  const user = await prisma.user.create({ data: { name: "Honesty Check", email, passwordHash: "x", role: "STUDENT", status: "ACTIVE", emailVerifiedAt: new Date(), termsAcceptedAt: new Date(), privacyAcceptedAt: new Date(), studentProfile: { create: { boardId: board.id, classId: cls.id, onboardingCompleted: true } }, sessions: { create: { tokenHash: hash(raw), expiresAt: new Date(Date.now() + 3600_000) } } } });
  const browser = await chromium.launch({ headless: true });
  let failed = 0;
  const expectOk = (ok, label) => { console.log(ok ? "  ok  " + label : "  FAIL " + label); if (!ok) failed++; };
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    await ctx.addCookies([{ name: "ret_session", value: raw, url: base, httpOnly: true, sameSite: "Lax" }]);
    const page = await ctx.newPage();
    await page.goto(`${base}/access`);
    await page.getByRole("heading", { name: "Learn first. Pay only once." }).waitFor();

    // collapsed summary text
    await page.getByText("Net Banking — NEFT / IMPS bank transfer").waitFor();
    expectOk((await page.getByText("Net Banking", { exact: true }).count()) === 0, "header chips do not advertise net banking while it is not live");
    expectOk((await page.getByText("With gateway", { exact: true }).count()) >= 1, "netbanking card is marked 'With gateway'");

    // open the bank-transfer card and read it honestly
    const card = page.locator("details#bank-transfer");
    await card.locator("summary").click();
    const cardText = await card.innerText();
    expectOk(cardText.includes("Automatic net banking is not live yet"), "honest 'not live' panel present");
    expectOk(/NEFT\/IMPS transfer path is already built/.test(cardText), "manual bank path explained");
    expectOk(/will not display bank details it cannot honour/.test(cardText), "states it will not show details it cannot honour");
    expectOk(!/Account number|IFSC/i.test(cardText), "no bank account details while unconfigured");
    expectOk(/UPI flow below/.test(cardText), "points to the live UPI flow");
    await card.screenshot({ path: "docs/screenshots/access-netbanking-honest.png" });

    // live UPI path still intact
    const upi = page.locator("details#upi-manual");
    await upi.locator("summary").click();
    await page.getByLabel(/UPI transaction reference/i).first().waitFor({ timeout: 15000 });
    const upiText = await upi.innerText();
    expectOk(Boolean(destination.id) && upiText.includes(destination.id), "live UPI ID is shown in the manual UPI flow");
    expectOk(!destination.name || upiText.includes(destination.name), "the receiver name shown is the configured payee");
    const qrSrc = (await upi.locator("img").first().getAttribute("src")) || "";
    expectOk(qrSrc.startsWith("/payment/qr?plan="), "the QR is rendered live from the configured destination");
    const qrResponse = await page.request.get(`${base}${qrSrc}`);
    expectOk(qrResponse.status() === 200 && (qrResponse.headers()["content-type"] || "").includes("image/svg+xml"), "the QR route serves a self-contained SVG");
    expectOk(qrResponse.headers()["x-payment-payee"] === destination.id, "the QR route reports the configured UPI ID");
    expectOk(qrResponse.headers()["x-payment-uri"]?.startsWith("upi://pay?pa="), "the QR route reports the exact UPI payload it encoded");

    // The header alone would still pass if the drawing itself were wrong, so the SVG is rasterised
    // in a real browser and read back by an independent decoder (jsQR) that knows nothing about
    // our code. This is the check that protects a student's money: whatever the QR shows must be
    // the same UPI ID and amount that the app prints next to it.
    await page.addScriptTag({ path: require.resolve("jsqr") });
    const scanned = await page.evaluate(async (src) => {
      const svg = await (await fetch(src)).text();
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("the payment SVG could not be drawn"));
        image.src = url;
      });
      const size = 560;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);
      const { data } = context.getImageData(0, 0, size, size);
      const result = window.jsQR(data, size, size, { inversionAttempts: "dontInvert" });
      URL.revokeObjectURL(url);
      return result ? result.data : null;
    }, qrSrc);
    const expectedUri = qrResponse.headers()["x-payment-uri"];
    expectOk(scanned === expectedUri, `an independent decoder reads the same UPI payload back from the drawing (${scanned})`);
    expectOk(Boolean(scanned) && scanned.includes(`pa=${encodeURIComponent(destination.id)}`), "the scanned QR points at the configured UPI ID");
    expectOk(Boolean(scanned) && /(^|&)am=\d+\.00(&|$)/.test(scanned), "the scanned QR locks the amount of the selected plan");
    expectOk(Boolean(scanned) && !/&(url|tid|sign|tr|mc_)=/.test(scanned), "the scanned QR carries no unsafe extra parameters");
    expectOk((await page.request.get(`${base}/payment/phonepe-qr.jpeg`)).status() === 404, "the old committed QR screenshot is no longer served");
    expectOk(!(await page.content()).includes("phonepe-qr.jpeg"), "no page still references the old QR screenshot");
    expectOk(/Not instant/.test(await page.locator("body").innerText()), "access center keeps the 'Not instant' honesty label");
    await page.screenshot({ path: "docs/screenshots/access-center-top.png" });

    if (failed) throw new Error(`${failed} honesty checks failed`);
    console.log("HONEST_UI_PASS");
  } finally {
    await browser.close();
    await prisma.studentProfile.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
})().catch(async (e) => { console.error("HONEST_UI_FAIL", e.message); await prisma.$disconnect(); process.exit(1); });
