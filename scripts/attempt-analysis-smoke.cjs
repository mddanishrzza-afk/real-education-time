/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * End-to-end smoke for the AI attempt-analysis feature.
 *
 * Exercises the real HTTP stack (login -> OTP -> access unlock -> attempt ->
 * submit -> results page -> POST/GET analysis) and prints a compact evidence
 * block. It intentionally talks to the running dev server only; it never runs
 * against production.
 *
 * Usage: npm run test:e2e:analysis   (dev server must already be running)
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const email = process.env.SMOKE_EMAIL || "student@realeducationtime.com";
const password = process.env.SMOKE_PASSWORD || "Learn@123";
const testSlug = "class-9-foundation-diagnostic";

const runSalt = 1 + Math.floor(Math.random() * 254);
const clientIp = `10.${runSalt}.77.5`;

let cookie = "";

function headers(extra = {}) {
  return {
    "content-type": "application/json",
    origin: base,
    "x-forwarded-for": clientIp,
    ...(cookie ? { cookie } : {}),
    ...extra,
  };
}

async function call(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    const match = /ret_session=[^;]+/.exec(setCookie);
    if (match) cookie = match[0];
  }
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-JSON (HTML page) responses are returned as text
  }
  return { status: response.status, json, text };
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function main() {
  const steps = [];
  const record = (name, detail) => {
    steps.push({ name, detail });
    console.log(`  ok  ${name}${detail ? ` — ${detail}` : ""}`);
  };

  // 1. Login + OTP
  const login = await call("POST", "/api/v1/auth/login", { email, password, captchaToken: "" });
  assert(login.status === 202 && login.json?.challengeId, `login expected 202/challengeId, got ${login.status}`);
  assert(/^\d{6}$/.test(String(login.json.developmentOtp || "")), "development OTP was not exposed in safe local mode");
  record("POST /auth/login", `202 challenge ${login.json.maskedEmail}`);

  const verify = await call("POST", "/api/v1/auth/login/verify-otp", {
    challengeId: login.json.challengeId,
    code: login.json.developmentOtp,
  });
  assert(verify.status === 200 && cookie, `verify-otp expected 200 + session cookie, got ${verify.status}`);
  record("POST /auth/login/verify-otp", "200 session established");

  // 2. Access: unlock SCHOOL_6_12 through the development payment path (real app flow).
  const accessBefore = await call("GET", "/api/v1/access");
  const unlocked = Boolean(accessBefore.json?.access?.entitlements?.length);
  if (!unlocked) {
    const order = await call("POST", "/api/v1/payments/orders", { planCode: "SCHOOL_6_12_FULL" });
    assert(order.status === 201 || order.status === 200, `create order failed: ${order.status} ${order.text.slice(0, 200)}`);
    const confirm = await call("POST", "/api/v1/payments/local-confirm", { internalOrderId: order.json.order.id });
    assert(confirm.status === 200, `local-confirm failed: ${confirm.status} ${confirm.text.slice(0, 200)}`);
    record("development payment unlock", `order ${order.json.order.receipt} → entitlement granted`);
  } else {
    record("development payment unlock", "entitlement already active");
  }

  // 3. Start a fresh attempt.
  const test = await prisma.test.findFirst({ where: { slug: testSlug }, select: { id: true, titleEn: true } });
  assert(test, `seeded test ${testSlug} is missing`);
  const start = await call("POST", "/api/v1/attempts", { testId: test.id });
  assert(start.status === 201 || start.status === 200, `start attempt failed: ${start.status} ${start.text.slice(0, 200)}`);
  const attemptId = start.json.attempt.id;
  record("POST /attempts", `${test.titleEn} → ${attemptId}`);

  // 4. Submit a deliberately uneven answer set so the analysis has real signal:
  //    a fast wrong answer on a hard question, a slow wrong answer, and a skip.
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      test: {
        include: {
          questions: {
            orderBy: { sequence: "asc" },
            include: { question: { include: { options: { orderBy: { sequence: "asc" } } } } },
          },
        },
      },
    },
  });
  assert(attempt, "created attempt could not be reloaded");

  const script = [
    { pick: "correct", seconds: 40 },
    { pick: "correct", seconds: 55 },
    { pick: "wrong", seconds: 9 }, // hard question, guessed fast
    { pick: "correct", seconds: 20 },
    { pick: "wrong", seconds: 35 }, // slow wrong answer
    { pick: "correct", seconds: 18 },
    { pick: "wrong", seconds: 8 }, // guessed fast
    { pick: "correct", seconds: 22 },
    { pick: "correct", seconds: 44 },
    { pick: "skip", seconds: 60 },
  ];

  const answers = attempt.test.questions.map((item, index) => {
    const plan = script[index] || { pick: "correct", seconds: 30 };
    const options = item.question.options;
    const correct = options.find((option) => option.isCorrect) ?? options[0];
    const wrong = options.find((option) => !option.isCorrect) ?? options[0];
    const selected = plan.pick === "skip" ? null : plan.pick === "correct" ? correct : wrong;
    return { questionId: item.questionId, selectedOptionId: selected?.id ?? null, responseSeconds: plan.seconds };
  });

  const submit = await call("POST", `/api/v1/attempts/${attemptId}/submit`, { answers });
  assert(submit.status === 200, `submit failed: ${submit.status} ${submit.text.slice(0, 300)}`);
  const summary = submit.json.attempt;
  record("POST /attempts/:id/submit", `score ${summary.score}/${summary.maxScore}, accuracy ${summary.accuracy}`);

  // 5. Results page must render the analysis card mount point.
  const resultsPage = await fetch(`${base}/results/${attemptId}`, { headers: headers(), redirect: "manual" });
  const html = await resultsPage.text();
  assert(resultsPage.status === 200, `results page returned ${resultsPage.status}`);
  assert(/Instant scoring analysis/i.test(html), "results page is missing the analysis card section");
  record("GET /results/:id", "200 with analysis card section rendered");

  // 6. Generate the analysis over the API (first call = fresh generation).
  const generated = await call("POST", `/api/v1/attempts/${attemptId}/analysis`);
  assert(generated.status === 200 || generated.status === 201, `analysis POST failed: ${generated.status} ${generated.text.slice(0, 400)}`);
  const response = generated.json.analysis;
  const analysis = response?.analysis;
  assert(analysis?.headline && analysis?.summary, "analysis payload is missing headline/summary");
  assert(Array.isArray(analysis.nextSteps) && analysis.nextSteps.length >= 2, "analysis is missing next steps");
  assert(Array.isArray(analysis.studyPlan) && analysis.studyPlan.length >= 2, "analysis is missing a study plan");
  assert(response.metrics?.accuracy !== undefined, "analysis is missing computed metrics");
  assert(response.metrics.observations.length > 0, "analysis is missing deterministic observations");
  record(
    `POST /attempts/:id/analysis (${generated.status === 201 ? "fresh generation" : "cached"})`,
    `provider ${response.provider} / ${response.model}, confidence ${analysis.confidence}`,
  );
  record("analysis payload", `headline: ${analysis.headline}`);

  // 7. Second call must be served from the cached row without burning AI credits.
  const cached = await call("GET", `/api/v1/attempts/${attemptId}/analysis`);
  const cachedResponse = cached.json?.analysis;
  assert(cached?.status === 200 && cachedResponse?.analysis?.headline, `cached GET failed: ${cached.status} ${cached.text.slice(0, 200)}`);
  assert(cachedResponse.cached === true, "stored analysis was not served from cache");
  record("GET /attempts/:id/analysis", `200 cached=${cachedResponse.cached}`);

  // 8. Database + audit evidence.
  const stored = await prisma.attemptAnalysis.findFirst({ where: { attemptId } });
  assert(stored, "no AttemptAnalysis row was persisted");
  const audit = await prisma.auditLog.findFirst({
    where: { action: "AI_ATTEMPT_ANALYSIS_CREATED", resourceId: attemptId },
    orderBy: { createdAt: "desc" },
  });
  assert(audit, "no AI_ATTEMPT_ANALYSIS_CREATED audit entry was written");
  record("database", `AttemptAnalysis row + audit entry ${audit.id.slice(-6)}`);

  console.log("\nEvidence summary");
  console.log(JSON.stringify({ attemptId, provider: response.provider, model: response.model, confidence: analysis.confidence, generatedFresh: generated.status === 201, observations: response.metrics.observations, topics: response.metrics.topics.map((t2) => `${t2.subject}/${t2.topicTitle}: ${Math.round(t2.accuracy * 100)}%`), steps: steps.length }, null, 2));
  console.log("\nATTEMPT ANALYSIS SMOKE: PASS");
}

main()
  .catch((error) => {
    console.error("\nATTEMPT ANALYSIS SMOKE: FAIL");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
