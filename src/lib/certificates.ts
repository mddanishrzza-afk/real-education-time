import { randomBytes } from "node:crypto";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { clamp } from "@/lib/format";

/**
 * Certificates for graded attempts.
 *
 * Rules that must stay true:
 * - A certificate is issued only for a SUBMITTED attempt whose score reaches the test's own pass mark.
 * - One certificate per attempt (unique attemptId) and issuing twice returns the stored one, never a duplicate.
 * - The reported rank comes from real submitted attempts on the very same test; when the sample is tiny the
 *   caller must say so instead of pretending the rank is meaningful.
 * - The document is an internal practice record, never an official board/exam certificate.
 */
export const CERTIFICATE_PASS_FALLBACK = 40;
export const RANK_SAMPLE_MINIMUM = 5;
export const RANK_WINDOW = 5000;

const GRADE_LADDER = [
  { min: 90, grade: "A+", label: "Outstanding" },
  { min: 80, grade: "A", label: "Excellent" },
  { min: 70, grade: "B", label: "Very good" },
  { min: 60, grade: "C", label: "Good" },
  { min: 50, grade: "D", label: "Satisfactory" },
  { min: 0, grade: "E", label: "Needs practice" },
] as const;

export type Grade = { grade: string; label: string };

export type RankedAttempt = { id: string; score: number; accuracy: number; submittedAt: Date | null };

export type TestRank = { rank: number; total: number; sampleIsSmall: boolean; approximate: boolean };

export type EligibilityInput = {
  status: string;
  score: number;
  maxScore: number;
  passPercentage?: number | null;
};

export type Eligibility = Grade & {
  eligible: boolean;
  threshold: number;
  percentage: number;
  reason: string;
};

export function roundPercentage(value: number): number {
  return Math.round(clamp(value) * 10) / 10;
}

/** Pass mark for the certificate: the test's own pass percentage, else a conservative 40%. */
export function certificateThreshold(passPercentage: number | null | undefined): number {
  const usable = typeof passPercentage === "number" && Number.isFinite(passPercentage) && passPercentage > 0 ? passPercentage : CERTIFICATE_PASS_FALLBACK;
  return Math.round(clamp(usable) * 100) / 100;
}

export function certificateGrade(percentage: number): Grade {
  const value = clamp(percentage);
  const step = GRADE_LADDER.find((item) => value >= item.min) ?? GRADE_LADDER[GRADE_LADDER.length - 1];
  return { grade: step.grade, label: step.label };
}

export function certificateEligibility(input: EligibilityInput): Eligibility {
  const threshold = certificateThreshold(input.passPercentage);
  const percentage = input.maxScore > 0 ? roundPercentage((input.score / input.maxScore) * 100) : 0;
  const graded = certificateGrade(percentage);
  const base = { ...graded, threshold, percentage };

  if (input.status !== "SUBMITTED") {
    return { ...base, eligible: false, reason: "Submit the test first — a certificate is issued only for a finished attempt." };
  }
  if (input.maxScore <= 0) {
    return { ...base, eligible: false, reason: "This attempt has no scored questions, so no certificate can be issued for it." };
  }
  if (percentage < threshold) {
    return {
      ...base,
      eligible: false,
      reason: `Certificate unlocks at ${threshold}% on this test. This attempt scored ${percentage}% — revise the weak topics and try again.`,
    };
  }
  return { ...base, eligible: true, reason: `Eligible — scored ${percentage}% (pass mark ${threshold}%).` };
}

