# Real Education Time — System Architecture v1.0

## 1. Architecture summary

Real Education Time starts as a **domain-modular monolith** deployed as a Next.js application. This is deliberate: authentication, testing, scoring, content and analytics need strong transactional consistency during the MVP. Boundaries are kept explicit so AI workloads, notifications, search and reporting can be extracted into independent services when traffic justifies it.

```text
Browser / PWA
   │ HTTPS, secure HttpOnly session
   ▼
Next.js Web + BFF/API
   ├── Identity & RBAC
   ├── Academic Content
   ├── Assessment Engine
   ├── Performance & Mastery
   ├── Recommendation Service
   └── Admin/Teacher modules (later phases)
   │
   ├── PostgreSQL (system of record)
   ├── Object Storage (media/certificates)
   ├── Redis (rate limits, cache, queues)
   ├── Search index (Phase 4+)
   └── AI Orchestrator → provider adapters → approved LLM
```

### Deployment topology

- **Web tier:** stateless Next.js instances behind CDN/WAF.
- **Data tier:** managed PostgreSQL with PITR, read replicas when required and connection pooling.
- **Async tier:** Redis-backed jobs for reports, certificates, notifications and AI validation.
- **Storage:** private object storage; signed URLs for protected content.
- **Observability:** structured logs, traces, error monitoring, audit events and product analytics.
- **Local development:** SQLite mirror of the provider-neutral Prisma model. Production always generates Prisma Client from `prisma/schema.prisma` (PostgreSQL).

## 2. Technology architecture

| Layer | MVP choice | Scale path / rationale |
|---|---|---|
| UI | Next.js 16, React 19, TypeScript, Tailwind CSS 4 | Server components by default; client islands for test runner/forms |
| API | Next.js route handlers, Zod validation | Can move modules to NestJS without changing contracts |
| Auth | Opaque random sessions, SHA-256 token-at-rest, HttpOnly/SameSite cookies, bcrypt | Add OIDC/Google through Auth.js; Redis session cache if needed |
| Database | PostgreSQL 16+, Prisma ORM | PgBouncer, replicas, partition large answer/event tables |
| Cache/jobs | Redis (production integration) | BullMQ/managed queues for asynchronous work |
| AI | Provider-neutral orchestration boundary | OpenAI/Anthropic/Gemini/private model adapters; no direct DB access |
| Search | PostgreSQL FTS initially | OpenSearch/Typesense when corpus and relevance needs grow |
| Testing | Vitest unit/integration; Playwright E2E planned | API contract, accessibility and load tests in CI |
| Delivery | Docker/Vercel-compatible build, managed Postgres | IaC, staging gates, migration jobs, canary rollout |

## 3. Bounded modules

1. **Identity:** users, roles, sessions, guardian links, teacher profiles.
2. **Academics:** boards, classes, subjects, chapters, topics and concepts.
3. **Content:** questions, options, provenance, review states and versioning policy.
4. **Assessment:** tests, configurations, attempts, answers, scoring and timers.
5. **Learning Intelligence:** performance records, mastery, knowledge map, revision queue and plans.
6. **AI Orchestration:** safe context assembly, provider adapter, validation, moderation and audit.
7. **Engagement:** achievements, notifications, streaks and certificates.
8. **Governance:** review workflow, audit logs, feature flags and configurable scoring policies.

## 4. Data model

The canonical production model is in `prisma/schema.prisma`. Core relationships:

```text
User 1─1 StudentProfile        User 1─* Session
Board *─* AcademicClass (ClassOffering) *─1 Subject
ClassOffering 1─* Chapter 1─* Topic 1─* Concept
Topic 1─* Question 1─* QuestionOption
Test *─* Question (TestQuestion)
StudentProfile 1─* TestAttempt 1─* Answer
StudentProfile 1─* MasteryScore (*─1 Topic)
StudentProfile 1─* StudyPlan 1─* StudyPlanItem
StudentProfile 1─* Recommendation / RevisionItem / Certificate
User 1─* AiConversation 1─* AiMessage
```

