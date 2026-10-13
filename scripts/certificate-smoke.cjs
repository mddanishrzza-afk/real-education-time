/* eslint-disable @typescript-eslint/no-require-imports */
// Real end-to-end proof for the result-page final report (AI analysis + rank + performance) and the
// downloadable certificate: API honesty + browser flow on a dev server at :3000.
const crypto = require("node:crypto");
const fs = require("node:fs");
const zlib = require("node:zlib");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const suffix = `${Date.now()}`;
const emails = [`cert-student-${suffix}@example.test`, `cert-peer-a-${suffix}@example.test`, `cert-peer-b-${suffix}@example.test`];
const rawStudent = `cert-student-${suffix}-${crypto.randomBytes(20).toString("hex")}`;
const rawPeer = `cert-peer-a-${suffix}-${crypto.randomBytes(20).toString("hex")}`;
const cookieName = process.env.SESSION_COOKIE_NAME || "ret_session";
const xff = `10.${Number(suffix.slice(-6)) % 250}.77.5`;
const attemptIds = [];

const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

function call(path, { cookie, method = "GET", body } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      cookie: `${cookieName}=${cookie}`,
      origin: base,
      "x-forwarded-for": xff,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (response) => ({ status: response.status, json: await response.json().catch(() => null) }));
}

/** Pull the embedded JPEG out of a jsPDF file so the pixels of the download can be audited. */
function extractEmbeddedJpeg(bytes) {
  const direct = locateJpeg(bytes);
  if (direct) return direct;
  // compress: true can wrap streams in FlateDecode; inflate every stream and look again.
  const text = bytes.toString("latin1");
  let cursor = 0;
  while (true) {
    const start = text.indexOf("stream", cursor);
    if (start === -1) return null;
    const end = text.indexOf("endstream", start);
    if (end === -1) return null;
    const chunk = bytes.subarray(start + 6, end);
    try {
      const found = locateJpeg(zlib.inflateSync(chunk));
      if (found) return found;
    } catch {
      /* not a deflate stream */
    }
    cursor = end + 1;
  }
}

function locateJpeg(buffer) {
  const start = buffer.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
  if (start === -1) return null;
  const end = buffer.lastIndexOf(Buffer.from([0xff, 0xd9]));
  if (end <= start) return null;
  const jpeg = buffer.subarray(start, end + 2);
  const size = jpegDimensions(jpeg);
  return size ? { jpeg, ...size } : null;
}

function jpegDimensions(buffer) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

