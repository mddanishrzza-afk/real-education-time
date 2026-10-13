import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { nextReviewDate, updateMastery } from "@/lib/learning/mastery";
import { assertAccess } from "@/lib/access";
import { hasReachedAttemptLimit } from "@/lib/attempt-policy";

type SubmittedAnswer = { questionId: string; selectedOptionId: string | null; responseSeconds: number };

export async function startAttempt(userId: string, studentId: string, testId: string) {
  const now = new Date();
  const test = await prisma.test.findFirst({
    where: {
      id: testId,
      status: "PUBLISHED",
      OR: [{ availableFrom: null }, { availableFrom: { lte: now } }],
      AND: [{ OR: [{ availableUntil: null }, { availableUntil: { gte: now } }] }],
    },
    select: { id: true, maxAttempts: true, accessCategory: true },
  });
  if (!test) throw new ApiError(404, "TEST_NOT_AVAILABLE", "This test is not available.");

  const existing = await prisma.testAttempt.findFirst({
    where: { studentId, testId, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
  });
  // A learner can finish an already-created session after a trial expires, but
  // no new attempt is created without a current server-side entitlement/trial.
  if (existing) return existing;
  const access = await assertAccess(userId, test.accessCategory);

  if (test.maxAttempts && access.source !== "TRIAL") {
    const completed = await prisma.testAttempt.count({ where: { studentId, testId, status: "SUBMITTED" } });
    if (hasReachedAttemptLimit(test.maxAttempts, completed, access.source)) {
      throw new ApiError(409, "ATTEMPT_LIMIT", "You have used all attempts for this test.");
    }
  }

  return prisma.testAttempt.create({ data: { studentId, testId } });
}

export async function submitAttempt(studentId: string, attemptId: string, submitted: SubmittedAnswer[]) {
  const duplicateCheck = new Set(submitted.map((answer) => answer.questionId));
  if (duplicateCheck.size !== submitted.length) {
    throw new ApiError(422, "DUPLICATE_ANSWERS", "A question can only be answered once.");
  }

  return prisma.$transaction(async (tx) => {
    const attempt = await tx.testAttempt.findFirst({
      where: { id: attemptId, studentId },
      include: {
        test: {
          include: {
            questions: {
              orderBy: { sequence: "asc" },
              include: {
                question: {
                  include: {
                    options: { orderBy: { sequence: "asc" } },
                    topic: { include: { chapter: { include: { offering: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!attempt) throw new ApiError(404, "ATTEMPT_NOT_FOUND", "Test attempt was not found.");
    if (attempt.status !== "IN_PROGRESS") throw new ApiError(409, "ALREADY_SUBMITTED", "This attempt has already been submitted.");

    const testQuestions = new Map(attempt.test.questions.map((item) => [item.questionId, item]));
    for (const answer of submitted) {
      const item = testQuestions.get(answer.questionId);
      if (!item) throw new ApiError(422, "INVALID_QUESTION", "An answer does not belong to this test.");
      if (answer.selectedOptionId && !item.question.options.some((option) => option.id === answer.selectedOptionId)) {
        throw new ApiError(422, "INVALID_OPTION", "A selected option does not belong to its question.");
      }
    }

    const submittedMap = new Map(submitted.map((answer) => [answer.questionId, answer]));
    let score = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;
    let responseSecondsTotal = 0;
    let answeredCount = 0;
    const answerRows: Prisma.AnswerCreateManyInput[] = [];
    const topicAggregates = new Map<string, { score: number; maxScore: number; correct: number; answered: number; total: number; seconds: number; subjectId: string }>();

    for (const item of attempt.test.questions) {
      const response = submittedMap.get(item.questionId);
      const selected = response?.selectedOptionId
        ? item.question.options.find((option) => option.id === response.selectedOptionId)
        : null;
      const isSkipped = !selected;
      const isCorrect = Boolean(selected?.isCorrect);
      const marksAwarded = isSkipped ? 0 : isCorrect ? item.marks : -item.negativeMarks;
      const responseSeconds = Math.min(response?.responseSeconds ?? 0, attempt.test.durationMinutes * 60);

      score += marksAwarded;
      responseSecondsTotal += responseSeconds;
      if (isSkipped) skippedCount += 1;
      else {
        answeredCount += 1;
        if (isCorrect) correctCount += 1;
        else incorrectCount += 1;
      }

      answerRows.push({
        attemptId: attempt.id,
        questionId: item.questionId,
        selectedOptionId: selected?.id ?? null,
        isCorrect,
        marksAwarded,
        responseSeconds,
      });

      const topicId = item.question.topicId;
      const aggregate = topicAggregates.get(topicId) ?? {
        score: 0,
        maxScore: 0,
        correct: 0,
        answered: 0,
        total: 0,
        seconds: 0,
        subjectId: item.question.topic.chapter.offering.subjectId,
      };
      aggregate.score += marksAwarded;
      aggregate.maxScore += item.marks;
      aggregate.correct += isCorrect ? 1 : 0;
      aggregate.answered += isSkipped ? 0 : 1;
      aggregate.total += 1;
      aggregate.seconds += responseSeconds;
      topicAggregates.set(topicId, aggregate);

      // A skip is reported but does not reduce conceptual mastery without evidence of an attempted solution.
      if (!isSkipped) {
        await applyMasteryEvidence(tx, studentId, topicId, {
          correct: isCorrect,
          difficulty: item.question.difficulty,
          responseSeconds,
          estimatedSeconds: item.question.estimatedSeconds,
        });
      }
    }

    await tx.answer.createMany({ data: answerRows });
    const submittedAt = new Date();
    const durationSeconds = Math.max(1, Math.min(Math.round((submittedAt.getTime() - attempt.startedAt.getTime()) / 1000), attempt.test.durationMinutes * 60 + 120));
    const maxScore = attempt.test.questions.reduce((sum, item) => sum + item.marks, 0);
    const accuracy = answeredCount ? (correctCount / answeredCount) * 100 : 0;

    const updatedAttempt = await tx.testAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "SUBMITTED",
        submittedAt,
        score: Math.max(0, Math.round(score * 100) / 100),
        maxScore,
        accuracy: Math.round(accuracy * 10) / 10,
        correctCount,
        incorrectCount,
        skippedCount,
        durationSeconds,
        averageResponseSeconds: answeredCount ? Math.round((responseSecondsTotal / answeredCount) * 10) / 10 : 0,
      },
    });

    for (const [topicId, aggregate] of topicAggregates) {
      await tx.performanceRecord.create({
        data: {
          studentId,
          attemptId: attempt.id,
          subjectId: aggregate.subjectId,
          topicId,
          score: Math.max(0, aggregate.score),
          maxScore: aggregate.maxScore,
          accuracy: aggregate.answered ? (aggregate.correct / aggregate.answered) * 100 : 0,
          questionCount: aggregate.total,
          averageSeconds: aggregate.answered ? aggregate.seconds / aggregate.answered : 0,
        },
      });
    }

    await tx.studentProfile.update({
      where: { id: studentId },
      data: { xp: { increment: correctCount * 10 + 20 }, lastStudyDate: submittedAt },
    });

    const weakest = [...topicAggregates.entries()]
      .map(([topicId, item]) => ({ topicId, accuracy: item.answered ? (item.correct / item.answered) * 100 : 0 }))
      .sort((a, b) => a.accuracy - b.accuracy)[0];
    if (weakest && weakest.accuracy < 70) {
      const topic = await tx.topic.findUnique({ where: { id: weakest.topicId }, select: { titleEn: true } });
      if (topic) {
        await tx.recommendation.create({
          data: {
            studentId,
            topicId: weakest.topicId,
            type: "REVISE",
            title: `Revise ${topic.titleEn}`,
            reason: `Your latest accuracy here was ${Math.round(weakest.accuracy)}%. Review the concept before the next practice set.`,
            priority: 90,
            actionUrl: "/tests",
            expiresAt: new Date(Date.now() + 14 * 86_400_000),
          },
        });
      }
    }

    return updatedAttempt;
  }, { timeout: 15_000 });
}

async function applyMasteryEvidence(
  tx: Prisma.TransactionClient,
  studentId: string,
  topicId: string,
  evidence: Parameters<typeof updateMastery>[2],
) {
  const current = await tx.masteryScore.findUnique({ where: { studentId_topicId: { studentId, topicId } } });
  const updated = updateMastery(current?.score ?? 35, current?.evidenceCount ?? 0, evidence);
  await tx.masteryScore.upsert({
    where: { studentId_topicId: { studentId, topicId } },
    update: {
      score: updated.score,
      confidence: updated.confidence,
      evidenceCount: updated.evidenceCount,
      band: updated.band,
      policyVersion: updated.policyVersion,
      lastEvaluatedAt: new Date(),
      nextReviewAt: nextReviewDate(updated.score),
    },
    create: {
      studentId,
      topicId,
      score: updated.score,
      confidence: updated.confidence,
      evidenceCount: updated.evidenceCount,
      band: updated.band,
      policyVersion: updated.policyVersion,
      nextReviewAt: nextReviewDate(updated.score),
    },
  });
}