### Data rules

- Stable UUID/CUID identifiers are never derived from labels.
- Content uses explicit board/class/subject scope through `ClassOffering`.
- Questions have lifecycle status (`DRAFT → IN_REVIEW → PUBLISHED → ARCHIVED`) and source/provenance.
- Correct answers never leave assessment APIs before submission.
- Attempts and submitted answers are immutable from the learner’s perspective.
- Computed scores store the policy version used, enabling future recalculation/audit.
- Mastery is unique per student/topic and includes confidence plus evidence count.
- All timestamps are UTC; locale is presentation-only.

### Important indexes

- `Question(topicId, difficulty, status)` for adaptive selection.
- `TestAttempt(studentId, submittedAt)` for dashboard timelines.
- `Answer(attemptId, questionId)` unique to prevent duplicate scoring.
- `MasteryScore(studentId, topicId)` unique for knowledge map lookup.
- `Session(tokenHash)` unique and `Session(expiresAt)` for cleanup.
- Search/index strategy is documented per query before scale rollout.

## 5. User roles and permissions

| Role | Primary permissions |
|---|---|
| Student | Manage own profile; access assigned/published learning content; create and submit own attempts; view own analytics |
| Guardian | View explicitly linked child’s permitted summary; no answer/content modification |
| Teacher | Manage own cohorts and assignments; author drafts; view assigned students’ reports |
| Content Reviewer | Review, return or publish content inside assigned academic scopes |
| Admin | Manage catalog, users, exam policies, feature flags and AI limits; sensitive actions audited |
| Super Admin (deployment policy) | Break-glass infrastructure/tenant operations; enforced MFA and least use |

Authorization is enforced in the server/service layer, not by hiding UI controls. Object-level ownership checks apply to every attempt, result, plan and report.

## 6. API architecture

MVP uses JSON REST under `/api/v1` with consistent validation and error envelopes.

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
PATCH  /api/v1/students/me/onboarding
GET    /api/v1/tests
GET    /api/v1/tests/:slug
POST   /api/v1/attempts
POST   /api/v1/attempts/:id/submit
GET    /api/v1/attempts/:id/result
GET    /api/v1/performance/summary
GET    /api/v1/doubts/topics
GET    /api/v1/doubts/conversations
POST   /api/v1/doubts/conversations
GET    /api/v1/doubts/conversations/:id
DELETE /api/v1/doubts/conversations/:id
POST   /api/v1/doubts/conversations/:id/messages
```

The Doubt APIs require an active student session. Topic retrieval is scoped to the student’s configured board/class. Conversation reads, writes and deletes enforce `userId` ownership in the database query; IDs alone never grant access.

Future resource groups:

```text
/admin/{boards,classes,subjects,questions,exams,users,ai-settings}
/teacher/{cohorts,assignments,reports}
/ai/{tutor,explanations,study-plans,question-drafts}
/revision/{queue,items}
/certificates/{id,verify}
/notifications
```

### API conventions

- Zod validates request boundaries; server ignores client-provided scores/correctness.
- Error shape: `{ error: { code, message, fieldErrors?, requestId? } }`.
- Cursor pagination for growing collections.
- Idempotency keys for payments, certificates and long-running AI jobs.
- CSRF origin/fetch-metadata checks for cookie-authenticated mutations.
- Per-IP/per-account rate limits (in-memory only in local MVP, Redis in production).
- OpenAPI contract will be generated before external/mobile clients are released.

## 7. AI architecture

```text
Learner action
  → policy/consent check
  → backend fetches minimum approved context
  → PII redaction + context builder
  → prompt registry (versioned)
  → provider adapter with timeout/token budget
  → structured JSON response
  → schema + safety + syllabus validation
  → optional deterministic verification
  → human review when high-stakes/generated content
  → persisted output with model/prompt/version/audit metadata
