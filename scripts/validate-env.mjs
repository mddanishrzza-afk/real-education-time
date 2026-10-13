const required = [
  "DATABASE_URL",
  "DIRECT_URL",
  "APP_URL",
  "SESSION_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "TURNSTILE_SECRET_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "EMAIL_PROVIDER",
  "EMAIL_FROM",
  "RESEND_API_KEY",
  "CRON_SECRET",
];

// The automatic gateway is optional while merchant KYC is pending: without it
// checkout fails closed and only the manually reviewed UPI/QR flow is enabled.
const razorpayVariables = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"];
const warnings = [];

const missing = required.filter((name) => !process.env[name]?.trim());
const errors = [];
if (missing.length) errors.push(`Missing: ${missing.join(", ")}`);

for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
  const value = process.env[name];
  if (value && !/^postgres(ql)?:\/\//.test(value)) errors.push(`${name} must be a PostgreSQL URL`);
}

try {
  const appUrl = new URL(process.env.APP_URL || "invalid:");
  if (appUrl.protocol !== "https:") errors.push("APP_URL must use HTTPS");
  if (appUrl.pathname !== "/" || appUrl.search || appUrl.hash) errors.push("APP_URL must be an origin without a path, query, or fragment");
} catch {
  errors.push("APP_URL must be a valid absolute URL");
}

if (process.env.EMAIL_PROVIDER && process.env.EMAIL_PROVIDER !== "RESEND") {
  errors.push("EMAIL_PROVIDER must be RESEND for production");
}

// SESSION_SECRET signs login OTP challenges. Production refuses to start the login
// flow without it, so catch the problem at build time instead of at first sign-in.
if (process.env.SESSION_SECRET && (process.env.SESSION_SECRET || "").trim().length < 32) {
  errors.push("SESSION_SECRET must be at least 32 characters of random data");
}
const configuredRazorpay = razorpayVariables.filter((name) => process.env[name]?.trim());
const gatewayEnabled =
  (process.env.PAYMENT_PROVIDER || "").trim() === "RAZORPAY" || configuredRazorpay.length > 0;

if (process.env.PAYMENT_PROVIDER && process.env.PAYMENT_PROVIDER !== "RAZORPAY") {
  errors.push("PAYMENT_PROVIDER must be RAZORPAY when set");
}
if (configuredRazorpay.length > 0 && configuredRazorpay.length < razorpayVariables.length) {
  errors.push("Razorpay is partially configured: set all three RAZORPAY_* variables, or none for manual-UPI-only mode");
}
if (gatewayEnabled) {
  if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(process.env.RAZORPAY_KEY_ID || "")) {
    errors.push("RAZORPAY_KEY_ID has an invalid format");
  } else if (process.env.RAZORPAY_KEY_ID.startsWith("rzp_test_")) {
    errors.push("RAZORPAY_KEY_ID must be a live key for a production deployment: test keys would accept simulated payments and unlock real access");
  }
  if ((process.env.RAZORPAY_KEY_SECRET || "").length < 16) errors.push("RAZORPAY_KEY_SECRET is unexpectedly short");
  if ((process.env.RAZORPAY_WEBHOOK_SECRET || "").length < 16) errors.push("RAZORPAY_WEBHOOK_SECRET must be at least 16 characters");
} else {
  warnings.push("Automatic payments are off (no RAZORPAY_* variables): checkout fails closed and only the manually reviewed UPI/QR flow is available.");
}
if (process.env.ENABLE_DEMO_LOGIN === "true") errors.push("ENABLE_DEMO_LOGIN must not be true for a public production deployment");
if (process.env.SEED_DEMO_DATA === "true") errors.push("SEED_DEMO_DATA must not be true for a public production deployment");

const aiProvider = (process.env.AI_PROVIDER || "LOCAL_GROUNDED").toUpperCase();
if (!["LOCAL_GROUNDED", "MESH", "OPENAI_COMPATIBLE", "GEMINI"].includes(aiProvider)) {
  errors.push("AI_PROVIDER must be LOCAL_GROUNDED, MESH, OPENAI_COMPATIBLE, or GEMINI");
}
if (aiProvider !== "LOCAL_GROUNDED" && !process.env.AI_API_KEY?.trim()) {
  errors.push("AI_API_KEY is required when AI_PROVIDER is a cloud provider");
}

if (errors.length) {
  console.error("Production environment validation failed:\n- " + errors.join("\n- "));
  process.exit(1);
}
for (const warning of warnings) console.warn(`Warning: ${warning}`);
console.log("Production environment validation passed.");
