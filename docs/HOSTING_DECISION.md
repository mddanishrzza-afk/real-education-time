# Hosting decision — Real Education Time (production)

Date: 2026-10-12 · Target scale: **10,000–15,000 students** · App: Next.js 16 (Node) + PostgreSQL + Upstash Redis + Resend + Razorpay + Mesh AI

## What production needs (fixed, same for every option)

| Requirement | Detail |
| --- | --- |
| HTTPS hosting for a Node app | Next.js server, PWA + service worker, TWA/asset links later |
| PostgreSQL | Prisma schema is `postgresql`; dev uses the local file DB |
| Upstash Redis (REST) | `UPSTASH_REDIS_REST_URL` + `TOKEN` are required env vars (rate limiting) |
| Resend (email) | OTP + password reset; free tier = 100 emails/day, breaks beyond ~500 students |
| Razorpay live keys | After KYC; the manual UPI QR (`PAYMENT_QR_URI` → request-time `/payment/qr`) works meanwhile |
| DNS A record for the app | `realeducationtime.com` (Zoho DNS) — **never touch MX/SPF/DKIM rows** |
| Mesh AI | Already live (spend cap $1) |

Shared monthly add-ons across all options: Resend ≈ ₹1,750 (paid tier), Upstash ≈ ₹0–500, Mesh AI usage = the real variable (≈ ₹4,000–5,000 at 10 doubts/student/month for 10k students).

## Option A — Indian VPS, self-managed  ⭐ recommended

**Hostinger KVM 2 — Mumbai** · 2 vCPU / 8 GB RAM / 100 GB NVMe / 8 TB bandwidth
Docker Compose on one box: app + PostgreSQL + Caddy (automatic HTTPS).

| Item | Cost |
| --- | --- |
| KVM 2 intro (long term) | ₹799/mo (+18% GST ≈ ₹943) |
| KVM 2 renewal | ₹1,199/mo (+GST) |
| Later upgrade KVM 4 (4 vCPU / 16 GB) | ₹1,099 intro / ₹2,399 renewal |
| Postgres | ₹0 (same server, at this scale it is trivial) |
| **Monthly total (start)** | **≈ ₹2,700–3,400** incl. Resend + Upstash, plus AI usage |

- ✅ India (Mumbai) region — fast for Bihar/Patna students; student data stays in India (DPDP-friendly)
- ✅ UPI / Paytm / NetBanking billing in INR with GST invoice — no international card needed
- ✅ Cheapest; capacity (2 vCPU / 8 GB) comfortably covers launch (500–1,000 students) and ~3–5k DAU
- ⚠️ One server = single point of failure → daily `pg_dump` backups + uptime monitor; move DB to managed later if needed (path exists)
- ⚠️ Renewal is costlier than intro price — budget ₹1,199–1,499/mo after the first term

## Option B — Fully managed (zero server work)

**Vercel Pro + Neon Postgres (Mumbai) + Upstash + Resend**

| Item | Cost |
| --- | --- |
| Vercel Pro (Hobby is non-commercial only — not allowed) | $20 ≈ ₹1,760/mo |
| Neon Postgres Mumbai (Launch) | ≈ $19 ≈ ₹1,670/mo |
| Upstash + Resend | ≈ ₹2,000/mo |
| **Monthly total** | **≈ ₹5,400–6,000** + usage overages + AI |

- ✅ Zero ops, auto-deploy, best reliability, easiest rollbacks
- ❌ ~2× the cost, needs an international card, usage-based overages can spike

## Option C — DigitalOcean Bangalore (middle ground)

| Item | Cost |
| --- | --- |
| Droplet 1 vCPU / 2 GB (or 2 vCPU / 4 GB $24 ≈ ₹2,100) | $12 ≈ ₹1,060/mo |
| Managed PostgreSQL (entry) | from $15 ≈ ₹1,320/mo |
| Backups (+20% droplet) | ≈ $2.4 |
| Upstash + Resend | ≈ ₹2,000/mo |
| **Monthly total** | **≈ ₹4,300–4,800** + AI |

- ✅ Standard tooling, snapshots, managed DB with failover options, hourly billing
- ❌ More expensive than A, USD card/PayPal only, DB entry tier is small (1 GB RAM)

## Not options (already ruled out)

Render free (sleeps 15 min + free Postgres expires in 30 days) · Vercel Hobby (non-commercial only) · InfinityFree / `ifree.page` (PHP-only, cannot run Node) · free PaaS DBs with expiry.

## Recommendation

**Option A — Hostinger KVM 2 in Mumbai.** Cheapest, India region, UPI/GST billing, ample capacity for launch; upgrade to KVM 4 (or split the database out) when daily traffic grows. Architecture is identical in all three options, so switching later is a migration, not a rewrite.

## Next step (one at a time, after the choice)

1. Buy the chosen server (I will give exact click-by-click steps)
2. I prepare the Docker deployment: app + PostgreSQL + Caddy HTTPS, `.env` production values
3. DNS: add A record for the app subdomain at Zoho (MX/SPF/DKIM untouched)
4. Production env values: Resend key, Upstash project, Razorpay live keys (after KYC)
5. Verify: login/OTP by real email, payments, PWA install → then TWA + Play Console
