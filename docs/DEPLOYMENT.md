# Vercel Public-MVP deployment runbook

## 1. External services

Provision these before creating the production deployment:

1. **Managed PostgreSQL** with a pooled runtime URL and a direct migration URL. Enable TLS, PITR/backups, and provider alerts.
2. **Upstash-compatible Redis REST** database in a suitable region.
3. **Resend** (or a future adapter) with a verified sending domain. Configure SPF, DKIM, and DMARC.
4. **Cloudflare Turnstile** widget restricted to the production domain and any intentional preview domains.
5. **Vercel** project and production domain.
6. A Vercel log drain or monitoring integration with alerts for 5xx rate, readiness failures, email failures, Redis failures, latency, and AI-provider spend.

Never put real values in source, committed `.env` files, tickets, or chat transcripts.

## 2. Production environment

Configure all variables from `.env.example` in Vercel Production. Important rules:

- `DATABASE_URL` is the pooled PostgreSQL runtime URL.
- `DIRECT_URL` is the direct PostgreSQL migration URL.
- `APP_URL` is exactly the HTTPS production origin with no trailing path.
- `EMAIL_PROVIDER=RESEND` and `EMAIL_FROM` uses the verified domain.
- Both Turnstile keys belong to the same production widget.
- Generate `CRON_SECRET` with at least 32 random bytes.
- Keep `ENABLE_DEMO_LOGIN=false` and `SEED_DEMO_DATA=false`.
- Scope secrets to Production. Use separate credentials for Preview/Staging.

Validate a local/exported production environment without printing values:

```bash
npm run env:validate:production
```

## 3. Database baseline

`prisma/migrations/20260816000000_public_mvp_baseline` is a full baseline for a **new, empty PostgreSQL database**. Do not apply it over an independently created schema. If importing an existing database, stop and create a reviewed Prisma migration-baseline procedure first.

Test deployment against disposable PostgreSQL:

```bash
npm ci
npm run db:generate:production
npm run db:migrate:deploy
npm run db:seed:production
npx prisma migrate status --schema prisma/schema.prisma
```

`db:seed:production` creates/updates published catalog, policy, achievement, and educational content only. It does not create the known demo learner. Demo data requires the explicit `npm run db:seed:demo` command and must never run against public production.

## 4. Vercel build and release

`vercel.json` selects `npm run vercel-build`, which:

1. validates production environment variables;
2. generates the PostgreSQL Prisma Client;
3. runs committed migrations with `prisma migrate deploy`;
4. builds Next.js.

Avoid concurrent production builds while migrations run. Require the CI checks before promotion. The initial launch sequence should be:

1. Deploy to a staging Vercel project using staging-only PostgreSQL, Redis, Resend, and Turnstile credentials.
2. Run the smoke checklist below.
3. Confirm a database backup/restore test and monitoring alerts.
4. Configure the production domain and provider allowlists.
5. Promote one reviewed commit to Production.
6. Seed production-safe content once if required: `npm run db:seed:production` with production credentials in a controlled job.
7. Re-run smoke checks against the production domain.

## 5. Smoke checklist

- `GET /api/health/live` returns 200.
- `GET /api/health/ready` returns 200 and reports configuration/database `ok`.
- Security response contains CSP with a nonce, HSTS, `nosniff`, frame denial, referrer, and permissions policies.
- Adult registration returns a generic accepted response, creates no session, sends verification email, rejects replay, and permits login only after verification.
- Minor registration sends separate learner and guardian links and remains pending until both are confirmed.
- Login requires Turnstile, rejects unverified/suspended accounts correctly, sends the email OTP through Resend, creates no pre-OTP session, and rejects missing, incorrect, expired, over-attempt, and reused challenges.
- Resend and forgot-password responses do not disclose account existence.
- Password reset is one-time and revokes existing sessions.
- Rate-limit tests receive 429; simulated Redis loss receives 503 rather than bypassing limits.
- Dashboard, onboarding, assessments, result ownership, analytics, Doubt Tutor, theme toggle, responsive navigation, and all three external social links work through real browser interaction.
- Terms and Privacy pages are reachable from registration.
- `ENABLE_DEMO_LOGIN=false`; the demo button is absent and the known demo account does not exist.
- Vercel Cron invocation succeeds with authorization and rejects a missing/incorrect secret.

## 6. Monitoring and rollback

- Alert on readiness 503, elevated 5xx/429, email-provider errors, Redis availability, database saturation, and tutor latency/cost.
- Keep deployment logs free of raw passwords, session values, action tokens, CAPTCHA tokens, and API keys.
- Application rollback is a Vercel deployment rollback. Database migrations must be forward-compatible; never use `prisma migrate reset` in production.
- For a migration incident, stop traffic/promotion, preserve logs, restore from a verified backup when required, and deploy a reviewed forward-fix migration.
- Rotate affected credentials after suspected exposure and invalidate sessions/tokens when appropriate.

## 7. Public-launch boundary

A technically deployed site is not automatically legally or operationally launch-approved. Before broad promotion to minors, obtain jurisdiction-specific privacy/child-consent review, approve retention/deletion and grievance processes, confirm content rights, conduct independent security/accessibility testing, and assign incident-response ownership. The current guardian workflow is a technical baseline—not a legal certification.

## 8. Manual payment modes (no gateway required)

`PAYMENT_PROVIDER_MODE` style gateway checkout is optional. Two manual, review-gated paths ship in the app:

