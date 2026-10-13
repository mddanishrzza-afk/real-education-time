#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS smoke script, run directly by Node */
/**
 * Real-interaction smoke test for the three reported regressions:
 *   1. dark-mode toggle, its persistence and its behaviour when the app is
 *      embedded in an iframe (the Live Preview case),
 *   2. password -> email OTP login driven through the actual UI,
 *   3. the YouTube / Facebook / Instagram links actually opening their pages.
 *
 * Every assertion is derived from real clicks, typed input and live DOM/URL
 * state - never from server-rendered HTML. External social hosts are
 * intercepted and answered with a local stub so the run stays offline and
 * deterministic; the navigation itself is still the real browser navigation to
 * the real href.
 */
const { chromium } = require("playwright");

const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const email = "student@realeducationtime.com";
const password = "Learn@123";

// Give the run its own development rate-limit bucket so repeated runs never
// inherit a 429 from login / verify-otp budgets.
const runSalt = 1 + Math.floor(Math.random() * 254);
const clientIp = `10.${runSalt}.77.5`;

const social = [
  { label: "YouTube", host: "https://www.youtube.com", href: "https://www.youtube.com/@Realeducationtime" },
  { label: "Facebook", host: "https://www.facebook.com", href: "https://www.facebook.com/RealEducationTime/" },
  { label: "Instagram", host: "https://www.instagram.com", href: "https://www.instagram.com/realeducationtime/" },
];

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}
function section(name) {
  console.log(`\n=== ${name} ===`);
}