/** Deterministic total order for a leaderboard: score, then accuracy, then who submitted earlier, then id. */
export function compareRanked(a: RankedAttempt, b: RankedAttempt): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
  const at = a.submittedAt ? a.submittedAt.getTime() : 0;
  const bt = b.submittedAt ? b.submittedAt.getTime() : 0;
  if (at !== bt) return at - bt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function rankFromPeers(mine: RankedAttempt, peers: RankedAttempt[], total?: number): TestRank {
  const window = [...peers].sort(compareRanked).slice(0, RANK_WINDOW);
  const index = window.findIndex((item) => item.id === mine.id);
  const exactTotal = total ?? peers.length;
  return {
    rank: index >= 0 ? index + 1 : window.length + 1,
    total: Math.max(exactTotal, index >= 0 ? index + 1 : 0),
    sampleIsSmall: exactTotal < RANK_SAMPLE_MINIMUM,
    approximate: index < 0,
  };
}

export function rankLabel(rank: TestRank): string {
  if (rank.approximate) return `Outside the top ${RANK_WINDOW} of ${rank.total} attempts`;
  if (rank.sampleIsSmall) return `Rank ${rank.rank} of ${rank.total} — small sample, treat it as a rough pointer`;
  return `Rank ${rank.rank} of ${rank.total} on this test`;
}

export async function getTestRank(testId: string, mine: RankedAttempt): Promise<TestRank> {
  const peers = await prisma.testAttempt.findMany({
    where: { testId, status: "SUBMITTED" },
    select: { id: true, score: true, accuracy: true, submittedAt: true },
    orderBy: [{ score: "desc" }, { accuracy: "desc" }, { submittedAt: "asc" }],
    take: RANK_WINDOW,
  });
  const total = peers.length === RANK_WINDOW ? await prisma.testAttempt.count({ where: { testId, status: "SUBMITTED" } }) : peers.length;
  return rankFromPeers(mine, peers, total);
}

/** Average percentage of every submitted attempt on the test, including this one. Null when there is no data. */
export async function getTestAveragePercentage(testId: string): Promise<number | null> {
  const aggregate = await prisma.testAttempt.aggregate({
    where: { testId, status: "SUBMITTED", maxScore: { gt: 0 } },
    _avg: { accuracy: true },
    _count: { _all: true },
  });
  if (!aggregate._count._all || aggregate._avg.accuracy === null) return null;
  return roundPercentage(aggregate._avg.accuracy);
}

export type IssuedCertificate = {
  certificateId: string;
  code: string;
  title: string;
  studentName: string;
  score: number;
  maxScore: number;
  percentage: number;
  accuracy: number;
  grade: string;
  gradeLabel: string;
  rank: number | null;
  totalAttempts: number | null;
  rankIsSmallSample: boolean;
  issuedAt: Date;
};

function present(certificate: {
  certificateId: string;
  verificationCode: string;
  title: string;
  studentName: string | null;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  accuracy: number | null;
  grade: string | null;
  rank: number | null;
  totalAttempts: number | null;
  issuedAt: Date;
}): IssuedCertificate {
  const percentage = certificate.percentage ?? 0;
  const graded = certificate.grade ? { grade: certificate.grade, label: certificateGrade(percentage).label } : certificateGrade(percentage);
  return {
    certificateId: certificate.certificateId,
    code: certificate.verificationCode,
    title: certificate.title,
    studentName: certificate.studentName ?? "Student",
    score: certificate.score ?? 0,
    maxScore: certificate.maxScore ?? 0,
    percentage: roundPercentage(percentage),
    accuracy: roundPercentage(certificate.accuracy ?? 0),
    grade: graded.grade,
    gradeLabel: graded.label,
    rank: certificate.rank,
    totalAttempts: certificate.totalAttempts,
    rankIsSmallSample: certificate.totalAttempts !== null && certificate.totalAttempts < RANK_SAMPLE_MINIMUM,
    issuedAt: certificate.issuedAt,
  };
}

export async function getCertificateForAttempt(attemptId: string, studentId: string): Promise<IssuedCertificate | null> {
  const certificate = await prisma.certificate.findFirst({
    where: { attemptId, status: "ACTIVE", revokedAt: null, attempt: { studentId } },
    select: {
      certificateId: true,
      verificationCode: true,
      title: true,
      studentName: true,
      score: true,
      maxScore: true,
      percentage: true,
      accuracy: true,
      grade: true,
      rank: true,
      totalAttempts: true,
      issuedAt: true,
    },
  });
  return certificate ? present(certificate) : null;
}

