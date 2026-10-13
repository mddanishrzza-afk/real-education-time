# Real Education Time

**Learn Smarter. Practice Better. Improve Faster.**

A production-oriented multilingual adaptive-learning product for Indian students, built around **One Student = One Personalized Learning Journey**.

## Implemented product

- Public account registration with persisted Terms/Privacy acceptance and age controls.
- Hashed, expiring, one-time email verification, guardian consent, and password recovery.
- Under-18 accounts remain pending until learner email and guardian consent are both confirmed.
- Random hashed sessions, bcrypt passwords, Cloudflare Turnstile, trusted-origin checks, and atomic Redis REST rate limiting.
- Student onboarding, configurable board/class catalog, bilingual published content, timed assessments, authoritative scoring, results, mastery, and recommendations.
- Persisted Hindi/English/Hinglish Doubt Tutor using server-selected approved context, provider-neutral AI orchestration, validated responses, and no model database access.
- Nonce CSP/security headers, production environment validation, health checks, expired-token cleanup, Vercel configuration, and PostgreSQL migration baseline.

## Local development

```bash
npm install
npm run db:setup
npm run dev
```

Open `http://localhost:3000`. Local development uses `prisma/schema.sqlite.prisma` and `file:./dev.db`. `db:setup` explicitly enables the demo seed for local testing:

- Email: `student@realeducationtime.com`
- Password: `Learn@123`

For production-like local content **without** known demo credentials, run `npm run db:setup:content` instead. Public production must keep `ENABLE_DEMO_LOGIN=false` and `SEED_DEMO_DATA=false`.

## Public account lifecycle

1. Registration validates CAPTCHA, date of birth, separate policy acceptance, and guardian email when under 18.
2. The database account is created as `PENDING_VERIFICATION`; no session is issued.
3. The learner receives a one-time email-verification link. A minor's guardian receives a separate one-time consent link.
4. The account becomes `ACTIVE` only when all required steps are complete.
5. Login creates a session only for an active account.
6. Recovery sends a generic response, uses a one-time reset token, and revokes all sessions after password change.

In non-production environments, missing email/CAPTCHA/Redis credentials use development-only adapters. Production fails closed for missing Redis or CAPTCHA configuration and requires Resend.

## AI provider configuration

Supported `AI_PROVIDER` values:

- `LOCAL_GROUNDED` — deterministic approved-content mode, with no cloud-model claim or key.
- `MESH` — Mesh API (meshapi.ai), an OpenAI-compatible LLM gateway. Defaults to `https://api.meshapi.ai/v1` with the `openai/gpt-4o-mini` model; set `AI_API_KEY` to an `rsk_…` inference key from the Mesh dashboard.
- `OPENAI_COMPATIBLE` — any other OpenAI-compatible chat-completions endpoint, via `AI_BASE_URL`.
- `GEMINI` — Google Gemini generate-content adapter.

The server selects minimal published syllabus context, invokes a constrained adapter, validates structured output with Zod, and only then persists the response. Cloud failures fall back to clearly labelled approved-content mode.

Confirm that the configured gateway really served an answer (skipped unless `AI_API_KEY` is set, and it reads the same `.env` as the app):

```bash
npm run test:ai:live
```

## Quality gate

```bash
npm run db:setup
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

With the app running on `http://localhost:3000`, the browser-driven public lifecycle smoke can be run separately:

```bash
npx playwright install chromium
npm run test:e2e:public
```

The suites cover learning algorithms, AI schemas/providers/fallback, real tutor persistence/ownership, pending-account login refusal, public registration activation, minor guardian gating, one-time token replay prevention, session-revoking password reset, production fail-closed CAPTCHA/Redis behavior, cleanup-cron authorization, nonce CSP, and browser account lifecycles. CI also applies the committed baseline to disposable PostgreSQL and runs the production-safe seed.

## Vercel and PostgreSQL

Production uses `prisma/schema.prisma` and the committed migration in `prisma/migrations/`. Required managed services are PostgreSQL, Upstash-compatible Redis, Resend, Cloudflare Turnstile, Vercel, and an HTTPS domain. Copy variable names from `.env.example` into the platform secret manager—never commit secrets.

```bash
npm run env:validate:production
npm run db:generate:production
npm run db:migrate:deploy
npm run db:seed:production
```

The baseline migration is for a new empty PostgreSQL database. Read [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) before provisioning or promotion.

## Production boundary

The technical Public-MVP hardening is not a legal/security certification. Broad launch to minors still requires jurisdiction-specific Indian privacy and guardian-consent review, an approved retention/deletion and grievance process, managed backup/restore verification, monitoring and incident-response ownership, content-rights review, and independent security/accessibility testing.

- Architecture and roadmap: [`docs/SYSTEM_ARCHITECTURE.md`](docs/SYSTEM_ARCHITECTURE.md)
- Security controls and remaining governance: [`docs/SECURITY.md`](docs/SECURITY.md)
- Vercel deployment runbook: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