```

### Implemented tutor request flow

1. The authenticated API resolves the student’s board/class and verifies conversation ownership.
2. `src/lib/ai/context.ts` queries only active topics with `PUBLISHED` concepts inside that syllabus scope. An explicit topic is verified; otherwise a conservative lexical match is required.
3. The context builder returns a small provider-neutral DTO containing topic identity, up to four published concepts and up to three published reviewed examples. No user/session/database object or credential crosses this boundary.
4. `src/lib/ai/providers.ts` builds the versioned grounded prompt and calls `MESH` (Mesh API, meshapi.ai), `OPENAI_COMPATIBLE`, `GEMINI`, or deterministic `LOCAL_GROUNDED` mode with a timeout and bounded output size.
5. `tutorAnswerSchema` requires an explanation, 2–5 key points, confidence, source note and a concept-check question. Invalid/failed cloud responses use the explicitly labelled local grounded fallback.
6. The validated explanation and structured metadata are persisted in `AiMessage`; provider/model/prompt version, latency, topic and fallback status are retained. An audit event records response creation.

### Tool boundaries

The current tutor gives the LLM **no tools at all** and never supplies a database credential or arbitrary query ability. Future use cases may add narrowly scoped backend-owned tools such as:

- `get_student_mastery(studentId, allowedTopicIds)`
- `retrieve_approved_content(topicId, language)`
- `select_candidate_questions(policyId, constraints)`
- `save_study_plan_draft(validatedPayload)`

Every future tool requires argument validation, authorization, an allowlisted query and audit logging; model output can never become a raw database query.

### Quality controls

- Tutor responses are grounded in approved content where available.
- Generated questions remain `DRAFT`; duplicates, answer solvability, difficulty and syllabus alignment are checked before reviewer publication.
- Numerical questions use deterministic solvers/rules when applicable.
- Citations point only to stored/verified sources; uncertainty is explicit.
- AI output is advisory and never guarantees exam performance.
- Provider/model/prompt versions, latency, cost and validation outcomes are logged without unnecessary PII.

## 8. Adaptive learning logic

### Signals

Correctness, partial marks, difficulty, response-time ratio, recency, hints, skip pattern, repeated misconceptions, revision outcome and evidence count.

### Mastery update (configurable policy)

For a topic, map evidence to `[0,1]`:

```text
quality = correctness × difficultyWeight × timeFactor
newMastery = oldMastery + learningRate × confidence × (quality - oldMastery)
confidence = min(1, evidenceCount / confidenceTarget)
```

The implementation also uses asymmetric penalties so careless/random errors do not behave like proven mastery. All coefficients belong to a versioned `ScoringPolicy` record/config, not scattered constants.

### Next question selection

1. Exclude seen/recently repeated and ineligible content.
2. Identify target topic: weakest prerequisite-ready topic with due revision boost.
3. Pick target difficulty near mastery boundary (roughly 65–80% predicted success).
4. Balance exposure, syllabus coverage and test blueprint constraints.
5. After two repeated errors, lower difficulty, surface approved concept help and schedule a near-transfer item.
6. After a stable correct streak at adequate speed, raise difficulty one step.
7. Stop when confidence threshold, time budget or test blueprint limit is met.

### Guardrails

- Minimum/maximum questions and difficulty jumps.
- No punitive infinite loops on weak topics.
- Diagnostic confidence is shown separately from mastery.
- Accessibility/time accommodations are applied before speed evaluation.
- Cold start uses diagnostic stratified sampling, not demographic inference.
- Selection events store policy version and reason codes for explainability.

The pure scoring and selector functions live under `src/lib/learning` and are unit tested.

## 9. Implemented product scope (Phases 1 + Phase 2 tutor slice)

Implemented foundation:

- Premium responsive bilingual landing page.
- Email/password registration plus password→email-OTP login with revocable DB sessions; no session is created until a short-lived, hashed, one-time, attempt-limited OTP is verified.
- Student onboarding: board, class, language, level and daily study time.
- Configurable academic hierarchy and seeded bilingual question bank.
- Published test catalog and time-bound MCQ test runner.
- Server-authoritative submission/scoring persisted transactionally.
- Result page with score, accuracy, timing, answer review and recommendations.
- Dashboard based on real attempt/mastery data.
- Analytics and topic knowledge-map views.
- Responsive desktop/mobile navigation, accessible controls and empty states.
- Validation, object-level authorization, CSRF checks, basic rate limiting and unit tests.
- Responsive Doubt / AI Tutor workspace in student navigation.
- Persisted multilingual tutor conversations/messages with reopen and delete behavior.
- Syllabus-scoped context selection, provider-neutral cloud adapters and honest local grounded mode.
- Structured answer validation, source/confidence metadata, learning checks, usage limits and AI audit events.

Explicitly not faked: Google OAuth, teacher/admin CRUD, payments, leaderboards, certificate issuance and AI-generated question publication. Their architecture is prepared, but no non-working controls are exposed. Local grounded tutor mode is labelled as non-cloud and is limited to approved seeded content.

## 10. Development roadmap

### Phase 1 — MVP foundation (complete)

1. Identity, onboarding and academic catalog.
2. Reviewed question bank seed/content import contract.
3. Test lifecycle, scoring and immutable attempts.
4. Dashboard/results/analytics.
5. CI checks, security baseline and deployment runbook.

**Exit gate:** critical flows covered; backup/restore tested; no answer leakage; accessibility and mobile smoke tests; production PostgreSQL migration approved.

### Phase 2 — Assisted intelligence (in progress)

Implemented vertical slice:

- Provider-neutral AI gateway, approved-content retrieval and persisted tutor conversations.
- English/Hindi/Hinglish response selection, structured validation, local fallback and per-account usage limit.
- Existing deterministic performance insights, weak-topic detection and recommendations integrated with the student shell.

Remaining before the full phase exit:

- Redis-backed distributed limits and provider cost/latency dashboards.
- Moderation policy, grounded-response evaluation set and refusal/uncertainty regression suite.
- Content reviewer queue, recommendation feedback loop, reviewer sign-off and privacy impact assessment.

**Exit gate:** evaluated grounding quality, abuse and uncertainty tests, reviewer sign-off, privacy impact assessment and production observability.

### Phase 3 — Adaptive learning (8–10 weeks)

- Policy editor, adaptive selector, diagnostic blueprints and mastery calibration.
- Revision scheduler, study plans, flashcards and intervention experiments.
- A/B framework with educational outcome guardrails.

### Phase 4 — Exam modules (iterative)

- Versioned exam patterns for NEET/JEE/SSC/Railway/UPSC/BPSC.
- Syllabus provenance, negative-marking policies, previous-year and mock workflows.
- Subject expert review by exam module; official changes tracked by effective date.

### Phase 5 — Platform expansion

- Teacher, guardian and institution tenancy; assignments and reports.
- Certificates and verification; PWA/offline-safe content; payments/subscriptions.
- Advanced search, notification service, warehouse/BI and regional-language expansion.

## 11. Security and operations checklist

- TLS/HSTS, CSP, secure cookies, WAF and dependency scanning.
- Password hashing, login throttling, session rotation/revocation and MFA for staff.
- Least-privilege DB/service accounts; secrets only in managed secret stores.
- Tenant/object authorization tests; admin audit events are append-only/exported.
- Data minimization, consent/guardian workflows, retention/deletion procedures.
- Encrypted backups with restore drills; RPO/RTO documented.
- SAST/DAST, penetration testing before high-scale launch, incident runbooks.
- OWASP ASVS and child-safety/privacy review before production student onboarding.