/** Answer every social-host request with a local stub page. */
async function stubSocialHosts(context) {
  for (const { host } of social) {
    await context.route(`${host}/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><html><head><title>social-stub</title></head><body>stub</body></html>",
      }),
    );
  }
}

/** Attach console/page-error collection; returns the collected arrays. */
function watchErrors(page) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  return { consoleErrors, pageErrors };
}

function reportErrors(label, { consoleErrors, pageErrors }) {
  const csp = consoleErrors.filter((text) => /content security policy/i.test(text));
  const hydration = consoleErrors.filter((text) => /hydrat/i.test(text));
  check(`${label}: no uncaught page errors`, pageErrors.length === 0, pageErrors[0] || "");
  check(`${label}: no CSP violations`, csp.length === 0, csp[0] || "");
  check(`${label}: no hydration errors`, hydration.length === 0, hydration[0] || "");
}

/** Find a child frame pointing at the app (frame may attach late). */
async function waitForAppFrame(page, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const frame = page.frames().find((candidate) => candidate.url().startsWith(base));
    if (frame) return frame;
    await page.waitForTimeout(200);
  }
  return null;
}

/** Read the theme toggle state from a live frame/document. */
function themeState(target) {
  return target.evaluate(() => ({
    dark: document.documentElement.classList.contains("dark"),
    stored: (() => {
      try {
        return localStorage.getItem("ret-theme");
      } catch {
        return "unavailable";
      }
    })(),
  }));
}

async function sectionDarkMode(context) {
  section("1. Dark mode (top-level page)");
  const page = await context.newPage();
  const errors = watchErrors(page);

  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  const toggle = page.locator('button[aria-label="Use dark theme"], button[aria-label="Use light theme"]').first();
  check("toggle button is visible", await toggle.isVisible());

  const initial = await themeState(page);
  check("starts in light mode", initial.dark === false, `dark=${initial.dark} stored=${initial.stored}`);

  await toggle.click();
  let after = await themeState(page);
  const pressed = await page.locator('button[aria-label="Use light theme"]').first().getAttribute("aria-pressed");
  check("click flips html.dark on", after.dark === true, `dark=${after.dark}`);
  check("choice persisted to localStorage", after.stored === "dark", `stored=${after.stored}`);
  check("aria-pressed reflects state", pressed === "true", `aria-pressed=${pressed}`);

  await page.reload({ waitUntil: "domcontentloaded" });
  const reloaded = await themeState(page);
  check("dark survives a reload (no flash of light)", reloaded.dark === true, `dark=${reloaded.dark}`);

  await page.locator('button[aria-label="Use light theme"]').first().click();
  await page.reload({ waitUntil: "domcontentloaded" });
  const backToLight = await themeState(page);
  check("toggling back to light persists", backToLight.dark === false, `dark=${backToLight.dark} stored=${backToLight.stored}`);

  reportErrors("dark mode", errors);
  return page;
}

async function sectionSocialLinks(context, page) {
  section("2. Social links (top-level page)");
  const errors = watchErrors(page);
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });

  for (const { label, host, href } of social) {
    const link = page.getByLabel(`Open Real Education Time on ${label}`).first();
    check(`${label}: link rendered`, (await link.count()) > 0);
    const domHref = await link.getAttribute("href");
    check(`${label}: href points at the real page`, domHref === href, domHref || "missing");

    const popupPromise = context.waitForEvent("page", { timeout: 10000 }).catch(() => null);
    await link.click();
    const popup = await popupPromise;
    if (popup) {
      const reached = await popup
        .waitForURL(`${host}/**`, { timeout: 10000 })
        .then(() => true)
        .catch(() => false);
      check(`${label}: opens external page in a new tab`, reached, popup.url());
      await popup.close();
    } else {
      check(`${label}: opens external page`, page.url().startsWith(host), page.url());
      await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
    }
  }
  reportErrors("social links", errors);
}

/**
 * Open the login route and wait until the form is really interactive. The dev
 * server compiles /login on its first hit, so "domcontentloaded" can fire while
 * React has not hydrated yet; clicking that early makes the browser fall back
 * to a native form submit the API never sees. Waiting for "load" with a
 * generous timeout, plus click retries below, removes the cold-compile race.
 */
async function openLoginPage(page) {
  await page.goto(`${base}/login`, { waitUntil: "load", timeout: 90000 });
  await page.getByRole("button", { name: "Continue to OTP" }).waitFor({ state: "visible", timeout: 90000 });
}

async function sectionLogin(context) {
  section("3. Login: password -> email OTP (real UI)");
  const page = await context.newPage();
  const errors = watchErrors(page);

  const otpPanel = page.locator('[data-testid="development-login-otp"]').first();
  let reached = false;
  for (let attempt = 1; attempt <= 3 && !reached; attempt += 1) {
    await openLoginPage(page);
    await page.fill("#login-email", email);
    await page.fill("#login-password", password);
    await page.getByRole("button", { name: "Continue to OTP" }).click();
    reached = await otpPanel
      .waitFor({ state: "visible", timeout: attempt === 1 ? 30000 : 45000 })
      .then(() => true)
      .catch(() => false);
    if (!reached) {
      const alert = await page.locator('[role="alert"]').first().textContent().catch(() => null);
      console.log(`  · attempt ${attempt}: OTP step not reached${alert ? ` (alert: ${alert.trim()})` : ""}; reloading and retrying`);
      await page.waitForTimeout(1500);
    }
  }
  check("OTP step reached after 'Continue to OTP'", reached, "panel appeared within the retry budget");
  if (!reached) {
    reportErrors("login", errors);
    return page;
  }

  const code = (await otpPanel.textContent())?.trim() || "";
  check("development OTP is a 6-digit code", /^\d{6}$/.test(code), `code=${code.replace(/\d/g, "#")}`);

  await page.fill("#login-otp", code);
  const verify = page.getByRole("button", { name: "Verify OTP and sign in" });
  check("verify button enabled once 6 digits entered", await verify.isEnabled());
  await verify.click();

  const landed = await page
    .waitForURL(/\/(onboarding|dashboard)(\/|$)/, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  check("reaches an authenticated page", landed, page.url());

  const cookies = await context.cookies(base);
  const session = cookies.find((cookie) => cookie.name === "ret_session");
  check("session cookie issued", Boolean(session), session ? `sameSite=${session.sameSite} secure=${session.secure}` : "missing");

  const dashboard = await page.goto(`${base}/dashboard`, { waitUntil: "domcontentloaded" });
  check("dashboard loads with the new session", dashboard?.status() === 200, `status=${dashboard?.status()}`);

  reportErrors("login", errors);
  return page;
}

async function sectionEmbedded(context, sandboxAttribute) {
  const label = sandboxAttribute ? `embed sandbox="${sandboxAttribute}"` : "embed (no sandbox)";
  section(`${sandboxAttribute ? "5" : "4"}. Embedded preview: ${label}`);

  const host = await context.newPage();
  const errors = watchErrors(host);
  const iframe = `<iframe id="app" ${sandboxAttribute ? `sandbox="${sandboxAttribute}"` : ""} src="${base}/" style="width:1280px;height:900px;border:0"></iframe>`;
  await host.setContent(`<!doctype html><html><body style="margin:0">${iframe}</body></html>`);

  const frame = await waitForAppFrame(host);
  if (!frame) {
    check("app frame attaches", false, "no frame with the app URL appeared");
    return { host, frame: null };
  }
  await frame.waitForLoadState("load").catch(() => {});
  const title = await frame.title().catch(() => "");
  check("app is allowed to render inside the iframe (no frame-ancestors block)", title === "Real Education Time", `title="${title}"`);

  const toggle = frame.locator('button[aria-label="Use dark theme"], button[aria-label="Use light theme"]').first();
  const toggleVisible = await toggle.isVisible().catch(() => false);
  check("theme toggle reachable inside the frame", toggleVisible);
  if (toggleVisible) {
    let state = await themeState(frame).catch(() => ({ dark: null, stored: "unavailable" }));
    // The frame can attach before React has hydrated; retry the click instead
    // of failing on a first, possibly pre-hydration, attempt.
    for (let attempt = 0; attempt < 3 && state.dark !== true; attempt += 1) {
      await toggle.click().catch(() => {});
      await frame.waitForTimeout(600);
      state = await themeState(frame).catch(() => ({ dark: null, stored: "unavailable" }));
    }
    check("dark mode works inside the frame", state.dark === true, `dark=${state.dark} stored=${state.stored}`);
  }

  reportErrors(label, errors);
  return { host, frame };
}

async function sectionEmbeddedSocial(context, host, frame) {
  section("6. Embedded preview: social link fallback");
  if (!frame) {
    check("social fallback", false, "no app frame available");
    return;
  }
  const { label, host: socialHost } = social[0];
  const link = frame.getByLabel(`Open Real Education Time on ${label}`).first();
  const popupPromise = context.waitForEvent("page", { timeout: 8000 }).catch(() => null);
  await link.click({ timeout: 10000 }).catch(() => {});
  const popup = await popupPromise;
  if (popup) {
    const reached = await popup
      .waitForURL(`${socialHost}/**`, { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    check(`framed click opens ${label}`, reached, popup.url());
    await popup.close();
    return;
  }
  // Sandboxed embeds may block popups; the component then navigates the frame
  // itself. Accept either the frame or the top page ending up on the target.
  await host.waitForTimeout(2500);
  const navigated = host.frames().some((candidate) => candidate.url().startsWith(socialHost)) || host.url().startsWith(socialHost);
  check(`framed click falls back to in-frame navigation for ${label}`, navigated, host.frames().map((f) => f.url()).join(" | "));
}

async function sectionEmbeddedLogin(context) {
  section("7. Embedded preview: login through the frame");
  const host = await context.newPage();
  const errors = watchErrors(host);
  await host.setContent(
    `<!doctype html><html><body style="margin:0"><iframe id="app" sandbox="allow-scripts allow-same-origin allow-forms" src="${base}/login" style="width:1280px;height:900px;border:0"></iframe></body></html>`,
  );
  const frame = await waitForAppFrame(host);
  if (!frame) {
    check("login frame attaches", false, "no app frame appeared");
    return;
  }
  await frame.waitForLoadState("load").catch(() => {});

  const otp = frame.locator('[data-testid="development-login-otp"]').first();
  let panelShown = false;
  for (let attempt = 1; attempt <= 3 && !panelShown; attempt += 1) {
    await frame.fill("#login-email", email).catch(() => {});
    await frame.fill("#login-password", password).catch(() => {});
    await frame.getByRole("button", { name: "Continue to OTP" }).click({ timeout: 10000 }).catch(() => {});
    panelShown = await otp
      .waitFor({ state: "visible", timeout: attempt === 1 ? 20000 : 30000 })
      .then(() => true)
      .catch(() => false);
    if (!panelShown) await frame.waitForTimeout(1000);
  }
  check("login POST accepted from a sandboxed frame", panelShown, panelShown ? "" : "OTP step never appeared");

  if (panelShown) {
    const code = (await otp.textContent())?.trim() || "";
    await frame.fill("#login-otp", code).catch(() => {});
    await frame.getByRole("button", { name: "Verify OTP and sign in" }).click({ timeout: 10000 }).catch(() => {});
    const ok = await frame
      .waitForURL(/\/(onboarding|dashboard)(\/|$)/, { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    check("session established from a sandboxed frame", ok, frame.url());
    const session = (await context.cookies(base)).find((cookie) => cookie.name === "ret_session");
    check("session cookie visible to the frame flow", Boolean(session), session ? `sameSite=${session.sameSite}` : "missing");
  }
  reportErrors("embedded login", errors);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.setExtraHTTPHeaders({ "x-forwarded-for": clientIp });
  await stubSocialHosts(context);

  try {
    const page = await sectionDarkMode(context);
    await sectionSocialLinks(context, page);
    await sectionLogin(context);

    const relaxed = await sectionEmbedded(context, "");
    await sectionEmbeddedSocial(context, relaxed.host, relaxed.frame);
    // A bare "allow-scripts" frame has an opaque origin: cookies are
    // unreadable, so no hydrated Next.js app can run in it (dev assets also
    // fail CORS there). Real preview frames are same-origin sandboxed, so the
    // stricter-but-realistic combination below is what we exercise.
    await sectionEmbedded(context, "allow-scripts allow-same-origin allow-forms");
    await sectionEmbeddedLogin(context);
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