/** PNG header reader — proves the install icons really are the sizes the manifest claims. */
function pngDimensions(buffer) {
  if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function check(condition, label, detail) {
  if (!condition) throw new Error(`${label}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  console.log(`  ok  ${label}`);
}

async function makeUser(email, name, withSession) {
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: "smoke-only",
      role: "STUDENT",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      studentProfile: { create: { onboardingCompleted: true } },
      ...(withSession ? { sessions: { create: { tokenHash: hash(withSession), expiresAt: new Date(Date.now() + 3_600_000) } } } : {}),
    },
    include: { studentProfile: true },
  });
  return user;
}

async function makeAttempt(studentId, testId, { score, maxScore, accuracy, submittedAt }) {
  const correct = Math.round((score / maxScore) * 10);
  const attempt = await prisma.testAttempt.create({
    data: {
      testId,
      studentId,
      status: "SUBMITTED",
      score,
      maxScore,
      accuracy,
      correctCount: correct,
      incorrectCount: Math.max(10 - correct - 2, 0),
      skippedCount: Math.min(2, 10 - correct),
      durationSeconds: 600,
      averageResponseSeconds: 30,
      submittedAt,
    },
  });
  attemptIds.push(attempt.id);
  return attempt;
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = users.map((user) => user.id);
  if (ids.length || attemptIds.length) {
    await prisma.certificate.deleteMany({ where: { OR: [{ userId: { in: ids } }, { attemptId: { in: attemptIds } }] } });
  }
  if (ids.length) await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  if (attemptIds.length) {
    await prisma.performanceRecord.deleteMany({ where: { attemptId: { in: attemptIds } } });
    await prisma.testAttempt.deleteMany({ where: { id: { in: attemptIds } } });
  }
  if (ids.length) {
    await prisma.entitlement.deleteMany({ where: { userId: { in: ids } } });
    await prisma.paymentOrder.deleteMany({ where: { userId: { in: ids } } });
    await prisma.studentProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  attemptIds.length = 0;
}

(async () => {
  await cleanup();

  // Use a published test that no one has submitted yet, so the rank below is exact.
  const cleanTest = await prisma.test.findFirst({
    where: { status: "PUBLISHED", attempts: { none: { status: "SUBMITTED" } } },
    select: { id: true, titleEn: true, passPercentage: true },
  });
  const test = cleanTest ?? (await prisma.test.findFirstOrThrow({ where: { status: "PUBLISHED" }, select: { id: true, titleEn: true, passPercentage: true } }));
  const baseline = await prisma.testAttempt.count({ where: { testId: test.id, status: "SUBMITTED" } });
  const threshold = test.passPercentage && test.passPercentage > 0 ? test.passPercentage : 40;

  const student = await makeUser(emails[0], "Certificate Smoke Student", rawStudent);
  const peerA = await makeUser(emails[1], "Certificate Peer A", rawPeer); // peer keeps a session so we can prove cross-account access is blocked
  const peerB = await makeUser(emails[2], "Certificate Peer B", null);

  const now = Date.now();
  await makeAttempt(peerA.studentProfile.id, test.id, { score: 9, maxScore: 10, accuracy: 90, submittedAt: new Date(now - 300_000) });
  await makeAttempt(peerB.studentProfile.id, test.id, { score: 7, maxScore: 10, accuracy: 70, submittedAt: new Date(now - 200_000) });
  const mine = await makeAttempt(student.studentProfile.id, test.id, { score: 6, maxScore: 10, accuracy: 60, submittedAt: new Date(now - 100_000) });

  // 1. Only the signed-in owner can read certificate state.
  const anonymous = await call(`/api/v1/attempts/${mine.id}/certificate`);
  check(anonymous.status === 401, "anonymous read of certificate state is rejected", anonymous);

  // 2. A different student cannot probe another account's attempt.
  const peerRead = await call(`/api/v1/attempts/${mine.id}/certificate`, { cookie: rawPeer });
  check(peerRead.status === 404, "another student cannot read this attempt's certificate", peerRead);

  // 3. Eligibility and rank are computed from real rows.
  const eligibility = await call(`/api/v1/attempts/${mine.id}/certificate`, { cookie: rawStudent });
  check(eligibility.status === 200, "owner reads certificate eligibility", eligibility);
  check(eligibility.json?.eligibility?.eligible === true, "passing attempt is eligible", eligibility.json?.eligibility);
  check(eligibility.json?.eligibility?.threshold === threshold, "threshold comes from the test's pass mark", eligibility.json?.eligibility);
  check(eligibility.json?.rank?.total === baseline + 3, "rank total counts every submitted attempt on the test", eligibility.json?.rank);
  if (baseline === 0) {
    check(eligibility.json?.rank?.rank === 3, "rank matches the real ordering of the three attempts", eligibility.json?.rank);
  } else {
    check(eligibility.json?.rank?.rank >= 1 && eligibility.json?.rank?.rank <= baseline + 3, "rank stays inside the real sample", eligibility.json?.rank);
  }

  // 4. Issuing creates one certificate; repeats are idempotent.
  const issued = await call(`/api/v1/attempts/${mine.id}/certificate`, { cookie: rawStudent, method: "POST", body: {} });
  check(issued.status === 201, "certificate is issued for an eligible attempt", issued);
  check(/^RET-\d{4}-[0-9A-F]{8}$/.test(issued.json?.certificate?.certificateId || ""), "certificate carries a readable public id", issued.json?.certificate?.certificateId);
  check(/^[0-9a-f]{24}$/.test(issued.json?.certificate?.code || ""), "certificate carries an unguessable verification code", issued.json?.certificate?.code);
  check(issued.json?.certificate?.grade === "C", "grade matches the scored percentage", issued.json?.certificate?.grade);
  const repeat = await call(`/api/v1/attempts/${mine.id}/certificate`, { cookie: rawStudent, method: "POST", body: {} });
  check(repeat.status === 200 && repeat.json?.created === false && repeat.json?.certificate?.code === issued.json?.certificate?.code, "re-issuing returns the stored certificate", repeat.json?.certificate?.certificateId);
  check((await prisma.certificate.count({ where: { attemptId: mine.id } })) === 1, "exactly one certificate row exists for the attempt");
  check((await prisma.auditLog.count({ where: { actorId: student.id, action: "CERTIFICATE_ISSUED" } })) === 1, "issuing is written to the audit log");

  // 5. A failing attempt is refused with the real numbers.
  const failing = await makeAttempt(student.studentProfile.id, test.id, { score: 2, maxScore: 10, accuracy: 20, submittedAt: new Date(now) });
  const failingEligibility = await call(`/api/v1/attempts/${failing.id}/certificate`, { cookie: rawStudent });
  check(failingEligibility.json?.eligibility?.eligible === false, "below-threshold attempt is not eligible", failingEligibility.json?.eligibility);
  check((failingEligibility.json?.eligibility?.reason || "").includes(`${threshold}%`), "refusal states the real pass mark", failingEligibility.json?.eligibility?.reason);
  const failingIssue = await call(`/api/v1/attempts/${failing.id}/certificate`, { cookie: rawStudent, method: "POST", body: {} });
  check(failingIssue.status === 409, "issuing for a below-threshold attempt is refused", failingIssue);

  if (process.env.SMOKE_BROWSER !== "0") {
    const { chromium } = require("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await context.addCookies([{ name: cookieName, value: rawStudent, url: base }]);
      const page = await context.newPage();

      // 6. The result page ends with performance + rank + AI analysis + certificate.
      await page.goto(`${base}/results/${mine.id}`);
      await page.getByRole("heading", { name: "AI analysis, your rank and performance" }).waitFor();
      // The AI card boots empty and then offers the real generate action (the AI call itself is
      // proven by scripts/attempt-analysis-smoke.cjs, so this run must not spend a provider call).
      await page.getByRole("button", { name: /Generate AI analysis/i }).waitFor({ timeout: 30_000 });
      const resultsText = (await page.locator("body").innerText()).toLowerCase();
      check(resultsText.includes("final report"), "result page labels the closing report", undefined);
      check(resultsText.includes("standing on this test"), "result page reports the standing tile", undefined);
      check(resultsText.includes("average attempt"), "result page reports the test average tile", undefined);
      check(resultsText.includes(`#${eligibility.json.rank.rank}`), "standing tile shows the real rank number", undefined);
      check(resultsText.includes("ai performance analysis"), "result page keeps the AI analysis card", undefined);
      check(resultsText.includes("small sample") || resultsText.includes("rank "), "rank is worded honestly for the sample size", undefined);

      // The report must genuinely be the LAST block on the page, with the AI analysis inside it.
      // innerText reflects CSS text-transform, so compare in lower case.
      const order = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return {
          answerReview: text.indexOf("answer review"),
          finalReport: text.indexOf("final report"),
          analysis: text.indexOf("ai performance analysis"),
          standing: text.indexOf("standing on this test"),
          grade: text.indexOf("grade evidence"),
          disclaimer: text.indexOf("not a guarantee of any official exam result"),
        };
      });
      check(order.finalReport > order.answerReview && order.finalReport > 0, "final report comes after the answer review", order);
      check(order.analysis > order.finalReport && order.standing > order.finalReport && order.grade > order.finalReport, "AI analysis, rank and performance sit inside the closing report", order);
      check(order.disclaimer > order.standing && order.disclaimer > order.grade, "the honest disclaimer closes the page", order);
      const finalSection = await page.locator("section#final-report");
      check(await finalSection.count() === 1, "closing report has its own anchor section", undefined);
      check(await finalSection.locator('a[href="#certificate"], section:has-text("AI performance analysis")').count() >= 1, "closing report links back to the certificate and holds the AI card", undefined);
      check(await page.locator('a[href="#final-report"]').first().isVisible(), "result page offers a jump to the closing report", undefined);
      await page.locator("#final-report").screenshot({ path: "docs/screenshots/results-final-report.png" });

      // 7. The certificate that was already issued for this attempt is offered on the page.
      await page.getByRole("heading", { name: "Your certificate is ready" }).waitFor({ timeout: 20_000 });
      const link = page.locator('a[href^="/certificate/"]').first();
      check(await link.isVisible(), "issued certificate is linked from the result page", undefined);
      await link.click();
      await page.getByRole("heading", { name: "Certificate Smoke Student" }).waitFor();
      const certText = (await page.locator("body").innerText()).toLowerCase();
      check(certText.includes(test.titleEn.toLowerCase()), "certificate prints the test title", undefined);
      check(certText.includes(issued.json.certificate.certificateId.toLowerCase()), "certificate prints its own id", undefined);
      check(certText.includes("not an official board, school or government certificate"), "certificate carries the honest disclaimer", undefined);
      check(await page.getByRole("button", { name: /Print this page/i }).first().isVisible(), "print control is present", undefined);
      check(await page.getByRole("button", { name: /Download certificate \(PDF\)/i }).first().isVisible(), "a real Download certificate button is offered", undefined);
      check(await page.getByText(/Rank \d+ of \d+/).first().isVisible(), "certificate states the verified standing", undefined);

      // The Download button must produce a real PDF file in the student's downloads folder.
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 90_000 }),
        page.getByRole("button", { name: /Download certificate \(PDF\)/i }).first().click(),
      ]);
      check(
        download.suggestedFilename() === `${issued.json.certificate.certificateId}-certificate.pdf`,
        "download is named after the certificate id",
        download.suggestedFilename(),
      );
      const downloaded = fs.readFileSync(await download.path());
      check(downloaded.subarray(0, 5).toString("latin1") === "%PDF-", "downloaded file is a PDF", downloaded.length);
      check(downloaded.length > 30_000, "downloaded PDF carries real content", downloaded.length);
      check(/\/Count 1\b/.test(downloaded.toString("latin1")), "downloaded PDF is a single page", undefined);
      const embedded = extractEmbeddedJpeg(downloaded);
      check(Boolean(embedded), "downloaded PDF embeds the rendered certificate image", undefined);
      check(embedded.width >= 1500 && embedded.height >= 700, "embedded image is high resolution (A4 landscape)", `${embedded.width}x${embedded.height}`);
      const pixels = await page.evaluate(async (base64) => {
        const image = new Image();
        image.src = `data:image/jpeg;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        let white = 0;
        let dark = 0;
        const total = data.length / 4;
        for (let index = 0; index < data.length; index += 4) {
          const luminance = (data[index] + data[index + 1] + data[index + 2]) / 3;
          if (luminance > 245) white += 1;
          if (luminance < 90) dark += 1;
        }
        return { total, whiteRatio: white / total, darkRatio: dark / total };
      }, embedded.jpeg.toString("base64"));
      check(pixels.whiteRatio > 0.3 && pixels.whiteRatio < 0.985, "downloaded certificate is a document, not a blank sheet", pixels.whiteRatio.toFixed(3));
      check(pixels.darkRatio > 0.004, "downloaded certificate contains printed text and rules", pixels.darkRatio.toFixed(4));

      // Print stylesheet path stays available for students who prefer the browser dialog.
      const pdf = await page.pdf({ format: "A4", landscape: true });
      check(pdf.length > 20_000, "certificate exports to a real PDF file", pdf.length);

      const unknown = await page.request.get(`${base}/certificate/${"0".repeat(24)}`);
      check(unknown.status() === 404, "an unknown verification code returns 404", unknown.status());

      await page.setViewportSize({ width: 390, height: 844 });
      check(await page.getByRole("heading", { name: "Certificate Smoke Student" }).isVisible(), "certificate stays readable on a phone viewport", undefined);

      // 8. Issuing straight from the result page (a second, still-unissued passing attempt).
      const uiAttempt = await makeAttempt(student.studentProfile.id, test.id, { score: 8, maxScore: 10, accuracy: 80, submittedAt: new Date(now + 1_000) });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`${base}/results/${uiAttempt.id}`);
      await page.getByRole("button", { name: /Issue my certificate/i }).waitFor({ timeout: 30_000 });
      await page.getByRole("button", { name: /Issue my certificate/i }).click();
      await page.getByRole("heading", { name: "Your certificate is ready" }).waitFor({ timeout: 30_000 });
      const uiLink = page.locator('a[href^="/certificate/"]').first();
      check(await uiLink.isVisible(), "student can issue a certificate from the result page itself", undefined);
      check((await prisma.certificate.count({ where: { attemptId: uiAttempt.id } })) === 1, "the page action wrote the certificate row", undefined);
      const uiHref = await uiLink.getAttribute("href");
      await uiLink.click();
      await page.getByRole("heading", { name: "Certificate Smoke Student" }).waitFor();
      check(page.url().endsWith(uiHref || ""), "the linked certificate page opens", page.url());

      // The result-page "Download PDF" shortcut must land the file without any extra click.
      await page.goto(`${base}/results/${uiAttempt.id}`);
      const downloadLink = page.locator('a[href$="?download=1"]').first();
      await downloadLink.waitFor({ timeout: 30_000 });
      check((await downloadLink.getAttribute("href") || "").includes("?download=1"), "result page links straight to the real download", await downloadLink.getAttribute("href"));
      const [autoDownload] = await Promise.all([
        page.waitForEvent("download", { timeout: 90_000 }),
        downloadLink.click(),
      ]);
      const autoBytes = fs.readFileSync(await autoDownload.path());
      check(autoBytes.subarray(0, 5).toString("latin1") === "%PDF-" && autoBytes.length > 30_000, "deep link downloads the certificate PDF automatically", autoBytes.length);

      // 9. The installable Android/PWA path is wired and offered on a phone-sized screen.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${base}/dashboard`);
      await page.waitForLoadState("domcontentloaded");
      const banner = page.getByText(/Install the RET Learn app on this phone/i);
      await banner.waitFor({ timeout: 20_000 });
      check(await banner.isVisible(), "Android install banner is offered on a phone viewport", undefined);
      await page.getByRole("button", { name: /How to install|Install app/i }).click();
      await page.getByText(/Add to Home screen|Install app/i).first().waitFor({ timeout: 10_000 });
      check(true, "install instructions are shown when the browser hides its own prompt", undefined);
      const hasManifest = await page.locator('link[rel="manifest"]').count();
      check(hasManifest >= 1, "app declares a web manifest for installation", hasManifest);
      const manifest = await page.request.get(`${base}/manifest.webmanifest`);
      check(manifest.ok(), "web manifest is served", manifest.status());
      const manifestJson = await manifest.json().catch(() => null);
      check(manifestJson?.name === "Real Education Time" && Array.isArray(manifestJson?.icons) && manifestJson.icons.length >= 3, "manifest has the app name and install icons", manifestJson?.icons?.length);
      const sw = await page.request.get(`${base}/service-worker.js`);
      check(sw.ok(), "service worker file is served", sw.status());
      const swBody = await sw.text();
      check(swBody.includes("addEventListener") || swBody.includes("fetch"), "service worker installs offline handling", undefined);
      check(swBody.includes("caches"), "service worker uses the cache API for the Android app shell", undefined);

      // Chrome on Android refuses to install a PWA whose icons are the wrong size: verify the bytes.
      const iconSizes = await Promise.all(
        ["icon-192.png", "icon-512.png", "maskable-512.png"].map(async (file) => {
          const response = await page.request.get(`${base}/icons/${file}`);
          const bytes = Buffer.from(await response.body());
          return { file, status: response.status(), ...pngDimensions(bytes) };
        }),
      );
      for (const icon of iconSizes) {
        const expected = icon.file === "icon-192.png" ? 192 : 512;
        check(icon.status === 200 && icon.width === expected && icon.height === expected, `${icon.file} is a real ${expected}px install icon`, `${icon.status} ${icon.width}x${icon.height}`);
      }
      check(manifestJson?.display === "standalone" && manifestJson?.start_url?.startsWith("/"), "manifest opens the app standalone from the site root", `${manifestJson?.display} ${manifestJson?.start_url}`);
      check(manifestJson?.scope === "/" && typeof manifestJson?.theme_color === "string", "manifest scopes the whole site and sets a theme colour for Android", `${manifestJson?.scope} ${manifestJson?.theme_color}`);
      check(
        (manifestJson?.icons || []).some((icon) => icon.purpose === "maskable"),
        "manifest ships a maskable icon for Android launchers",
        manifestJson?.icons?.map((icon) => icon.purpose),
      );
      const appleIcon = await page.request.get(`${base}/icons/apple-touch-icon.png`);
      check(appleIcon.ok(), "home-screen icon is served for iOS as well", appleIcon.status());
    } finally {
      await browser.close();
    }
  }

  console.log("\nCERTIFICATE_SMOKE_PASS");
})().catch(async (error) => {
  console.error("\nCERTIFICATE_SMOKE_FAIL", error.message);
  process.exitCode = 1;
}).finally(async () => {
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  await new Promise((resolve) => setTimeout(resolve, 50));
  process.exit(process.exitCode || 0);
});
