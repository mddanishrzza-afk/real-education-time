const requiredProductionVariables = [
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
] as const;

export function getProductionConfigErrors() {
  if (process.env.NODE_ENV !== "production") return [];
  const errors: string[] = [];
  for (const variable of requiredProductionVariables) {
    if (!process.env[variable]?.trim()) errors.push(`${variable} is missing`);
  }
  if (process.env.EMAIL_PROVIDER && process.env.EMAIL_PROVIDER !== "RESEND") errors.push("EMAIL_PROVIDER must be RESEND");
  if (process.env.ENABLE_DEMO_LOGIN === "true") errors.push("Demo login must be disabled");
  if (process.env.SEED_DEMO_DATA === "true") errors.push("Demo seeding must be disabled");
  try {
    if (new URL(process.env.APP_URL || "invalid:").protocol !== "https:") errors.push("APP_URL must use HTTPS");
  } catch {
    errors.push("APP_URL is invalid");
  }
  for (const variable of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const value = process.env[variable];
    if (value && !/^postgres(ql)?:\/\//.test(value)) errors.push(`${variable} must use PostgreSQL`);
  }
  return errors;
}