export async function getCertificateByCode(code: string): Promise<IssuedCertificate | null> {
  const normalized = code.trim().toLowerCase();
  if (!/^[0-9a-f]{16,64}$/.test(normalized)) return null;
  const certificate = await prisma.certificate.findFirst({
    where: { verificationCode: normalized, status: "ACTIVE", revokedAt: null },
    select: {
      certificateId: true,
      verificationCode: true,
      title: true,
      studentName: true,
      score: true,
      maxScore: true,
      percentage: true,
      accuracy: true,
      grade: true,
      rank: true,
      totalAttempts: true,
      issuedAt: true,
    },
  });
  return certificate ? present(certificate) : null;
}

function certificateCodeParts() {
  const year = new Date().getFullYear();
  return {
    certificateId: `RET-${year}-${randomBytes(4).toString("hex").toUpperCase()}`,
    verificationCode: randomBytes(12).toString("hex"),
  };
}

export async function issueCertificateForAttempt(input: { attemptId: string; studentId: string; userId: string }) {
  const attempt = await prisma.testAttempt.findFirst({
    where: { id: input.attemptId, studentId: input.studentId, status: "SUBMITTED" },
    include: {
      test: { select: { id: true, titleEn: true, passPercentage: true } },
      student: { select: { userId: true, user: { select: { name: true } } } },
    },
  });
  if (!attempt) throw new ApiError(404, "ATTEMPT_NOT_FOUND", "No submitted attempt of this account matches that id.");

  const eligibility = certificateEligibility({
    status: attempt.status,
    score: attempt.score,
    maxScore: attempt.maxScore,
    passPercentage: attempt.test.passPercentage,
  });
  if (!eligibility.eligible) throw new ApiError(409, "CERTIFICATE_NOT_ELIGIBLE", eligibility.reason);

  const existing = await getCertificateForAttempt(attempt.id, input.studentId);
  if (existing) return { certificate: existing, created: false };

  const rank = await getTestRank(attempt.test.id, {
    id: attempt.id,
    score: attempt.score,
    accuracy: attempt.accuracy,
    submittedAt: attempt.submittedAt,
  });

  const data = {
    userId: attempt.student.userId,
    attemptId: attempt.id,
    title: attempt.test.titleEn,
    testTitle: attempt.test.titleEn,
    studentName: attempt.student.user.name,
    score: attempt.score,
    maxScore: attempt.maxScore,
    percentage: eligibility.percentage,
    accuracy: attempt.accuracy,
    grade: eligibility.grade,
    rank: rank.rank,
    totalAttempts: rank.total,
  };

  // Retry only on the (very unlikely) collision of a randomly generated public id.
  let created = null;
  for (let attemptNumber = 0; attemptNumber < 3 && !created; attemptNumber += 1) {
    const codes = certificateCodeParts();
    try {
      created = await prisma.certificate.create({ data: { ...data, ...codes } });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "P2002" || attemptNumber === 2) throw error;
    }
  }
  if (!created) throw new ApiError(500, "CERTIFICATE_ISSUE_FAILED", "The certificate could not be issued. Please retry.");

  await prisma.auditLog.create({
    data: {
      actorId: input.userId,
      action: "CERTIFICATE_ISSUED",
      resourceType: "Certificate",
      resourceId: created.id,
      metadataJson: {
        attemptId: attempt.id,
        testId: attempt.test.id,
        certificateId: created.certificateId,
        percentage: eligibility.percentage,
        grade: eligibility.grade,
        rank: rank.rank,
        totalAttempts: rank.total,
      },
    },
  });

  return { certificate: present(created), created: true };
}
