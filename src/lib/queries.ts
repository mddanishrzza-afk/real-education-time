import { prisma } from "@/lib/db";

export async function getCurriculumCatalog(classCode?: string) {
  return prisma.classOffering.findMany({
    where: {
      isActive: true,
      board: { code: "CBSE", isActive: true },
      academicClass: { code: classCode || undefined, isActive: true },
      subject: { isActive: true },
    },
    include: {
      academicClass: true,
      subject: true,
      board: true,
      chapters: {
        where: { isActive: true },
        orderBy: { sequence: "asc" },
        include: {
          topics: {
            where: { isActive: true },
            select: { concepts: { select: { status: true } } },
          },
        },
      },
    },
    orderBy: [{ academicClass: { levelOrder: "asc" } }, { subject: { nameEn: "asc" } }],
  });
}

export async function getLearningChapter(chapterId: string) {
  return prisma.chapter.findFirst({
    where: { id: chapterId, isActive: true, offering: { isActive: true } },
    include: {
      offering: { include: { subject: true, academicClass: true, board: true } },
      topics: {
        where: { isActive: true },
        orderBy: { sequence: "asc" },
        include: {
          concepts: {
            where: { status: "PUBLISHED" },
            orderBy: { sequence: "asc" },
          },
        },
      },
    },
  });
}

export async function getPublishedTests() {
  const now = new Date();
  return prisma.test.findMany({
    where: {
      status: "PUBLISHED",
      OR: [{ availableFrom: null }, { availableFrom: { lte: now } }],
      AND: [{ OR: [{ availableUntil: null }, { availableUntil: { gte: now } }] }],
    },
    include: {
      _count: { select: { questions: true, attempts: true } },
      offering: { include: { subject: true, academicClass: true, board: true } },
    },
    orderBy: [{ mode: "asc" }, { createdAt: "desc" }],
  });
}

export async function getTestForRunner(slug: string) {
  const now = new Date();
  const test = await prisma.test.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      OR: [{ availableFrom: null }, { availableFrom: { lte: now } }],
      AND: [{ OR: [{ availableUntil: null }, { availableUntil: { gte: now } }] }],
    },
    include: {
      questions: {
        orderBy: { sequence: "asc" },
        include: {
          question: {
            select: {
              id: true,
              publicId: true,
              stemEn: true,
              stemHi: true,
              difficulty: true,
              estimatedSeconds: true,
              options: {
                orderBy: { sequence: "asc" },
                select: { id: true, label: true, textEn: true, textHi: true, sequence: true },
              },
              topic: { select: { titleEn: true, titleHi: true } },
            },
          },
        },
      },
    },
  });
  return test;
}

export async function getDashboardData(studentId: string) {
  const [attempts, mastery, recommendations] = await Promise.all([
    prisma.testAttempt.findMany({
      where: { studentId, status: "SUBMITTED" },
      include: { test: { select: { titleEn: true, slug: true, mode: true } } },
      orderBy: { submittedAt: "asc" },
      take: 12,
    }),
    prisma.masteryScore.findMany({
      where: { studentId },
      include: {
        topic: {
          include: {
            chapter: { include: { offering: { include: { subject: true } } } },
          },
        },
      },
      orderBy: { score: "asc" },
    }),
    prisma.recommendation.findMany({
      where: { studentId, isDismissed: false, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { topic: true },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 4,
    }),
  ]);

  const totalQuestions = attempts.reduce((sum, item) => sum + item.correctCount + item.incorrectCount + item.skippedCount, 0);
  const totalCorrect = attempts.reduce((sum, item) => sum + item.correctCount, 0);
  const totalAnswered = attempts.reduce((sum, item) => sum + item.correctCount + item.incorrectCount, 0);
  const totalSeconds = attempts.reduce((sum, item) => sum + item.durationSeconds, 0);
  const overallScore = attempts.length
    ? attempts.reduce((sum, item) => sum + (item.maxScore ? (item.score / item.maxScore) * 100 : 0), 0) / attempts.length
    : 0;

  const subjectMap = new Map<string, { name: string; nameHi: string | null; total: number; count: number; color: string | null }>();
  for (const item of mastery) {
    const subject = item.topic.chapter.offering.subject;
    const current = subjectMap.get(subject.id) ?? { name: subject.nameEn, nameHi: subject.nameHi, total: 0, count: 0, color: subject.color };
    current.total += item.score;
    current.count += 1;
    subjectMap.set(subject.id, current);
  }

  return {
    attempts,
    mastery,
    recommendations,
    stats: {
      overallScore: Math.round(overallScore),
      accuracy: totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0,
      totalQuestions,
      totalCorrect,
      averageSeconds: totalQuestions ? Math.round(totalSeconds / totalQuestions) : 0,
    },
    subjects: [...subjectMap.entries()].map(([id, item]) => ({ id, name: item.name, nameHi: item.nameHi, score: Math.round(item.total / item.count), color: item.color })),
    strongTopics: mastery.filter((item) => item.band === "STRONG").sort((a, b) => b.score - a.score),
    weakTopics: mastery.filter((item) => item.band === "WEAK").sort((a, b) => a.score - b.score),
  };
}

export async function getAttemptResult(attemptId: string, studentId: string) {
  return prisma.testAttempt.findFirst({
    where: { id: attemptId, studentId, status: "SUBMITTED" },
    include: {
      test: true,
      answers: {
        orderBy: { question: { publicId: "asc" } },
        include: {
          selectedOption: { select: { id: true, label: true, textEn: true, textHi: true } },
          question: {
            include: {
              options: { orderBy: { sequence: "asc" }, select: { id: true, label: true, textEn: true, textHi: true, isCorrect: true } },
              topic: { include: { chapter: { include: { offering: { include: { subject: true } } } } } },
            },
          },
        },
      },
      performanceRecords: { include: { topic: true, subject: true } },
    },
  });
}