- **UPI / QR** — set `MANUAL_UPI_ID` (for example the live PhonePe ID). Students pay the exact amount, submit the UPI transaction reference, and an administrator approves the order in `/admin/payments`.
- **Bank transfer (NEFT / IMPS)** — set all four of `BANK_ACCOUNT_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_IFSC`, `BANK_NAME`. `GET /api/v1/payments/netbanking` then reports the destination account and the access center shows the transfer steps plus a bank-reference form. Until those variables are set, the app reports `available: false` and shows an honest "not configured / with gateway" message instead of bank details it cannot honour.

Rules that must not be relaxed:

- Manual orders (UPI and bank transfer) are always `PENDING_REVIEW`; access unlocks only through the administrator decision (`PATCH /api/v1/admin/payments/[orderId]`), which writes an audit entry and grants the real entitlement.
- A bank/UPI reference can be used once: duplicates across all manual orders return `409 REFERENCE_ALREADY_USED`.
- Automatic net banking, cards and wallets require the payment gateway (e.g. Razorpay) with server-side signature verification. Never present them as live before merchant onboarding completes.
- Submit-time rate limit is 5 manual submissions per 24 hours per student; analysis-style AI limits are separate.

## 9. Deploying to an existing free (Hobby) Vercel project — zero-cost path

The code in this repository deploys to any Next.js-capable host, including an already-existing Vercel
project. Four facts must be faced before the first production build, because the production build is
fail-closed and will refuse to compile without them:

1. **SQLite cannot run on Vercel.** Serverless functions have no persistent disk, so the local
   `file:./dev.db` schema is dev-only. Production uses `prisma/schema.prisma` against PostgreSQL —
   Neon's free plan (0.5 GB, no card, no expiry) provides both the pooled `DATABASE_URL` and the
   direct `DIRECT_URL` for migrations.
2. **Redis (Upstash free)** is required for the distributed rate limiter; without it every protected
   route returns `503` in production instead of silently running unprotected.
3. **Cloudflare Turnstile (free)** is required for the bot check on sign-in/verification routes.
4. **Resend (free tier)** is required so a real one-time code reaches the student's inbox. In dev the
   code is printed to the console; in production there is no console fallback.

All four are free of charge. Nothing in this list needs a paid plan.

**Licence caveat, stated plainly:** Vercel's Hobby plan is for personal, non-commercial projects. Running
a paid product on Hobby is outside those terms; once the app actually charges money, either move to
Vercel Pro (paid) or host the same build on the paid KVM-1 VPS described in `docs/HOSTING_DECISION.md`.
Deploying now on Hobby is fine for a free launch, demonstrations and testing.

### Routes to production

- **A. Vercel CLI, existing project (fastest).** From a machine that has the repo: `npx vercel link`
  (choose the *existing* project), then `npx vercel --prod`. With a short-lived personal token the same
  two commands can be run from CI: `npx vercel link --yes --project <name> --token <token>` followed by
  `npx vercel --prod --token <token>`. Tokens are account-scoped secrets: create one with the shortest
  useful expiry, scope it to the single project if the dashboard allows, and revoke it immediately after
  the deploy. Never commit it, never paste it into a ticket.
- **B. GitHub + Vercel Git integration.** Push this repository to a GitHub repository, then point the
  existing Vercel project's Git connection at it. Every push to `main` then redeploys; preview URLs are
  created per branch.
- **C. Manual dashboard upload.** Not viable: the project needs the `vercel-build` command
  (`env:validate:production` → `prisma generate` → `migrate deploy` → `next build`) and server-side
  cron/route configuration from `vercel.json`.

### Environment variables to paste into the Vercel project (Production scope)

`DATABASE_URL`, `DIRECT_URL` (Neon: pooled for runtime, direct for migrations), `APP_URL` (the HTTPS
origin Vercel gives you, no trailing slash), `SESSION_SECRET` (at least 32 random characters — it signs
login one-time codes and the login flow refuses to run without it in production), `CRON_SECRET`,
`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (Upstash REST, **not** `REDIS_URL`),
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` (both keys of the same Turnstile widget),
`EMAIL_PROVIDER=RESEND`, `RESEND_API_KEY`, `EMAIL_FROM`, `AI_PROVIDER=MESH` with `AI_API_KEY` (leave
both unset to run in LOCAL_GROUNDED mode), `MANUAL_UPI_ID` (already used for the static-UPI review
flow), and `BANK_ACCOUNT_NAME` / `BANK_ACCOUNT_NUMBER` / `BANK_IFSC` / `BANK_NAME` once the real bank
details are decided. Keep `ENABLE_DEMO_LOGIN=false` and `SEED_DEMO_DATA=false`. Set
`RUN_SEED_ON_FIRST_DEPLOY=true` only for the very first deployment so the catalog is created, then
remove it: `vercel-build` runs `env:validate:production` → `prisma generate` → `migrate deploy` →
`node scripts/maybe-seed.mjs` → `next build`.

### Post-deploy smoke

1. `npm run env:validate:production` passes locally with the same values (validates shape, never prints).
2. The first build runs migrations on the empty database and then the idempotent catalog seed
   (`RUN_SEED_ON_FIRST_DEPLOY=true`); remove the flag and redeploy so later builds never touch data.
3. Sign in with a real inbox, run one timed test, open `/results/<attemptId>`: rank, performance report
   and the AI analysis card must render, and `Issue my certificate` must produce a printable record.
4. Install from Chrome on Android (`Install app`) and confirm the icon opens standalone.
5. `GET /api/health/ready` returns ready on the production origin.
