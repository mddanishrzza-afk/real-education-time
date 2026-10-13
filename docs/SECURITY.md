# Security baseline

This document describes implemented controls in the Public-MVP codebase. It is not a security certification or legal opinion.

## Authentication and account lifecycle

- Passwords use bcrypt; credential handling is server-side.
- Sessions are random 256-bit opaque values. Only SHA-256 digests are stored; cookies are HttpOnly, SameSite=Lax, and Secure in production.
- Public registration creates `PENDING_VERIFICATION`, never a session.
- Email-verification, password-reset, and guardian-consent tokens are random, hashed at rest, expiring, and deleted transactionally on use.
- Terms and Privacy acceptance timestamps and date of birth are persisted.
- Learners under 18 require a different guardian email. Activation requires both learner email verification and guardian consent.
- Password reset revokes every existing session.
- Registration, recovery, and resend responses avoid account enumeration. Login reveals pending state only after a correct password.

## Request and abuse controls

- Zod validates public API payloads; JSON parse failures are handled centrally.
- Browser mutations enforce Fetch Metadata / trusted-origin checks.
- Cloudflare Turnstile protects registration, login, forgot-password, and verification resend. Missing or unavailable CAPTCHA fails closed in production.
- An atomic Redis Lua operation backs request limits through an Upstash-compatible REST API. Missing or unavailable Redis fails closed in production; only local development uses an in-memory fallback.
- Correct assessment options never reach active test clients; scoring is authoritative on the server.
- Ownership checks cover results, attempts, and tutor conversation read/write/delete operations.

## Platform and transport controls

- `src/proxy.ts` creates a per-request CSP nonce and sends CSP, HSTS, frame, MIME, referrer, permissions, and opener policies.
- CSP permits Cloudflare Turnstile but blocks framing, plugins, unexpected form destinations, and arbitrary script execution.
- PostgreSQL has a committed baseline migration; production seeding excludes known demo credentials unless an explicit demo flag is set.
- Liveness and readiness endpoints are available. Readiness checks database connectivity and production configuration without returning secrets.
- A Vercel Cron route deletes expired sessions and action tokens and requires `CRON_SECRET` bearer authentication.
- Request errors and operational failures emit structured server logs suitable for Vercel log drains/alerts.

## Tutor boundary

- The model receives no database connection, credential, or tool.
- Server orchestration chooses minimal board/class-scoped published context.
- Structured model responses are Zod-validated before persistence.
- Provider, model, prompt version, topic, fallback status, and audit metadata are retained.
- A bounded approved-content fallback is clearly labelled and does not claim to be a cloud-model answer.

## Mandatory provider configuration

Production requires managed PostgreSQL, Upstash-compatible Redis, Cloudflare Turnstile, a verified transactional-email sender, HTTPS `APP_URL`, and a long random `CRON_SECRET`. `npm run env:validate:production` must pass. Keep `ENABLE_DEMO_LOGIN` and `SEED_DEMO_DATA` false.

## Remaining launch governance

These are operational/legal gates, not hidden implementation claims:

1. Obtain jurisdiction-specific Indian privacy and child-consent review. The under-18 workflow is a technical baseline, not proof of legally sufficient verifiable consent.
2. Define and implement approved data-retention/deletion schedules and a verified user/guardian rights process.
3. Configure managed PostgreSQL least-privilege roles, PITR, encrypted backups, and a documented restore drill.
4. Configure WAF/bot rules, log drains, availability/error alerts, provider-spend alerts, and incident response ownership.
5. Complete independent penetration testing, accessibility review, DAST/SAST, secret scanning, and domain/email-security setup (SPF, DKIM, DMARC).
6. Add staff identity/MFA and role-administration workflows before staff/admin interfaces become public.
7. Expand tutor safety evaluation, PII redaction, abuse reporting, human review for high-stakes content, and prompt-injection regression coverage.
8. Review content rights, examination rules, grievance handling, terms, and privacy copy with qualified counsel.
