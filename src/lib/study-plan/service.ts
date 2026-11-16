import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications/service";
import {
  buildDeterministicPlan,
  computeNextRevisionSchedule,
  generateAiStudyRecommendations,
  type DueRevisionEvidence,
  type TopicEvidence,
} from "@/lib/study-plan/engine";

async function loadStudentEvidence(studentId: string) {
  const [profile, masteryRows, revisionRows, recentAttempts] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: { user: { select: { name: true } }, academicClass: { select: { nameEn: true } } },
    }),
    prisma.masteryScore.findMany({
      where: { studentId },
      include: {
        topic: {
          include: {
            chapter: {
              include: {
                offering: { include: { subject: { select: { id: true, nameEn: true } } } },
              },
            },
          },
        },
      },
      orderBy: { score: "asc" },
    }),
    prisma.revisionItem.findMany({
      where: { studentId, status: { in: ["PENDING", "IN_PROGRESS", "SNOOZED"] } },
      include: {
        topic: {
          include: {
            chapter: {
              include: {
                offering: { include: { subject: { select: { nameEn: true } } } },
              },
            },
          },
        },
      },
      orderBy: { dueAt: "asc" },
    }),
    prisma.testAttempt.findMany({
      where: { studentId, status: "SUBMITTED" },
      orderBy: { submittedAt: "desc" },
      take: 10,
      select: { accuracy: true, score: true, maxScore: true, submittedAt: true },
    }),
  ]);

  if (!profile) throw new ApiError(404, "STUDENT_NOT_FOUND", "Student profile not found.");

  const topics: TopicEvidence[] = masteryRows.map((row) => ({
    topicId: row.topicId,
    topicTitle: row.topic.titleEn,
    chapterTitle: row.topic.chapter.titleEn,
    subjectId: row.topic.chapter.offering.subject.id,
    subjectName: row.topic.chapter.offering.subject.nameEn,
    masteryScore: row.score,
    accuracy: row.score,
    attemptsCount: row.attemptsCount,
  }));

  const dueRevisions: DueRevisionEvidence[] = revisionRows.map((rev) => ({
    id: rev.id,
    topicId: rev.topicId,
    topicTitle: rev.topic.titleEn,
    subjectName: rev.topic.chapter.offering.subject.nameEn,
    dueAt: rev.dueAt,
    intervalDays: rev.intervalDays,
    repetition: rev.repetition,
  }));

  const recentAccuracy =
    recentAttempts.length > 0
      ? recentAttempts.reduce((acc, a) => acc + a.accuracy, 0) / recentAttempts.length
      : 0;

  return { profile, topics, dueRevisions, recentAttempts, recentAccuracy };
}

export async function getStudyPlanOverview(studentId: string) {
  const [evidence, activePlan, allPlans, allRevisions] = await Promise.all([
    loadStudentEvidence(studentId),
    prisma.studyPlan.findFirst({
      where: { studentId, status: "ACTIVE" },
      include: {
        items: {
          orderBy: { sequence: "asc" },
          include: {
            topic: {
              include: {
                chapter: { include: { offering: { include: { subject: { select: { nameEn: true } } } } } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.studyPlan.findMany({
      where: { studentId },
      include: { items: { select: { isCompleted: true, durationMinutes: true } } },
      orderBy: { dateFrom: "desc" },
      take: 7,
    }),
    prisma.revisionItem.findMany({
      where: { studentId },
      include: {
        topic: {
          include: {
            chapter: { include: { offering: { include: { subject: { select: { nameEn: true } } } } } },
          },
        },
      },
      orderBy: { dueAt: "asc" },
      take: 30,
    }),
  ]);

  const items = activePlan?.items ?? [];
  const completedTasks = items.filter((i) => i.isCompleted).length;
  const totalTasks = items.length;
  const pendingTasks = totalTasks - completedTasks;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const estimatedMinutes = items.reduce((sum, i) => sum + i.durationMinutes, 0);

  const completedRevisions = allRevisions.filter((r) => r.status === "COMPLETED").length;
  const revisionCompletionRate =
    allRevisions.length > 0 ? Math.round((completedRevisions / allRevisions.length) * 100) : 0;

  return {
    activePlan,
    stats: {
      totalTasks,
      completedTasks,
      pendingTasks,
      progressPercent,
      estimatedMinutes,
      dueRevisionsCount: evidence.dueRevisions.filter((r) => r.dueAt <= new Date()).length,
      revisionCompletionRate,
      recentAccuracy: Math.round(evidence.recentAccuracy),
    },
    weakTopics: evidence.topics.filter((t) => t.masteryScore < 65).slice(0, 6),
    revisions: allRevisions,
    weeklyHistory: allPlans.map((p) => ({
      id: p.id,
      title: p.title,
      dateFrom: p.dateFrom,
      status: p.status,
      total: p.items.length,
      completed: p.items.filter((i) => i.isCompleted).length,
    })),
  };
}

export async function generateStudentStudyPlan(
  studentId: string,
  options: { availableMinutes?: number; focusSubjectId?: string; useAi?: boolean } = {},
) {
  const evidence = await loadStudentEvidence(studentId);
  const availableMinutes = options.availableMinutes ?? evidence.profile.dailyStudyMinutes ?? 45;

  const { tasks, rationale } = buildDeterministicPlan({
    topics: evidence.topics,
    dueRevisions: evidence.dueRevisions,
    availableMinutes,
    focusSubjectId: options.focusSubjectId,
  });

  const aiResult =
    options.useAi !== false
      ? await generateAiStudyRecommendations({
          studentName: evidence.profile.user.name,
          className: evidence.profile.academicClass?.nameEn || "School",
          weakTopics: evidence.topics.filter((t) => t.masteryScore < 65),
          dueRevisionsCount: evidence.dueRevisions.length,
          recentAccuracy: evidence.recentAccuracy,
        })
      : null;

  const now = new Date();
  const dateTo = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const plan = await prisma.$transaction(async (tx) => {
    await tx.studyPlan.updateMany({
      where: { studentId, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });

    return tx.studyPlan.create({
      data: {
        studentId,
        title: `Personalized Study Plan (${now.toLocaleDateString("en-IN", { month: "short", day: "numeric" })})`,
        dateFrom: now,
        dateTo,
        availableMinutes,
        status: "ACTIVE",
        generatedBy: aiResult ? aiResult.provider : "RULE_ENGINE",
        rationale: aiResult ? `${rationale} ${aiResult.recommendation.rationale}` : rationale,
        items: {
          create: tasks.map((t) => ({
            topicId: t.topicId,
            activityType: t.activityType,
            title: t.title,
            durationMinutes: t.durationMinutes,
            questionCount: t.questionCount,
            sequence: t.sequence,
          })),
        },
      },
      include: { items: { orderBy: { sequence: "asc" } } },
    });
  });

  // Schedule initial revision items for weak topics without an active revision (duplicate prevention)
  const weakTopicIds = evidence.topics.filter((t) => t.masteryScore < 65).slice(0, 3).map((t) => t.topicId);
  for (const topicId of weakTopicIds) {
    const existing = await prisma.revisionItem.findFirst({
      where: { studentId, topicId, status: { in: ["PENDING", "IN_PROGRESS", "SNOOZED"] } },
      select: { id: true },
    });
    if (!existing) {
      await prisma.revisionItem.create({
        data: {
          studentId,
          topicId,
          status: "PENDING",
          reason: "Scheduled from study plan weak-topic analysis",
          dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          intervalDays: 1,
          repetition: 0,
          easeFactor: 2.5,
        },
      });
    }
  }

  await createNotification({
    userId: evidence.profile.userId,
    type: "STUDY_REMINDER",
    title: "Your personalized study plan is ready",
    message: `Scheduled ${tasks.length} task(s) for ${availableMinutes} minutes today.`,
    actionUrl: "/study-plan",
    dedupeWindowMinutes: 5,
  }).catch(() => undefined);

  return { plan, aiRecommendation: aiResult?.recommendation ?? null, provider: aiResult?.provider ?? "RULE_ENGINE" };
}

export async function updateStudyPlanTask(
  studentId: string,
  taskId: string,
  input: { isCompleted?: boolean; durationMinutes?: number },
) {
  const existing = await prisma.studyPlanItem.findUnique({
    where: { id: taskId },
    include: { studyPlan: { select: { studentId: true } } },
  });

  if (!existing) throw new ApiError(404, "TASK_NOT_FOUND", "Study task not found.");
  if (existing.studyPlan.studentId !== studentId) {
    throw new ApiError(403, "FORBIDDEN", "You do not have access to this study task.");
  }

  return prisma.studyPlanItem.update({
    where: { id: taskId },
    data: {
      ...(typeof input.isCompleted === "boolean"
        ? { isCompleted: input.isCompleted, completedAt: input.isCompleted ? new Date() : null }
        : {}),
      ...(typeof input.durationMinutes === "number" ? { durationMinutes: input.durationMinutes } : {}),
    },
  });
}

export async function updateRevisionItemStatus(
  studentId: string,
  revisionId: string,
  input: { status: "IN_PROGRESS" | "COMPLETED" | "SNOOZED"; recallQuality?: "HARD" | "GOOD" | "EASY" },
) {
  const existing = await prisma.revisionItem.findUnique({ where: { id: revisionId } });
  if (!existing) throw new ApiError(404, "REVISION_NOT_FOUND", "Revision item not found.");
  if (existing.studentId !== studentId) {
    throw new ApiError(403, "FORBIDDEN", "You do not have access to this revision item.");
  }

  if (input.status === "COMPLETED") {
    const now = new Date();
    const updated = await prisma.revisionItem.update({
      where: { id: revisionId },
      data: { status: "COMPLETED", completedAt: now },
    });

    const nextSchedule = computeNextRevisionSchedule({
      currentRepetition: existing.repetition,
      currentEaseFactor: existing.easeFactor,
      recallQuality: input.recallQuality ?? "GOOD",
      now,
    });

    // Prevent duplicate pending revision for same topic
    const duplicate = await prisma.revisionItem.findFirst({
      where: { studentId, topicId: existing.topicId, status: { in: ["PENDING", "IN_PROGRESS"] } },
      select: { id: true },
    });

    if (!duplicate) {
      await prisma.revisionItem.create({
        data: {
          studentId,
          topicId: existing.topicId,
          status: "PENDING",
          reason: `Spaced repetition cycle #${nextSchedule.nextRepetition + 1}`,
          dueAt: nextSchedule.dueAt,
          intervalDays: nextSchedule.intervalDays,
          repetition: nextSchedule.nextRepetition,
          easeFactor: nextSchedule.nextEaseFactor,
        },
      });
    }

    return updated;
  }

  if (input.status === "SNOOZED") {
    return prisma.revisionItem.update({
      where: { id: revisionId },
      data: {
        status: "SNOOZED",
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }

  return prisma.revisionItem.update({
    where: { id: revisionId },
    data: { status: "IN_PROGRESS" },
  });
}
